import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { handleSupabaseError } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Trash2, Phone, Mail, MessageSquare, BadgeCheck, Building2, Star, Eye, ArrowLeft, Plus } from "lucide-react";
import { apiFetch } from "@/lib/laravel";
import { EmptyState } from "@/components/DashboardShared";

export const Route = createFileRoute("/dashboard/client/engagements/")({
  head: () => ({ meta: [{ title: "طلبات التوكيل والتمثيل القانوني — زنقور للمحاماة" }] }),
  component: ClientEngagementsPage,
});

function ClientEngagementsPage() {
  const { userId } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      // 1. Try Laravel API first
      const apiRes = await apiFetch("/engagements").catch(() => null);
      const apiList = Array.isArray(apiRes) ? apiRes : apiRes?.data || [];
      if (apiList.length > 0) {
        setRows(apiList);
        setLoading(false);
        return;
      }
    } catch {}

    // 2. Fallback to Supabase client
    try {
      const { data, error } = await supabase
        .from("engagement_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) toast.error(handleSupabaseError(error));
      const list = data ?? [];
      const lawyerIds = Array.from(new Set(list.map((r: any) => r.lawyer_id).filter(Boolean)));
      let profiles: Record<string, any> = {};
      if (lawyerIds.length > 0) {
        const { data: pdata } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", lawyerIds);
        for (const p of pdata ?? []) profiles[(p as any).id] = p;
        const { data: contacts } = await supabase.rpc("client_lawyer_contacts");
        for (const c of (contacts as any[]) ?? []) {
          profiles[c.lawyer_id] = { ...(profiles[c.lawyer_id] ?? {}), ...c, id: c.lawyer_id };
        }
      }
      setRows(list.map((r: any) => ({ ...r, lawyer: profiles[r.lawyer_id] ?? r.lawyer ?? null })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [userId]);

  async function cancel(id: string) {
    if (!confirm("هل تريد إلغاء طلب التوكيل؟")) return;
    try {
      await apiFetch(`/engagements/${id}`, { method: "DELETE" }).catch(() => {
        return supabase.from("engagement_requests").delete().eq("id", id);
      });
      toast.success("تم إلغاء الطلب بنجاح");
      load();
    } catch (e) {
      toast.error(handleSupabaseError(e));
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
            طلبات التوكيل والتمثيل القضائي
          </h1>
          <p className="text-xs sm:text-sm text-foreground/60 mt-1">
            متابعة إجراءات التوكيل الرسمي، توثيق الشهر العقاري، واعتماد تمثيل المحامي
          </p>
        </div>
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold-gradient text-primary-foreground font-semibold text-xs shadow-gold hover:opacity-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>طلب توكيل محامٍ جديد</span>
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="⚖️"
          title="لم تقم بإرسال طلبات توكيل بعد"
          desc="يمكنك اختيار المحامي المناسب لقضيتك من السوق القانوني وإرسال طلب توكيل رسمي ومتابعة كافة الإجراءات."
          cta="تصفح قائمة المحامين"
          ctaHref="/marketplace"
        />
      ) : (
        rows.map((r) => {
          const lawyerName =
            r.lawyer?.user?.name ||
            r.lawyer?.name ||
            r.lawyer?.full_name ||
            "المستشار القانوني";

          const isAccepted = r.status === "accepted" || r.status === "approved" || r.status === "completed";
          const isPending = r.status === "pending";

          return (
            <div
              key={r.id}
              className="bg-surface/90 border border-border/80 hover:border-gold-soft/50 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm transition"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {r.lawyer?.avatar_url ? (
                    <img
                      src={r.lawyer.avatar_url}
                      alt={lawyerName}
                      className="h-11 w-11 rounded-2xl object-cover border border-gold/30 shrink-0"
                    />
                  ) : (
                    <div className="h-11 w-11 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-bold shrink-0">
                      {lawyerName[0] || "م"}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-base text-foreground inline-flex items-center gap-1.5">
                      الأستاذ / {lawyerName}
                      <BadgeCheck className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="text-xs text-foreground/50 mt-0.5">
                      نوع التوكيل: <span className="font-semibold text-foreground">{r.poa_type || r.case_type || "توكيل عام قضايا"}</span>
                    </div>
                  </div>
                </div>

                <span
                  className={`text-xs px-3 py-1 rounded-full border font-bold ${
                    isPending
                      ? "border-gold/40 text-gold bg-gold/5"
                      : isAccepted
                      ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5"
                      : "border-red-500/40 text-red-400 bg-red-500/5"
                  }`}
                >
                  {isPending ? "قيد المراجعة والاعتماد" : isAccepted ? "مقبول ومعتمد ✓" : "مرفوض"}
                </span>
              </div>

              <div className="text-sm font-semibold text-foreground">
                {r.subject || "طلب توكيل في دعوى قضائية ومتابعة أعمال قانونية"}
              </div>

              {r.description && (
                <p className="text-xs sm:text-sm text-foreground/70 bg-elevated/40 p-3 rounded-xl border border-border/40 whitespace-pre-wrap leading-relaxed">
                  {r.description}
                </p>
              )}

              {r.lawyer_response && (
                <div className="text-xs sm:text-sm bg-gold/5 border border-gold-soft/30 rounded-xl p-3 text-foreground/80 space-y-1">
                  <span className="text-gold font-bold text-xs block">رد وملاحظات المحامي:</span>
                  <p>{r.lawyer_response}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-border/40 text-xs">
                <span className="text-foreground/50">
                  📅 تاريخ الإرسال: {new Date(r.created_at).toLocaleDateString("ar-EG")}
                </span>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Link
                    to="/dashboard/client/engagements/$id"
                    params={{ id: String(r.id) }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gold/10 hover:bg-gold/20 border border-gold-soft/50 text-gold font-bold transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>عرض التفاصيل الكاملة وإجراءات الشهر العقاري</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </Link>

                  {isPending && (
                    <button
                      type="button"
                      onClick={() => cancel(r.id)}
                      className="px-3 py-2 text-red-400 hover:bg-red-500/10 border border-red-500/30 rounded-xl transition flex items-center gap-1 shrink-0 font-semibold"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>إلغاء</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
