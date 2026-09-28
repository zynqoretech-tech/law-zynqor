import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const askSchema = z.object({
  officeId: z.string().uuid(),
  question: z.string().trim().min(1).max(4000),
});

type Row = Record<string, unknown>;

function line(prefix: string, rows: Row[] | null | undefined, fmt: (r: Row) => string): string {
  if (!rows || rows.length === 0) return "";
  return `${prefix}\n${rows.map((r) => `- ${fmt(r)}`).join("\n")}\n\n`;
}

const SYSTEM = `أنت "الوكيل" — مساعد ذكي داخل محادثة فريق مكتب محاماة مصري.
تجيب أعضاء الفريق عن المهام والقضايا والمصروفات والفواتير اعتماداً فقط على بيانات المكتب المرفقة أدناه.
- إن سُئلت عن حالة مهمة مسندة لعضو، اذكر اسم العضو وحالة المهمة وتاريخ استحقاقها وهل تأخرت.
- إن لم تجد المعلومة في البيانات، قل ذلك صراحةً ولا تخترع.
- أجب بالعربية بإيجاز واضح ومنظم، بدون أي رموز Markdown (لا ** ولا ## ولا -).`;

export const askTeamAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => askSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const rpc = supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>;
    const { data: allowed } = await rpc("is_office_member", {
      _office: data.officeId,
      _user: userId,
    });
    if (allowed !== true) throw new Error("غير مصرح لك بهذه المحادثة");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as {
      from: (t: string) => any;
    };
    const office = data.officeId;

    const [ownerRes, membersRes, tasksRes, casesRes, expensesRes, invoicesRes, historyRes] =
      await Promise.all([
        admin.from("profiles").select("id, full_name").eq("id", office).maybeSingle(),
        admin
          .from("team_members")
          .select("member_profile_id, role, is_active, profiles:member_profile_id(full_name)")
          .eq("office_lawyer_id", office),
        admin
          .from("tasks")
          .select("id, title, status, priority, due_date, assigned_to, actual_hours, estimated_hours, case_id")
          .eq("lawyer_id", office)
          .order("created_at", { ascending: false })
          .limit(120),
        admin
          .from("cases")
          .select("id, case_number, title, status, stage, court, next_hearing, total_fees, paid_fees")
          .eq("lawyer_id", office)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(80),
        admin
          .from("case_expenses")
          .select("type, description, amount, paid_at, is_billable, is_reimbursed, case_id")
          .eq("lawyer_id", office)
          .order("created_at", { ascending: false })
          .limit(60),
        admin
          .from("invoices")
          .select("invoice_number, total_amount, paid_amount, status, due_date")
          .eq("lawyer_id", office)
          .order("created_at", { ascending: false })
          .limit(40),
        admin
          .from("team_chat_messages")
          .select("body, is_ai, sender_id, created_at")
          .eq("office_id", office)
          .order("created_at", { ascending: false })
          .limit(12),
      ]);

    const names = new Map<string, string>();
    if (ownerRes.data) names.set(ownerRes.data.id, ownerRes.data.full_name ?? "صاحب المكتب");
    for (const m of membersRes.data ?? []) {
      names.set(m.member_profile_id, m.profiles?.full_name ?? "عضو");
    }
    const caseTitles = new Map<string, string>();
    for (const c of casesRes.data ?? []) caseTitles.set(c.id, c.title);

    const today = new Date().toISOString().slice(0, 10);
    let ctx = `تاريخ اليوم: ${today}\n\n`;
    ctx += line("أعضاء الفريق:", membersRes.data as Row[], (r: any) =>
      `${r.profiles?.full_name ?? "عضو"} (${r.role}${r.is_active ? "" : " — غير نشط"})`,
    );
    ctx += line("المهام:", tasksRes.data as Row[], (r: any) =>
      `${r.title} | الحالة: ${r.status} | الأولوية: ${r.priority} | الاستحقاق: ${r.due_date ?? "غير محدد"} | المسند إليه: ${
        r.assigned_to ? (names.get(r.assigned_to) ?? "عضو") : "غير مسندة"
      } | القضية: ${r.case_id ? (caseTitles.get(r.case_id) ?? "-") : "-"} | ساعات فعلية: ${r.actual_hours}`,
    );
    ctx += line("القضايا:", casesRes.data as Row[], (r: any) =>
      `${r.title} (${r.case_number ?? "بدون رقم"}) | الحالة: ${r.status} | المرحلة: ${r.stage ?? "-"} | المحكمة: ${
        r.court ?? "-"
      } | الجلسة القادمة: ${r.next_hearing ?? "-"} | الأتعاب: ${r.total_fees ?? 0} مدفوع ${r.paid_fees ?? 0}`,
    );
    ctx += line("المصروفات:", expensesRes.data as Row[], (r: any) =>
      `${r.type}: ${r.description} | ${r.amount} جنيه | تاريخ: ${r.paid_at ?? "-"} | القضية: ${
        r.case_id ? (caseTitles.get(r.case_id) ?? "-") : "-"
      }`,
    );
    ctx += line("الفواتير:", invoicesRes.data as Row[], (r: any) =>
      `${r.invoice_number} | ${r.total_amount} جنيه | مدفوع ${r.paid_amount ?? 0} | ${r.status} | استحقاق ${r.due_date ?? "-"}`,
    );

    const history = [...((historyRes.data as any[]) ?? [])].reverse();
    const historyText = history
      .map((m) => `${m.is_ai ? "الوكيل" : (names.get(m.sender_id) ?? "عضو")}: ${String(m.body).slice(0, 500)}`)
      .join("\n");

    const key = process.env.LOVABLE_API_KEY;
    let answer: string;
    if (!key) {
      answer = "خدمة الذكاء الاصطناعي غير متاحة حالياً.";
    } else {
      const call = (model: string) =>
        fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model,
            max_tokens: 2048,
            messages: [
              { role: "system", content: `${SYSTEM}\n\nبيانات المكتب:\n${ctx}` },
              {
                role: "user",
                content: `آخر رسائل المحادثة:\n${historyText}\n\nسؤال ${
                  names.get(userId) ?? "عضو الفريق"
                }: ${data.question}`,
              },
            ],
          }),
        });
      let r = await call("google/gemini-2.5-flash");
      if (!r.ok && (r.status === 429 || r.status === 503)) r = await call("google/gemini-2.5-flash-lite");
      if (!r.ok) {
        answer =
          r.status === 429
            ? "تم تجاوز الحد المسموح من الطلبات. حاول بعد قليل."
            : r.status === 402
              ? "تم استنفاد رصيد الذكاء الاصطناعي."
              : "تعذر الحصول على إجابة الآن.";
      } else {
        const json = (await r.json()) as { choices?: { message?: { content?: string } }[] };
        answer = json.choices?.[0]?.message?.content?.trim() || "لم أتمكن من صياغة إجابة.";
      }
    }

    const { data: inserted, error } = await admin
      .from("team_chat_messages")
      .insert({ office_id: office, sender_id: userId, body: answer, is_ai: true })
      .select("id, office_id, sender_id, body, attachment_url, attachment_name, attachment_type, attachment_size, is_ai, created_at")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });
