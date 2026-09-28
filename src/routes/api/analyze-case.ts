import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "text/plain",
]);
const MAX_DOC_BYTES = 6 * 1024 * 1024; // 6MB per doc
const MAX_TOTAL_BYTES = 15 * 1024 * 1024; // 15MB total

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}


export const Route = createFileRoute("/api/analyze-case")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Service-role logic is isolated in _admin.server.ts (defense in depth).
        const { verifySupabaseJWT, getAdmin } = await import("./_admin.server");
        try {
          const userId = await verifySupabaseJWT(request.headers.get("authorization"));
          if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

          const { case_id } = (await request.json()) as { case_id?: string };
          if (!case_id) return Response.json({ error: "case_id required" }, { status: 400 });

          const gkey = process.env.GEMINI_API_KEY;
          if (!gkey) return Response.json({ error: "AI unavailable" }, { status: 503 });

          const admin = getAdmin();
          if (!admin) return Response.json({ error: "backend_unconfigured" }, { status: 503 });

          // Load case and verify ownership
          const { data: c, error: caseErr } = await admin
            .from("cases")
            .select("*, manual_client:manual_clients!manual_client_id(full_name, phone, email)")
            .eq("id", case_id)
            .single();
          if (caseErr || !c) return Response.json({ error: "case not found" }, { status: 404 });
          if (c.lawyer_id !== userId) {
            const { data: role } = await admin
              .from("user_roles")
              .select("role")
              .eq("user_id", userId)
              .eq("role", "admin")
              .maybeSingle();
            if (!role) return Response.json({ error: "forbidden" }, { status: 403 });
          }

          // Related data
          const [hearingsR, deadlinesR, tasksR, docsR] = await Promise.all([
            admin.from("hearings").select("hearing_date, court, judge, result, decision, notes").eq("case_id", case_id).order("hearing_date"),
            admin.from("deadlines").select("title, due_date, status").eq("case_id", case_id).order("due_date"),
            admin.from("tasks").select("title, description, status, due_date").eq("case_id", case_id),
            admin.from("documents").select("id, name, file_url, mime_type, file_size").eq("case_id", case_id).order("created_at", { ascending: false }),
          ]);

          // Download docs (bounded)
          const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];
          let total = 0;
          const included: string[] = [];
          const skipped: string[] = [];
          for (const d of docsR.data ?? []) {
            if (!d.file_url || !d.mime_type) { skipped.push(d.name); continue; }
            if (!ALLOWED_MIME.has(d.mime_type)) { skipped.push(`${d.name} (نوع غير مدعوم)`); continue; }
            if ((d.file_size ?? 0) > MAX_DOC_BYTES) { skipped.push(`${d.name} (كبير جداً)`); continue; }
            if (total + (d.file_size ?? 0) > MAX_TOTAL_BYTES) { skipped.push(`${d.name} (تجاوز الحجم الكلي)`); continue; }
            try {
              const { data: blob, error } = await admin.storage.from("case-files").download(d.file_url);
              if (error || !blob) { skipped.push(d.name); continue; }
              const buf = await blob.arrayBuffer();
              total += buf.byteLength;
              if (d.mime_type === "text/plain") {
                const txt = new TextDecoder().decode(buf).slice(0, 20000);
                parts.push({ text: `\n\n--- محتوى الملف "${d.name}" ---\n${txt}\n--- نهاية الملف ---\n` });
              } else {
                parts.push({ inline_data: { mime_type: d.mime_type, data: bufToBase64(buf) } });
                parts.push({ text: `↑ الملف المرفق: "${d.name}"` });
              }
              included.push(d.name);
            } catch {
              skipped.push(d.name);
            }
          }

          const caseCtx = [
            `📋 بيانات القضية:`,
            `العنوان: ${c.title}`,
            `نوع القضية: ${c.type ?? "غير محدد"}`,
            `رقم القضية: ${c.case_number ?? "—"}`,
            `المحكمة: ${c.court ?? "—"} — الدائرة: ${c.court_department ?? "—"}`,
            `القاضي: ${c.judge ?? "—"}`,
            `الطرف الآخر: ${c.opposing_party ?? "—"} — محاميه: ${c.opposing_lawyer ?? "—"}`,
            `الحالة: ${c.status}`,
            c.next_hearing ? `الجلسة القادمة: ${c.next_hearing}` : "",
            c.facts ? `\nالوقائع:\n${c.facts}` : "",
            c.notes_private ? `\nملاحظات المحامي الخاصة:\n${c.notes_private}` : "",
          ].filter(Boolean).join("\n");

          const hearingsTxt = (hearingsR.data ?? []).length
            ? "\n\nسجل الجلسات:\n" + (hearingsR.data ?? []).map((h: any) =>
                `- ${h.hearing_date}: ${h.decision ?? h.result ?? "—"}${h.notes ? ` (${h.notes})` : ""}`
              ).join("\n")
            : "";

          const deadlinesTxt = (deadlinesR.data ?? []).length
            ? "\n\nالآجال:\n" + (deadlinesR.data ?? []).map((x: any) => `- ${x.title} — ${x.due_date} — ${x.status}`).join("\n")
            : "";

          const tasksTxt = (tasksR.data ?? []).length
            ? "\n\nالمهام:\n" + (tasksR.data ?? []).map((t: any) => `- ${t.title} (${t.status})`).join("\n")
            : "";

          const systemInstruction = `أنت محامٍ مصري خبير بخبرة 20 عاماً في التقاضي أمام المحاكم المصرية.
لديك حق الوصول إلى بيانات قضية محددة وملفاتها المرفقة (عقود، صحف دعوى، محاضر، مذكرات، أحكام...).
مهمتك: تحليل استراتيجي شامل للقضية معتمداً فقط على البيانات والملفات المرفقة (لا تخترع وقائع).
قدّم إجابتك بالعربية الفصحى منسّقة كالتالي:

1. ملخص القضية في 3-4 أسطر.
2. تحليل الملفات المرفقة: ماذا يقول كل ملف؟ ما الوقائع الجوهرية المستخرَجة منه؟
3. نقاط القوة القانونية (نقاط الاستناد + المواد القانونية).
4. نقاط الضعف والمخاطر.
5. الاستراتيجية المقترحة (خطوات محددة وترتيب أولوياتها).
6. الدفوع والمذكرات الموصى بتقديمها.
7. المستندات الناقصة التي يجب طلبها/تقديمها.
8. توقع النتيجة (احتمال النجاح ٪ + مدة تقديرية).
9. البدائل (تسوية، مصالحة، ...) إن وُجدت.

لا تستخدم markdown (لا ** ولا ##). اكتب نصاً عادياً مرقّماً.
في النهاية اذكر: "هذا تحليل استرشادي مبني على البيانات المرفقة فقط."`;

          const userText = caseCtx + hearingsTxt + deadlinesTxt + tasksTxt +
            (included.length ? `\n\nالملفات المرفقة للتحليل (${included.length}):\n- ${included.join("\n- ")}` : "\n\nلا توجد ملفات مرفقة صالحة للتحليل.") +
            (skipped.length ? `\n\n(تم تجاوز: ${skipped.join(", ")})` : "");

          parts.unshift({ text: userText });

          const gRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${gkey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: systemInstruction }] },
                contents: [{ role: "user", parts }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
              }),
            }
          );

          if (!gRes.ok) {
            const errTxt = await gRes.text();
            return Response.json({ error: `AI error ${gRes.status}: ${errTxt.slice(0, 200)}` }, { status: 502 });
          }

          const gJson = await gRes.json() as any;
          const analysis = gJson?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("\n") ?? "لم أتمكن من توليد تحليل.";

          return Response.json({
            analysis,
            included_docs: included,
            skipped_docs: skipped,
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
