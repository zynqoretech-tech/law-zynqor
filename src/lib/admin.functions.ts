import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sectionSchema = z.object({
  section: z.enum(["overview", "users", "lawyers", "clients", "subscriptions", "operations", "invoices", "moderation", "notifications", "audit"]),
  query: z.string().trim().max(100).default(""),
  page: z.number().int().min(1).max(1000).default(1),
});

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) throw new Error("غير مصرح لك باستخدام لوحة الإدارة");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function audit(
  admin: any,
  userId: string,
  action: string,
  tableName: string,
  recordId: string | null,
  oldData: unknown,
  newData: unknown,
) {
  const { error } = await admin.from("audit_logs").insert({
    user_id: userId,
    action,
    table_name: tableName,
    record_id: recordId,
    old_data: oldData,
    new_data: newData,
  });
  if (error) console.error("[admin-audit]", error.message);
}

export const getAdminData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sectionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const from = (data.page - 1) * 25;
    const to = from + 24;
    const q = data.query;

    if (data.section === "overview") {
      const [profiles, lawyers, clients, cases, consultations, invoices, payments, verifications] = await Promise.all([
        admin.from("profiles").select("id", { count: "exact", head: true }),
        admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "lawyer"),
        admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "client"),
        admin.from("cases").select("id", { count: "exact", head: true }).is("deleted_at", null),
        admin.from("consultations").select("id", { count: "exact", head: true }),
        admin.from("invoices").select("id,total_amount,paid_amount,status").order("created_at", { ascending: false }).limit(8),
        admin.from("payments").select("id,amount,status,purpose,created_at,user_id").order("created_at", { ascending: false }).limit(8),
        admin.from("lawyer_verification_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      return {
        section: data.section,
        metrics: {
          users: profiles.count ?? 0,
          lawyers: lawyers.count ?? 0,
          clients: clients.count ?? 0,
          cases: cases.count ?? 0,
          consultations: consultations.count ?? 0,
          pendingVerifications: verifications.count ?? 0,
        },
        rows: [...(payments.data ?? []).map((row: any) => ({ ...row, kind: "payment" })), ...(invoices.data ?? []).map((row: any) => ({ ...row, kind: "invoice" }))].slice(0, 10),
      };
    }

    if (["users", "lawyers", "clients"].includes(data.section)) {
      let query = admin.from("profiles").select("id,full_name,phone,location,avatar_url,role,plan,plan_expires_at,is_disabled,disabled_at,disabled_reason,created_at", { count: "exact" });
      if (data.section === "lawyers") query = query.eq("role", "lawyer");
      if (data.section === "clients") query = query.eq("role", "client");
      if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,location.ilike.%${q}%`);
      const result = await query.order("created_at", { ascending: false }).range(from, to);
      if (result.error) throw result.error;
      const ids = (result.data ?? []).map((row: any) => row.id);
      const { data: authPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const emailById = new Map((authPage?.users ?? []).filter((u: any) => ids.includes(u.id)).map((u: any) => [u.id, u.email ?? null]));
      let extraById = new Map<string, any>();
      if (data.section === "lawyers" && ids.length) {
        const { data: lawyersData } = await admin.from("lawyers").select("id,firm_name,bar_number,verified,rating,specializations,consultation_price").in("id", ids);
        extraById = new Map((lawyersData ?? []).map((row: any) => [row.id, row]));
      }
      return { section: data.section, rows: (result.data ?? []).map((row: any) => ({ ...row, email: emailById.get(row.id), extra: extraById.get(row.id) ?? null })), total: result.count ?? 0, page: data.page };
    }

    if (data.section === "subscriptions") {
      const { data: profiles, error, count } = await admin.from("profiles").select("id,full_name,role,plan,plan_expires_at,features_override,is_disabled", { count: "exact" }).order("plan_expires_at", { ascending: true, nullsFirst: false }).range(from, to);
      if (error) throw error;
      const ids = (profiles ?? []).map((row: any) => row.id);
      const { data: subscriptions } = ids.length ? await admin.from("subscriptions").select("user_id,status,billing_cycle,amount_paid,started_at,expires_at").in("user_id", ids) : { data: [] };
      const subByUser = new Map((subscriptions ?? []).map((row: any) => [row.user_id, row]));
      return { section: data.section, rows: (profiles ?? []).map((row: any) => ({ ...row, subscription: subByUser.get(row.id) ?? null })), total: count ?? 0, page: data.page };
    }

    if (data.section === "operations") {
      const [cases, consultations, engagements] = await Promise.all([
        admin.from("cases").select("id,title,case_number,status,stage,lawyer_id,client_id,created_at").order("created_at", { ascending: false }).limit(30),
        admin.from("consultations").select("id,type,status,scheduled_at,price,lawyer_id,client_id,created_at").order("created_at", { ascending: false }).limit(30),
        admin.from("engagement_requests").select("id,subject,status,lawyer_id,client_id,created_at").order("created_at", { ascending: false }).limit(30),
      ]);
      return { section: data.section, rows: [
        ...(cases.data ?? []).map((row: any) => ({ ...row, kind: "case" })),
        ...(consultations.data ?? []).map((row: any) => ({ ...row, kind: "consultation" })),
        ...(engagements.data ?? []).map((row: any) => ({ ...row, kind: "engagement" })),
      ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 50) };
    }

    if (data.section === "invoices") {
      const result = await admin.from("invoices").select("id,invoice_number,amount,total_amount,paid_amount,status,due_date,client_id,manual_client_id,lawyer_id,case_id,created_at", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
      if (result.error) throw result.error;
      return { section: data.section, rows: result.data ?? [], total: result.count ?? 0, page: data.page };
    }

    if (data.section === "moderation") {
      const [reviews, verification] = await Promise.all([
        admin.from("reviews").select("id,rating,review,is_visible,created_at,client_id,lawyer_id").order("created_at", { ascending: false }).limit(100),
        admin.from("lawyer_verification_requests").select("id,lawyer_id,status,bar_number,bar_document_url,id_document_url,selfie_url,notes,created_at").order("created_at", { ascending: false }).limit(100),
      ]);
      return { section: data.section, rows: [...(verification.data ?? []).map((row: any) => ({ ...row, kind: "verification" })), ...(reviews.data ?? []).map((row: any) => ({ ...row, kind: "review" }))] };
    }

    if (data.section === "notifications") {
      const result = await admin.from("notifications").select("id,user_id,title,body,type,is_read,created_at", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
      if (result.error) throw result.error;
      return { section: data.section, rows: result.data ?? [], total: result.count ?? 0, page: data.page };
    }

    const result = await admin.from("audit_logs").select("id,user_id,action,table_name,record_id,old_data,new_data,created_at", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
    if (result.error) throw result.error;
    return { section: data.section, rows: result.data ?? [], total: result.count ?? 0, page: data.page };
  });

export const setAdminAccountState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid(), disabled: z.boolean(), reason: z.string().trim().max(300).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("لا يمكنك تعطيل حسابك الحالي");
    const admin = await requireAdmin(context);
    const { data: before, error: readError } = await admin.from("profiles").select("id,is_disabled,disabled_reason").eq("id", data.userId).single();
    if (readError) throw readError;
    const { error: authError } = await admin.auth.admin.updateUserById(data.userId, { ban_duration: data.disabled ? "876000h" : "none" });
    if (authError) throw authError;
    const next = { is_disabled: data.disabled, disabled_at: data.disabled ? new Date().toISOString() : null, disabled_reason: data.disabled ? (data.reason || "تم التعطيل بواسطة الإدارة") : null };
    const { error } = await admin.from("profiles").update(next).eq("id", data.userId);
    if (error) throw error;
    await audit(admin, context.userId, data.disabled ? "account_disabled" : "account_restored", "profiles", data.userId, before, next);
    return { ok: true };
  });

export const deleteAdminAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid(), confirmation: z.literal("حذف نهائي") }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("لا يمكنك حذف حسابك الحالي");
    const admin = await requireAdmin(context);
    const { data: before } = await admin.from("profiles").select("id,full_name,role,phone").eq("id", data.userId).maybeSingle();
    await audit(admin, context.userId, "account_deleted", "profiles", data.userId, before, { confirmation: true });
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw error;
    return { ok: true };
  });

export const updateAdminPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid(), plan: z.enum(["free", "basic", "pro", "office"]), expiresAt: z.string().datetime().nullable() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { data: before } = await admin.from("profiles").select("plan,plan_expires_at").eq("id", data.userId).single();
    const next = { plan: data.plan, plan_expires_at: data.expiresAt };
    const { error } = await admin.from("profiles").update(next).eq("id", data.userId);
    if (error) throw error;
    await audit(admin, context.userId, "plan_updated", "profiles", data.userId, before, next);
    return { ok: true };
  });

export const moderateAdminItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("review"), id: z.string().uuid(), visible: z.boolean() }),
    z.object({ kind: z.literal("verification"), lawyerId: z.string().uuid(), approved: z.boolean(), notes: z.string().max(500).optional() }),
  ]).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    if (data.kind === "review") {
      const { error } = await admin.from("reviews").update({ is_visible: data.visible }).eq("id", data.id);
      if (error) throw error;
      await audit(admin, context.userId, data.visible ? "review_shown" : "review_hidden", "reviews", data.id, null, { is_visible: data.visible });
    } else {
      const status = data.approved ? "approved" : "rejected";
      const { error } = await admin.from("lawyer_verification_requests").update({ status, reviewed_by: context.userId, reviewed_at: new Date().toISOString(), notes: data.notes ?? null }).eq("lawyer_id", data.lawyerId).eq("status", "pending");
      if (error) throw error;
      const { error: lawyerError } = await admin.from("lawyers").update({ verified: data.approved }).eq("id", data.lawyerId);
      if (lawyerError) throw lawyerError;
      await audit(admin, context.userId, `verification_${status}`, "lawyers", data.lawyerId, null, { verified: data.approved });
    }
    return { ok: true };
  });

export const sendAdminNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ audience: z.enum(["all", "lawyers", "clients"]), title: z.string().trim().min(3).max(100), body: z.string().trim().min(3).max(1000) }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    let query = admin.from("profiles").select("id").eq("is_disabled", false);
    if (data.audience !== "all") query = query.eq("role", data.audience === "lawyers" ? "lawyer" : "client");
    const { data: recipients, error: readError } = await query;
    if (readError) throw readError;
    const rows = (recipients ?? []).map((row: any) => ({ user_id: row.id, title: data.title, body: data.body, type: "admin_broadcast" }));
    if (rows.length) {
      const { error } = await admin.from("notifications").insert(rows);
      if (error) throw error;
    }
    await audit(admin, context.userId, "notification_broadcast", "notifications", null, null, { audience: data.audience, recipients: rows.length, title: data.title });
    return { ok: true, recipients: rows.length };
  });
