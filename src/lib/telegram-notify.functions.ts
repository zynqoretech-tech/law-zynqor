// Server fns to trigger Telegram notifications after in-app events.
import { createServerFn } from "@tanstack/react-start";

export const notifyEngagementRequest = createServerFn({ method: "POST" })
  .inputValidator((d: { requestId: string }) => d)
  .handler(async ({ data }) => {
    const { admin, sendToUser, sendToAdmins } = await import("./telegram.server");
    const a = admin();
    const { data: req } = await a
      .from("engagement_requests")
      .select("subject, case_type, description, budget, lawyer_id, client_id, profiles!client_id(full_name)")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!req) return { ok: false };
    const r: any = req;
    const clientName = r.profiles?.full_name ?? "موكل";
    const text = `📩 <b>طلب توكيل جديد</b>
من: ${clientName}
الموضوع: ${r.subject}
النوع: ${r.case_type ?? "—"}
${r.budget ? `الميزانية: ${r.budget} ج.م\n` : ""}${r.description ? `\nالتفاصيل: ${r.description.slice(0, 300)}` : ""}`;
    await Promise.all([sendToUser(r.lawyer_id, text), sendToAdmins(text)]);
    return { ok: true };
  });

export const notifyConsultationBooked = createServerFn({ method: "POST" })
  .inputValidator((d: { consultationId: string }) => d)
  .handler(async ({ data }) => {
    const { admin, sendToUser, sendToAdmins } = await import("./telegram.server");
    const a = admin();
    const { data: cons } = await a
      .from("consultations")
      .select("type, scheduled_at, price, client_notes, lawyer_id, client_id, profiles!client_id(full_name)")
      .eq("id", data.consultationId)
      .maybeSingle();
    if (!cons) return { ok: false };
    const r: any = cons;
    const when = new Date(r.scheduled_at).toLocaleString("ar-EG");
    const text = `📅 <b>حجز استشارة جديد</b>
الموكل: ${r.profiles?.full_name ?? "—"}
النوع: ${r.type}
الموعد: ${when}
السعر: ${r.price ?? 0} ج.م${r.client_notes ? `\nملاحظات: ${r.client_notes.slice(0, 200)}` : ""}`;
    await Promise.all([sendToUser(r.lawyer_id, text), sendToAdmins(text)]);
    return { ok: true };
  });

export const notifyHearingScheduled = createServerFn({ method: "POST" })
  .inputValidator((d: { hearingId: string }) => d)
  .handler(async ({ data }) => {
    const { admin, sendToUser, sendToAdmins } = await import("./telegram.server");
    const a = admin();
    const { data: h } = await a
      .from("hearings")
      .select("hearing_date, court, case_id, cases!case_id(title, case_number, lawyer_id)")
      .eq("id", data.hearingId)
      .maybeSingle();
    if (!h) return { ok: false };
    const r: any = h;
    const when = new Date(r.hearing_date).toLocaleString("ar-EG");
    const text = `⚖️ <b>جلسة جديدة</b>
القضية: ${r.cases?.title ?? "—"} (${r.cases?.case_number ?? "—"})
المحكمة: ${r.court ?? "—"}
الموعد: ${when}`;
    if (r.cases?.lawyer_id) await sendToUser(r.cases.lawyer_id, text);
    await sendToAdmins(text);
    return { ok: true };
  });
