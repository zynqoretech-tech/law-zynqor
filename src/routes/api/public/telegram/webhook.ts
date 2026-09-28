import { createFileRoute } from "@tanstack/react-router";
import { admin, tgCall } from "@/lib/telegram.server";

type TgUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; username?: string };
    chat: { id: number };
    text?: string;
  };
};

const HELP = `👋 أهلاً بك في بوت "الوكيل"

الأوامر:
/start <كود الربط> — لربط حسابك
/me — معلومات حسابك المرتبط
/help — عرض هذه القائمة

بعد الربط ستصلك إشعارات:
• طلبات التوكيل الجديدة
• حجوزات الاستشارات
• مواعيد الجلسات

الأدمن يمكنه إرسال أي سؤال قانوني أو استفسار عن القضايا/الموكلين وسأجيب.`;

async function reply(chatId: number, text: string) {
  await tgCall("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
}

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await admin()
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

async function answerWithAI(question: string, userId: string): Promise<string> {
  const gkey = process.env.GEMINI_API_KEY;
  if (!gkey) return "خدمة الذكاء الاصطناعي غير متاحة حالياً.";

  const a = admin();
  // Pull compact context for admin: recent cases, engagements, consultations
  const [cases, engagements, consultations] = await Promise.all([
    a.from("cases").select("case_number, title, type, status, next_hearing, opposing_party").limit(30).order("created_at", { ascending: false }),
    a.from("engagement_requests").select("subject, case_type, status, created_at").eq("lawyer_id", userId).limit(20).order("created_at", { ascending: false }),
    a.from("consultations").select("type, scheduled_at, status, price").eq("lawyer_id", userId).limit(20).order("scheduled_at", { ascending: false }),
  ]);

  const ctx = `بيانات المكتب الحالية:
عدد القضايا: ${cases.data?.length ?? 0}
${(cases.data ?? []).slice(0, 10).map((c: any) => `- ${c.case_number ?? "—"} | ${c.title} | ${c.status} | ضد ${c.opposing_party ?? "—"}`).join("\n")}

طلبات التوكيل الأخيرة: ${engagements.data?.length ?? 0}
${(engagements.data ?? []).slice(0, 5).map((e: any) => `- ${e.subject} (${e.status})`).join("\n")}

الاستشارات الأخيرة: ${consultations.data?.length ?? 0}
${(consultations.data ?? []).slice(0, 5).map((c: any) => `- ${c.type} - ${c.scheduled_at} - ${c.status}`).join("\n")}`;

  const sys = `أنت مساعد ذكي لأدمن مكتب محاماة مصري. لديك حق الوصول لبيانات المكتب أدناه.
أجب بالعربية بشكل مختصر ومباشر (رسائل تليجرام). استخدم البيانات المتاحة، ولا تخترع.
إذا كان السؤال قانونياً عاماً، أجبه استناداً للقانون المصري.`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${gkey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: sys }] },
          contents: [{ role: "user", parts: [{ text: `${ctx}\n\nالسؤال: ${question}` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
        }),
      }
    );
    const j = await r.json() as any;
    return j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("\n") ?? "لم أتمكن من الرد.";
  } catch (e) {
    return `خطأ: ${(e as Error).message}`;
  }
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const update = (await request.json()) as TgUpdate;
          const msg = update.message;
          if (!msg?.text || !msg.chat?.id) return Response.json({ ok: true });

          const chatId = msg.chat.id;
          const text = msg.text.trim();
          const a = admin();

          // /start <code>
          if (text.startsWith("/start")) {
            const parts = text.split(/\s+/);
            const code = parts[1];
            if (!code) {
              await reply(chatId, HELP + "\n\n⚠️ استخدم: /start &lt;كود الربط&gt; من صفحة الإعدادات.");
              return Response.json({ ok: true });
            }
            const { data: link } = await a
              .from("telegram_link_codes")
              .select("user_id")
              .eq("code", code)
              .maybeSingle();
            if (!link) {
              await reply(chatId, "❌ كود الربط غير صالح.");
              return Response.json({ ok: true });
            }
            const linkedUserId = (link as any).user_id as string;
            const { data: profile } = await a
              .from("profiles")
              .select("id, full_name")
              .eq("id", linkedUserId)
              .maybeSingle();
            await a.from("profiles").update({ telegram_chat_id: chatId }).eq("id", linkedUserId);
            await reply(chatId, `✅ تم ربط حسابك بنجاح.\nأهلاً ${(profile as any)?.full_name ?? ""}!\n\n${HELP}`);
            return Response.json({ ok: true });
          }

          if (text === "/help") {
            await reply(chatId, HELP);
            return Response.json({ ok: true });
          }

          // Identify linked user
          const { data: linked } = await a
            .from("profiles")
            .select("id, full_name")
            .eq("telegram_chat_id", chatId)
            .maybeSingle();
          if (!linked) {
            await reply(chatId, "⚠️ حسابك غير مرتبط. استخدم /start &lt;كود الربط&gt; من صفحة الإعدادات.");
            return Response.json({ ok: true });
          }

          if (text === "/me") {
            await reply(chatId, `👤 ${(linked as any).full_name}\nchat_id: <code>${chatId}</code>`);
            return Response.json({ ok: true });
          }

          // Only admins can chat with the AI
          if (!(await isAdmin((linked as any).id))) {
            await reply(chatId, "🔒 المحادثة الذكية متاحة لمسؤول المكتب فقط. ستصلك الإشعارات تلقائياً.");
            return Response.json({ ok: true });
          }

          await tgCall("sendChatAction", { chat_id: chatId, action: "typing" });
          const answer = await answerWithAI(text, (linked as any).id);
          await reply(chatId, answer);
          return Response.json({ ok: true });
        } catch (e) {
          console.error("webhook err", e);
          return Response.json({ ok: true }); // always 200 to prevent Telegram retries
        }
      },
    },
  },
});
