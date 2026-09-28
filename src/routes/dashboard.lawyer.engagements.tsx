import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { handleSupabaseError } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Check, X, Mail, Phone, MessageSquare } from "lucide-react";
import { openConversation, notifyUser } from "@/lib/chat";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/lawyer/engagements")({
  head: () => ({ meta: [{ title: "طلبات التوكيل — الوكيل" }] }),
  component: LawyerEngagementsPage,
});

function LawyerEngagementsPage() {
  const { userId } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("engagement_requests")
      .select("*")
      .eq("lawyer_id", userId)
      .order("created_at", { ascending: false });
    if (error) toast.error(handleSupabaseError(error));
    const list = data ?? [];
    const clientIds = Array.from(new Set(list.map((r: any) => r.client_id).filter(Boolean)));
    let profiles: Record<string, any> = {};
    if (clientIds.length > 0) {
      const { data: contacts } = await supabase.rpc("lawyer_client_contacts");
      for (const c of (contacts as any[]) ?? []) profiles[c.client_id] = c;
      const missing = clientIds.filter((id: any) => !profiles[id]);
      if (missing.length > 0) {
        const { data: pdata } = await supabase
          .from("profiles")
          .select("id, full_name, phone, avatar_url")
          .in("id", missing);
        for (const p of pdata ?? []) profiles[(p as any).id] = p;
      }
    }
    setRows(list.map((r: any) => ({ ...r, client: profiles[r.client_id] ?? null })));
    setLoading(false);
  }

  useEffect(() => { load(); }, [userId]);

  async function respond(id: string, status: "accepted" | "rejected", response?: string) {
    const row = rows.find((r) => r.id === id);
    const { error } = await supabase
      .from("engagement_requests")
      .update({ status, lawyer_response: response ?? null, responded_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(handleSupabaseError(error));

    if (row?.client_id && userId) {
      await notifyUser({
        userId: row.client_id,
        title: status === "accepted" ? "تم قبول طلب التوكيل" : "تم رفض طلب التوكيل",
        body: status === "accepted"
          ? `قَبِل المحامي طلبك: ${row.subject}. يمكنك الآن التواصل معه مباشرة عبر المحادثات.`
          : `تم رفض طلبك: ${row.subject}${response ? ` — ${response}` : ""}`,
        type: "engagement",
        relatedId: id,
        relatedType: "engagement_requests",
      });
      if (status === "accepted") {
        await openConversation({ lawyerId: userId, clientId: row.client_id, source: "engagement", sourceId: id });
        // Register the accepted client in the lawyer's own client list (once).
        const { data: existing } = await supabase
          .from("manual_clients")
          .select("id")
          .eq("lawyer_id", userId)
          .eq("platform_user_id", row.client_id)
          .maybeSingle();
        if (!existing) {
          const { error: mcErr } = await supabase.from("manual_clients").insert({
            lawyer_id: userId,
            platform_user_id: row.client_id,
            full_name: row.client?.full_name ?? "موكل",
            phone: row.client?.phone ?? null,
            client_type: "individual",
            notes: `أُضيف تلقائياً بعد قبول طلب التوكيل: ${row.subject ?? ""}`,
          } as never);
          if (mcErr) console.warn("manual client insert failed", mcErr.message);
        }
      }
    }


    toast.success(status === "accepted" ? "تم قبول الطلب وفُتحت محادثة مع الموكل" : "تم رفض الطلب");
    load();
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-gradient-gold">طلبات التوكيل</h1>
        <span className="text-sm text-foreground/60">{rows.length} طلب</span>
      </div>
      {rows.length === 0 ? (
        <div className="bg-surface/60 border border-border rounded-2xl p-10 text-center text-foreground/60">
          لا توجد طلبات توكيل حتى الآن
        </div>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="bg-surface/60 border border-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gold-gradient flex items-center justify-center text-primary-foreground font-bold">
                  {(r.client?.full_name ?? "م")[0]}
                </div>
                <div>
                  <div className="font-semibold">{r.client?.full_name ?? "موكل"}</div>
                  <div className="text-xs text-foreground/50">{new Date(r.created_at).toLocaleString("ar-EG")}</div>
                </div>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full border ${
                r.status === "pending" ? "border-gold/40 text-gold bg-gold/5" :
                r.status === "accepted" ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5" :
                "border-red-500/40 text-red-400 bg-red-500/5"
              }`}>
                {r.status === "pending" ? "قيد المراجعة" : r.status === "accepted" ? "مقبول" : "مرفوض"}
              </span>
            </div>
            <div>
              <div className="text-foreground font-semibold mb-1">{r.subject}</div>
              {r.case_type && <div className="text-xs text-gold/80 mb-2">نوع القضية: {r.case_type}</div>}
              {r.description && <p className="text-sm text-foreground/70 whitespace-pre-wrap">{r.description}</p>}
              {r.budget && <div className="text-sm text-foreground/60 mt-2">الميزانية المتاحة: {Number(r.budget).toLocaleString()} ج</div>}
              <div className="flex flex-wrap gap-3 mt-3 text-sm">
                {r.client?.phone && (
                  <a href={`tel:${r.client.phone}`} className="inline-flex items-center gap-1.5 text-gold hover:underline" dir="ltr">
                    <Phone className="h-3.5 w-3.5" /> {r.client.phone}
                  </a>
                )}
                {r.client?.email && (
                  <a href={`mailto:${r.client.email}`} className="inline-flex items-center gap-1.5 text-gold hover:underline" dir="ltr">
                    <Mail className="h-3.5 w-3.5" /> {r.client.email}
                  </a>
                )}
              </div>
            </div>
            {r.status === "pending" && (
              <div className="flex gap-2 pt-2 border-t border-border">
                <button
                  onClick={() => respond(r.id, "accepted")}
                  className="flex-1 bg-gold-gradient text-primary-foreground font-semibold py-2 rounded-lg inline-flex items-center justify-center gap-2 hover:scale-[1.01] transition"
                >
                  <Check className="h-4 w-4" /> قبول
                </button>
                <button
                  onClick={() => {
                    const reason = prompt("سبب الرفض (اختياري):") ?? undefined;
                    respond(r.id, "rejected", reason);
                  }}
                  className="flex-1 border border-red-500/40 text-red-400 hover:bg-red-500/10 font-semibold py-2 rounded-lg inline-flex items-center justify-center gap-2 transition"
                >
                  <X className="h-4 w-4" /> رفض
                </button>
              </div>
            )}
            {r.status === "accepted" && (
              <Link to="/dashboard/lawyer/messages" className="inline-flex items-center gap-2 text-sm text-gold hover:underline pt-2 border-t border-border w-full">
                <MessageSquare className="h-4 w-4" /> فتح المحادثة مع الموكل
              </Link>
            )}
            {r.lawyer_response && (
              <div className="text-sm text-foreground/60 pt-2 border-t border-border">ردك: {r.lawyer_response}</div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
