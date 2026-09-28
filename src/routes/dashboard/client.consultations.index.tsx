import { handleSupabaseError } from "@/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, Calendar, Clock, MapPin, Video, Eye, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/DashboardShared";
import { apiFetch } from "@/lib/laravel";

export const Route = createFileRoute("/dashboard/client/consultations/")({
  head: () => ({ meta: [{ title: "استشاراتي القانونية — زنقور للمحاماة" }] }),
  component: MyConsultsPage,
});

function MyConsultsPage() {
  const { userId } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingDialog, setRatingDialog] = useState<{ id: string; lawyerId: string } | null>(null);
  const [stars, setStars] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // 1. Try Laravel API first
      const res = await apiFetch("/appointments").catch(() => null);
      const apiList = Array.isArray(res) ? res : res?.data || [];
      if (apiList.length > 0) {
        setList(apiList);
        setLoading(false);
        return;
      }
    } catch {}

    // 2. Fallback to Supabase client
    try {
      const { data } = await supabase
        .from("consultations")
        .select("*")
        .order("scheduled_at", { ascending: false });
      
      const ids = Array.from(new Set((data ?? []).map((c: any) => c.lawyer_id).filter(Boolean)));
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name").in("id", ids)
        : { data: [] as any[] };
      const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      setList((data ?? []).map((c: any) => ({ ...c, profiles: pmap.get(c.lawyer_id) ?? null })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [userId]);

  async function submitRating() {
    if (!ratingDialog) return;
    setRatingLoading(true);
    try {
      await supabase.from("reviews").insert({
        lawyer_id: ratingDialog.lawyerId,
        client_id: userId,
        consultation_id: ratingDialog.id,
        rating: stars,
        review: reviewText || null,
      });
      await supabase.from("consultations").update({ rating: stars, review: reviewText || null }).eq("id", ratingDialog.id);
      toast.success("شكراً على تقييمك ✓");
      setRatingDialog(null);
      setStars(5);
      setReviewText("");
      load();
    } catch (e) {
      toast.error(handleSupabaseError(e));
    } finally {
      setRatingLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
            استشاراتي القانونية
          </h1>
          <p className="text-xs sm:text-sm text-foreground/60 mt-1">
            متابعة مواعيد وجلسات الاستشارات مع المستشارين والمحامين المعتمدين
          </p>
        </div>
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold-gradient text-primary-foreground font-semibold text-xs shadow-gold hover:opacity-95 transition"
        >
          <span>حجز استشارة جديدة</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border/80 rounded-2xl p-5 animate-pulse">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-elevated rounded w-1/3" />
                  <div className="h-3 bg-elevated rounded w-1/2" />
                </div>
                <div className="h-6 w-20 bg-elevated rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon="📞"
          title="لا توجد استشارات مسجلة بعد"
          desc="يمكنك تصفح نخبة المحامين المعتمدين وحجز استشارة فورية أو بالمكتب"
          cta="تصفح المحامين المعتمدين"
          ctaHref="/marketplace"
        />
      ) : (
        <div className="space-y-4">
          {list.map((c) => {
            const lawyerName =
              c.lawyer?.user?.name ||
              c.lawyer?.name ||
              c.lawyer?.office_name ||
              c.profiles?.full_name ||
              "المستشار القانوني";
            const rawDate = c.starts_at || c.scheduled_at || c.created_at;
            const dateObj = rawDate
              ? new Date(typeof rawDate === "string" ? rawDate.replace(" ", "T") : rawDate)
              : new Date();
            const formattedDate = isNaN(dateObj.getTime())
              ? "موعد محدد"
              : dateObj.toLocaleString("ar-EG", { dateStyle: "full", timeStyle: "short" });
            const rawPrice = c.price ?? c.fee ?? c.lawyer?.office_fee ?? c.lawyer?.consultation_fee ?? 450;
            const priceNum = isNaN(Number(rawPrice)) ? 450 : Number(rawPrice);
            const isOnline = c.type === "online";

            return (
              <div
                key={c.id}
                className="bg-surface/90 border border-border/80 hover:border-gold-soft/50 rounded-2xl p-5 sm:p-6 transition shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold text-lg font-bold shrink-0">
                      {isOnline ? <Video className="w-6 h-6" /> : <MapPin className="w-6 h-6" />}
                    </div>
                    <div>
                      <div className="font-bold text-base text-foreground">
                        استشارة مع: {lawyerName}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/60 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-gold" />
                          {formattedDate}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          {isOnline ? "عبر الفيديو (أونلاين)" : "حضور بمكتب المحامي"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <StatusBadge status={c.status || "confirmed"} />
                  </div>
                </div>

                {/* Notes if any */}
                {(c.notes || c.client_notes) && (
                  <div className="text-xs sm:text-sm text-foreground/75 bg-elevated/40 p-3 rounded-xl border border-border/40 leading-relaxed">
                    <span className="font-semibold text-foreground ml-1">موضوع الاستشارة:</span>
                    {c.notes || c.client_notes}
                  </div>
                )}

                {/* Footer with Price and View Details Button */}
                <div className="pt-3 border-t border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-foreground/70">
                    <span>قيمة الاستشارة:</span>
                    <span className="font-bold text-sm text-foreground">{priceNum.toLocaleString("ar-EG")} ج.م</span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Link
                      to="/dashboard/client/consultations/$id"
                      params={{ id: String(c.id) }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gold/10 hover:bg-gold/20 border border-gold-soft/50 text-gold font-bold transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>عرض تفاصيل الاستشارة الكاملة</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </Link>

                    {c.status === "completed" && !c.rating && (
                      <button
                        type="button"
                        onClick={() => setRatingDialog({ id: String(c.id), lawyerId: String(c.lawyer_id) })}
                        className="px-3 py-2 text-gold border border-gold/40 hover:bg-gold/10 rounded-xl transition flex items-center gap-1 font-semibold"
                      >
                        <Star className="w-3.5 h-3.5" />
                        <span>تقييم</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rating Dialog */}
      {ratingDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-display text-xl text-gradient-gold font-bold">قيّم الاستشارة القانونية</h3>
            <div className="flex gap-2 justify-center py-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStars(s)}
                  className={`text-3xl transition ${s <= stars ? "text-gold" : "text-foreground/20"}`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="اكتب تعليقك حول جودة الاستشارة وسرعة الرد (اختياري)..."
              rows={3}
              className="w-full bg-elevated border border-gold-soft/40 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-foreground outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={submitRating}
                disabled={ratingLoading}
                className="flex-1 bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 text-xs sm:text-sm shadow-gold"
              >
                {ratingLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                إرسال التقييم
              </button>
              <button
                type="button"
                onClick={() => setRatingDialog(null)}
                className="border border-border px-4 py-2.5 rounded-xl text-foreground/70 text-xs sm:text-sm hover:bg-elevated transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
