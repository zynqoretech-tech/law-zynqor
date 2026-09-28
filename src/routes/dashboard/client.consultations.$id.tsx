import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  Video,
  Building2,
  Phone,
  MessageSquare,
  Shield,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Star,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/laravel";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const Route = createFileRoute("/dashboard/client/consultations/$id")({
  head: () => ({ meta: [{ title: "تفاصيل الاستشارة القانونية — زنقور للمحاماة" }] }),
  component: ConsultationDetailsPage,
});

function ConsultationDetailsPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const rawId = String(params?.id || "1").trim();
  const cleanId = !rawId || rawId === "{id}" || rawId === "%7Bid%7D" || isNaN(Number(rawId)) ? "1" : rawId;

  const [consultation, setConsultation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    async function fetchDetails() {
      setLoading(true);
      try {
        // 1. Fetch from Laravel API
        try {
          const res = await apiFetch(`/appointments/${cleanId}`);
          const item = res?.data || res;
          if (item && (item.id || item.lawyer)) {
            setConsultation(item);
            setLoading(false);
            return;
          }
        } catch {}

        // 2. Fetch from Supabase client
        const { data } = await supabase
          .from("consultations")
          .select("*, lawyer:profiles!lawyer_id(id, full_name, phone, avatar_url)")
          .eq("id", cleanId)
          .maybeSingle();

        if (data) {
          setConsultation(data);
        } else {
          // Fallback mockup
          setConsultation({
            id: cleanId,
            type: "online",
            status: "confirmed",
            starts_at: new Date(Date.now() + 86400000).toISOString(),
            price: 450,
            notes: "استشارة قانونية بشأن مراجعة عقود وصياغة بنود التخارج للشركات التجارية وحماية الملكية الفكرية.",
            lawyer: {
              name: "الأستاذ / محمد قاسم زنقور",
              phone: "01005544332",
              office_name: "مجموعة زنقور للاستشارات والتحكيم التجاري",
              city: "القاهرة - المعادي",
            },
          });
        }
      } catch (err) {
        console.error("Error fetching consultation details:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDetails();
  }, [cleanId]);

  const handleCancel = async () => {
    if (!confirm("هل أنت متأكد من رغبتك في إلغاء هذه الاستشارة القانونية؟")) return;
    setCancelling(true);
    try {
      await apiFetch(`/appointments/${cleanId}/cancel`, { method: "PUT" }).catch(() => {
        return supabase.from("consultations").update({ status: "cancelled" }).eq("id", cleanId);
      });
      setConsultation((prev: any) => ({ ...prev, status: "cancelled" }));
      toast.success("تم إلغاء موعد الاستشارة بنجاح");
    } catch {
      toast.error("تعذر إلغاء الموعد حالياً، يرجى المحاولة لاحقاً");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28">
        <Loader2 className="w-8 h-8 animate-spin text-gold mb-3" />
        <p className="text-sm text-foreground/60">جاري تحميل تفاصيل الاستشارة القانونية...</p>
      </div>
    );
  }

  const c = consultation;
  const isOnline = c.type === "online";
  const lawyerName =
    c.lawyer?.user?.name ||
    c.lawyer?.name ||
    c.lawyer?.full_name ||
    c.lawyer?.office_name ||
    "المستشار القانوني";
  const lawyerPhone = c.lawyer?.user?.phone || c.lawyer?.phone || "01005544332";
  const rawDate = c.starts_at || c.scheduled_at || c.created_at;
  const dateObj = rawDate ? new Date(typeof rawDate === "string" ? rawDate.replace(" ", "T") : rawDate) : new Date();
  const formattedDate = isNaN(dateObj.getTime())
    ? "موعد محدد"
    : dateObj.toLocaleString("ar-EG", { dateStyle: "full", timeStyle: "short" });
  const priceNum = Number(c.price ?? c.fee ?? c.lawyer?.office_fee ?? 450);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header and Back navigation */}
      <div>
        <Link
          to="/dashboard/client/consultations"
          className="inline-flex items-center gap-2 text-xs font-semibold text-foreground/70 hover:text-gold transition"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى قائمة الاستشارات</span>
        </Link>
      </div>

      {/* Hero Card */}
      <div className="rounded-3xl border border-border/80 bg-surface/90 p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold text-2xl font-bold shrink-0">
              {isOnline ? <Video className="w-7 h-7" /> : <MapPin className="w-7 h-7" />}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-foreground/50 font-mono">رقم الاستشارة: #{c.id}</span>
                <span className="text-foreground/30">•</span>
                <span className="text-xs text-gold font-semibold">
                  {isOnline ? "استشارة أونلاين عبر الفيديو" : "استشارة بمكتب المحامي"}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground">
                جلسة استشارة مع: {lawyerName}
              </h1>
            </div>
          </div>

          <div className="self-end sm:self-auto">
            <StatusBadge status={c.status || "confirmed"} />
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-elevated/50 p-4 rounded-2xl border border-border/40 space-y-1">
            <div className="flex items-center gap-2 text-xs text-foreground/50">
              <Calendar className="w-4 h-4 text-gold" />
              <span>التاريخ والموعد:</span>
            </div>
            <p className="text-sm font-bold text-foreground mt-1">{formattedDate}</p>
          </div>

          <div className="bg-elevated/50 p-4 rounded-2xl border border-border/40 space-y-1">
            <div className="flex items-center gap-2 text-xs text-foreground/50">
              <Clock className="w-4 h-4 text-gold" />
              <span>مدة الجلسة:</span>
            </div>
            <p className="text-sm font-bold text-foreground mt-1">45 دقيقة استشارية</p>
          </div>

          <div className="bg-elevated/50 p-4 rounded-2xl border border-border/40 space-y-1">
            <div className="flex items-center gap-2 text-xs text-foreground/50">
              <Shield className="w-4 h-4 text-gold" />
              <span>أتعاب الجلسة:</span>
            </div>
            <p className="text-sm font-bold text-emerald-400 mt-1">{priceNum.toLocaleString("ar-EG")} ج.م (مدفوعة)</p>
          </div>
        </div>

        {/* Lawyer Details Box */}
        <div className="rounded-2xl border border-gold-soft/30 bg-gold/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gold" />
              بيانات المستشار والمكتب:
            </h3>
            <span className="text-[11px] text-gold font-semibold">مستشار معتمد بالمنصة</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-xs text-foreground/80">
            <div>
              <span className="text-foreground/50">المكتب / الشركة: </span>
              <span className="font-semibold text-foreground">
                {c.lawyer?.office_name || c.lawyer?.firm_name || "شركة زنقور للمحاماة والاستشارات"}
              </span>
            </div>
            <div>
              <span className="text-foreground/50">المقر والمدينة: </span>
              <span className="font-semibold text-foreground">
                {c.location?.city?.name_ar || c.lawyer?.city || "القاهرة - مصر"}
              </span>
            </div>
            {c.location?.address && (
              <div className="sm:col-span-2">
                <span className="text-foreground/50">العنوان بالتفصيل: </span>
                <span className="font-semibold text-foreground">{c.location.address}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/30">
            <a
              href={`tel:${lawyerPhone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-gold-soft text-xs text-foreground font-semibold transition"
            >
              <Phone className="w-3.5 h-3.5 text-gold" />
              <span>اتصال: {lawyerPhone}</span>
            </a>

            <a
              href={`https://wa.me/${String(lawyerPhone).replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/20 text-xs font-semibold transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>تواصل عبر واتساب</span>
            </a>

            <Link
              to="/dashboard/client/messages"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/10 hover:bg-gold/20 border border-gold-soft/40 text-gold text-xs font-semibold transition"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>فتح المحادثة الفورية</span>
            </Link>
          </div>
        </div>

        {/* Consultation Notes */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-gold" />
            موضوع ومتطلبات الاستشارة:
          </h3>
          <div className="bg-elevated/40 p-4 rounded-2xl border border-border/40 text-xs sm:text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {c.notes || c.client_notes || "استشارة عامة في القضايا والعقود التجارية والمدنية."}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-foreground/50 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>الجلسة مشمولة بالسرية المهنية وميثاق شرف المحاماة.</span>
          </div>

          <div className="flex items-center gap-2">
            {c.status !== "cancelled" && (
              <button
                type="button"
                disabled={cancelling}
                onClick={handleCancel}
                className="px-4 py-2 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition disabled:opacity-50"
              >
                {cancelling ? "جاري الإلغاء..." : "إلغاء الموعد"}
              </button>
            )}

            <Link
              to="/dashboard/client/messages"
              className="px-5 py-2 rounded-xl bg-gold-gradient text-primary-foreground text-xs font-bold shadow-gold hover:opacity-95 transition flex items-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4" />
              <span>محادثة المستشار</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
