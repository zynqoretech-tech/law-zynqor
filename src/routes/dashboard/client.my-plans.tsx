import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CreditCard,
  Sparkles,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Building2,
  Smartphone,
  Banknote,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/dashboard/client/my-plans")({
  head: () => ({ meta: [{ title: "اشتراكاتي وباقاتي — زنقور للمحاماة" }] }),
  component: ClientMyPlansPage,
});

type UserSubscription = {
  id: string | number;
  plan_id?: string | number;
  subscription_plan_id?: string | number;
  status: "active" | "pending" | "approved" | "rejected" | "cancelled" | "expired";
  starts_at?: string;
  ends_at?: string;
  payment_method?: string;
  notes?: string;
  client_message?: string;
  admin_notes?: string;
  transaction_reference?: string;
  created_at?: string;
  plan?: {
    id: string | number;
    name: string;
    name_ar?: string;
    price?: number;
    price_monthly?: number;
    currency?: string;
    features?: string[];
  };
};

function ClientMyPlansPage() {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | number | null>(null);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("subscriptions").select("*");
      if (Array.isArray(data)) {
        setSubscriptions(data);
      } else {
        setSubscriptions([]);
      }
    } catch {
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handleCancelSubscription = async (subId: string | number) => {
    if (!confirm("هل أنت متأكد من رغبتك في إلغاء هذا الاشتراك؟")) return;
    setCancellingId(subId);
    try {
      await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", subId);
      toast.success("تم إلغاء الاشتراك بنجاح.");
      await fetchSubscriptions();
    } catch {
      toast.error("تعذر إلغاء الاشتراك حالياً. يرجى التواصل مع الدعم.");
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            سارٍ ونشط
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            معتمد ومفعل
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            قيد المراجعة والتدقيق
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-3.5 h-3.5" />
            مرفوض من الإدارة
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30">
            <AlertCircle className="w-3.5 h-3.5" />
            ملغى
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-500/15 text-slate-400 border border-slate-500/30">
            منتهي
          </span>
        );
    }
  };

  const getPaymentMethodLabel = (key?: string) => {
    if (!key) return "تحويل رسمي";
    if (key.includes("bank") || key.includes("cib")) return "تحويل بنكي رسمي (CIB)";
    if (key.includes("instapay")) return "إنستاباي InstaPay";
    if (key.includes("wallet")) return "محفظة هاتف محمول (كاش)";
    if (key.includes("card")) return "بطاقة دفع إلكتروني";
    if (key.includes("cash") || key.includes("cod")) return "دفع نقدي بمقر الشركة";
    return key;
  };

  const activeSub = subscriptions.find((s) => s.status === "active");

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
            اشتراكاتي وباقاتي القانونية
          </h1>
          <p className="text-xs sm:text-sm text-foreground/60 mt-1">
            تابع حالة باقتك الحالية، مواعيد التجديد، والملاحظات الخاصة بطلبات الاشتراك
          </p>
        </div>

        <Link
          to="/dashboard/client/plans"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold-gradient text-primary-foreground font-bold text-xs sm:text-sm shadow-gold hover:opacity-95 transition"
        >
          <Sparkles className="w-4 h-4" />
          <span>تصفح الباقات الجديدة</span>
        </Link>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border/60 bg-surface/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground/60">الباقة النشطة الحالية</span>
            <div className="w-8 h-8 rounded-xl bg-gold/10 text-gold flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg font-bold text-foreground mt-2">
            {activeSub?.plan?.name_ar || activeSub?.plan?.name || (activeSub ? "باقة قانونية مفعلة" : "لا توجد باقة نشطة")}
          </p>
          <p className="text-[11px] text-foreground/50 mt-1">
            {activeSub ? `سارية حتى: ${activeSub.ends_at ? new Date(activeSub.ends_at).toLocaleDateString("ar-EG") : "نهاية الشهر"}` : "يمكنك الاشتراك في أي وقت"}
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-surface/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground/60">إجمالي الاشتراكات والطلبات</span>
            <div className="w-8 h-8 rounded-xl bg-gold/10 text-gold flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">
            {subscriptions.length}
          </p>
          <p className="text-[11px] text-foreground/50 mt-1">سجل جميع الطلبات المسجلة بحسابك</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-surface/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground/60">الدعم القانوني والاستشاري</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg font-bold text-foreground mt-2">
            متاح على مدار 24/7
          </p>
          <p className="text-[11px] text-foreground/50 mt-1">فريق زنقور القانوني في خدمتك</p>
        </div>
      </div>

      {/* Subscriptions List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold font-display text-foreground">
          سجل الاشتراكات والطلبات
        </h2>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 bg-surface/40 rounded-3xl border border-border/40">
            <Loader2 className="w-8 h-8 animate-spin text-gold mb-3" />
            <p className="text-sm text-foreground/60">جاري تحميل سجل الاشتراكات...</p>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-12 text-center bg-surface/30 space-y-4">
            <div className="w-16 h-16 rounded-full bg-gold/10 text-gold flex items-center justify-center mx-auto">
              <CreditCard className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">لم تقم بالاشتراك في أي باقة بعد</h3>
              <p className="text-xs text-foreground/60 max-w-sm mx-auto">
                اشترك الآن في باقات زنقور القانونية للحصول على استشارات قانونية دورية، مراجعة العقود، وحماية أعمالك.
              </p>
            </div>
            <div>
              <Link
                to="/dashboard/client/plans"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gold-gradient text-primary-foreground font-bold text-xs sm:text-sm shadow-gold hover:opacity-95 transition"
              >
                <span>استعراض الباقات واختيار خطتك</span>
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {subscriptions.map((sub) => {
              const planTitle = sub.plan?.name_ar || sub.plan?.name || "باقة الخدمات القانونية المتكاملة";
              const price = sub.plan?.price_monthly ?? sub.plan?.price ?? 450;

              return (
                <div
                  key={sub.id}
                  className="rounded-3xl border border-border/60 bg-surface/90 p-6 sm:p-7 shadow-md hover:border-gold-soft/60 transition space-y-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold font-display text-foreground">
                          {planTitle}
                        </h3>
                        {getStatusBadge(sub.status)}
                      </div>
                      <p className="text-xs text-foreground/60">
                        رقم طلب الاشتراك: #{sub.id} &bull; تاريخ الطلب: {sub.created_at ? new Date(sub.created_at).toLocaleDateString("ar-EG") : "اليوم"}
                      </p>
                    </div>

                    <div className="text-right sm:text-left">
                      <span className="text-xl font-extrabold text-foreground">
                        {Number(price).toLocaleString("ar-EG")}
                      </span>
                      <span className="text-xs font-bold text-gold mr-1">ج.م / شهرياً</span>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-1 bg-surface p-3 rounded-2xl border border-border/40">
                      <span className="text-foreground/50">طريقة السداد:</span>
                      <p className="font-semibold text-foreground">
                        {getPaymentMethodLabel(sub.payment_method)}
                      </p>
                    </div>

                    <div className="space-y-1 bg-surface p-3 rounded-2xl border border-border/40">
                      <span className="text-foreground/50">تاريخ البداية:</span>
                      <p className="font-semibold text-foreground">
                        {sub.starts_at ? new Date(sub.starts_at).toLocaleDateString("ar-EG") : "مباشرة عند التأكيد"}
                      </p>
                    </div>

                    <div className="space-y-1 bg-surface p-3 rounded-2xl border border-border/40">
                      <span className="text-foreground/50">تاريخ التجديد القادم:</span>
                      <p className="font-semibold text-foreground">
                        {sub.ends_at ? new Date(sub.ends_at).toLocaleDateString("ar-EG") : "بعد 30 يوماً"}
                      </p>
                    </div>
                  </div>

                  {/* Client Notes Attached */}
                  {sub.notes && (
                    <div className="rounded-2xl border border-border/40 bg-surface/50 p-4 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-foreground/60 font-medium">
                        <FileText className="w-3.5 h-3.5 text-gold" />
                        <span>رسالتك وملاحظاتك المرفقة مع الطلب:</span>
                      </div>
                      <p className="text-foreground/85 whitespace-pre-wrap leading-relaxed pr-5">
                        {sub.notes}
                      </p>
                      {sub.transaction_reference && (
                        <p className="text-[11px] text-gold font-mono pr-5 mt-1">
                          رقم مرجع التحويل: {sub.transaction_reference}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Admin Feedback Notes */}
                  {sub.admin_notes && (
                    <div className={`rounded-2xl border p-4 text-xs space-y-1 ${
                      sub.status === "rejected"
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    }`}>
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>💬 رد وملاحظات إدارة شركة زنقور:</span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed pr-5">
                        {sub.admin_notes}
                      </p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    {sub.status === "active" && (
                      <button
                        type="button"
                        disabled={cancellingId === sub.id}
                        onClick={() => handleCancelSubscription(sub.id)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition disabled:opacity-50"
                      >
                        {cancellingId === sub.id ? "جاري الإلغاء..." : "إلغاء الاشتراك"}
                      </button>
                    )}

                    <Link
                      to="/dashboard/client/plans"
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-gold hover:bg-gold/10 border border-gold-soft/40 transition"
                    >
                      ترقية أو تغيير الباقة
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
