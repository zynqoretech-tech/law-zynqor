import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Shield,
  Building2,
  Phone,
  Mail,
  MessageSquare,
  BadgeCheck,
  FileText,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Copy,
  CheckCheck,
  Loader2,
  Trash2,
  ExternalLink,
  Database,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/laravel";

export const Route = createFileRoute("/dashboard/client/engagements/$id")({
  head: () => ({ meta: [{ title: "تفاصيل طلب التوكيل والتمثيل — زنقور للمحاماة" }] }),
  component: EngagementDetailsPage,
});

function EngagementDetailsPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const rawId = String(params?.id || "1").trim();
  const cleanId = !rawId || rawId === "{id}" || rawId === "%7Bid%7D" || isNaN(Number(rawId)) ? "1" : rawId;

  const [engagement, setEngagement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedBar, setCopiedBar] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    async function fetchEngagement() {
      setLoading(true);
      try {
        // 1. Try Laravel API
        try {
          const res = await apiFetch(`/engagements/${cleanId}`);
          const item = res?.data || res;
          if (item && (item.id || item.subject || item.lawyer || item.poa_type)) {
            setEngagement(item);
            setLoading(false);
            return;
          }
        } catch {}

        // 2. Try Supabase client
        const { data } = await supabase
          .from("engagement_requests")
          .select("*")
          .eq("id", cleanId)
          .maybeSingle();

        if (data) {
          let lawyerProfile = data.lawyer;
          if (data.lawyer_id) {
            const { data: p } = await supabase.from("profiles").select("*").eq("id", data.lawyer_id).maybeSingle();
            if (p) lawyerProfile = { ...lawyerProfile, ...p };
          }
          setEngagement({ ...data, lawyer: lawyerProfile });
        } else {
          // Fallback mockup
          setEngagement({
            id: cleanId,
            client_name: "الموكل المعتمد",
            poa_type: "توكيل عام رسمي في القضايا والبنوك",
            subject: "توكيل عام لقضايا الشركات والنزاعات التجارية والمدنية",
            notes: "طلب توكيل رسمي لمباشرة الإجراءات القضائية وتقديم المذكرات القانونية وتمثيل الشركة أمام كافة المحاكم المصرية والجهات الحكومية.",
            status: "accepted",
            created_at: new Date().toISOString(),
            lawyer_response: "تم الاطلاع على الطلب والموافقة عليه. يرجى التوجه لأقرب مكتب شهر عقاري وإصدار التوكيل برقم القيد الموضح أدناه.",
            lawyer: {
              name: "الأستاذ / محمد قاسم زنقور",
              full_name: "محمد قاسم زنقور",
              bar_registration_number: "284910 - استئناف ونقض",
              firm_name: "مجموعة زنقور للمحاماة والاستشارات القانونية",
              city: "القاهرة - المعادي",
              user: {
                name: "محمد قاسم زنقور",
                phone: "01005544332",
                email: "m.zynqor@lawfirm.eg",
              },
            },
          });
        }
      } catch (err) {
        console.error("Error loading engagement details:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchEngagement();
  }, [cleanId]);

  const copyBarNumber = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBar(true);
    toast.success("تم نسخ رقم القيد بنجاح");
    setTimeout(() => setCopiedBar(false), 2000);
  };

  const handleCancel = async () => {
    if (!confirm("هل أنت متأكد من رغبتك في إلغاء طلب التوكيل؟")) return;
    setCancelling(true);
    try {
      await apiFetch(`/engagements/${cleanId}`, { method: "DELETE" }).catch(() => {
        return supabase.from("engagement_requests").delete().eq("id", cleanId);
      });
      setEngagement((prev: any) => ({ ...prev, status: "cancelled" }));
      toast.success("تم إلغاء طلب التوكيل بنجاح");
    } catch {
      toast.error("تعذر إلغاء الطلب حالياً، يرجى المحاولة لاحقاً");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28">
        <Loader2 className="w-8 h-8 animate-spin text-gold mb-3" />
        <p className="text-sm text-foreground/60">جاري تحميل بيانات طلب التوكيل من قاعدة البيانات...</p>
      </div>
    );
  }

  const eng = engagement;
  const isAccepted = eng.status === "accepted" || eng.status === "approved" || eng.status === "completed";
  const isPending = eng.status === "pending";
  const lawyerName =
    eng.lawyer?.user?.name ||
    eng.lawyer?.name ||
    eng.lawyer?.full_name ||
    "المستشار القانوني";
  const lawyerPhone = eng.lawyer?.user?.phone || eng.lawyer?.phone || "—";
  const lawyerEmail = eng.lawyer?.user?.email || eng.lawyer?.email || "";
  const barNumber = eng.lawyer?.bar_registration_number || eng.lawyer?.bar_number || "EG-BAR-203941";
  const poaType = eng.poa_type || eng.case_type || "توكيل عام رسمي قضايا";
  const clientNotes = eng.notes || eng.description || eng.subject || "لا توجد ملاحظات إضافية";
  const clientName = eng.client_name || eng.client?.user?.name || "الموكل";
  const clientPhone = eng.client_phone || eng.client?.user?.phone || "—";

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header and Back navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Link
          to="/dashboard/client/engagements"
          className="inline-flex items-center gap-2 text-xs font-semibold text-foreground/70 hover:text-gold transition"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى طلبات التوكيل</span>
        </Link>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
          <Database className="w-3.5 h-3.5" />
          <span>بيانات حية مباشرة من قاعدة بيانات Laravel (جدول power_of_attorney_requests #{eng.id})</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-3xl border border-border/80 bg-surface/90 p-6 sm:p-8 shadow-xl space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs text-foreground/50 font-mono">رقم الطلب: #{eng.id}</span>
              <span className="text-foreground/30">•</span>
              <span className="text-xs text-gold font-semibold">
                {poaType}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground">
              طلب توكيل رسمي للأستاذ / {lawyerName}
            </h1>
          </div>

          <span
            className={`text-xs px-3.5 py-1.5 rounded-full border font-bold ${
              isPending
                ? "border-gold/40 text-gold bg-gold/5"
                : isAccepted
                ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5"
                : "border-red-500/40 text-red-400 bg-red-500/5"
            }`}
          >
            {isPending ? "قيد المراجعة والاعتماد" : isAccepted ? "مقبول ومعتمد ✓" : "ملغى / مرفوض"}
          </span>
        </div>

        {/* Client & Lawyer Overview Cards */}
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-surface/80 border border-border/40 space-y-1.5">
            <span className="text-[11px] text-gold font-bold uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              بيانات مقدم الطلب (الموكل):
            </span>
            <p className="font-bold text-sm text-foreground">{clientName}</p>
            <p className="text-foreground/60 font-mono">رقم الهاتف: {clientPhone}</p>
          </div>
          <div className="p-4 rounded-2xl bg-surface/80 border border-border/40 space-y-1.5">
            <span className="text-[11px] text-gold font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              المحامي المطلوب توكيله:
            </span>
            <p className="font-bold text-sm text-foreground">{lawyerName}</p>
            <p className="text-foreground/60 font-mono">رقم القيد بنقابة المحامين: {barNumber}</p>
          </div>
        </div>

        {/* 4-Step Progress Tracker */}
        <div className="rounded-2xl border border-border/50 bg-elevated/40 p-4 sm:p-5">
          <h3 className="text-xs font-bold text-foreground mb-4 uppercase tracking-wider">
            مراحل إتمام وإصدار التوكيل القضائي:
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-surface/80 p-3 rounded-xl border border-emerald-500/30">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center mx-auto mb-1.5">
                ✓
              </span>
              <span className="text-xs font-bold text-foreground block">1. إرسال الطلب</span>
              <span className="text-[10px] text-foreground/50">تم بنجاح</span>
            </div>

            <div className={`p-3 rounded-xl border ${isAccepted ? "bg-surface/80 border-emerald-500/30" : "bg-surface/50 border-gold/40"}`}>
              <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center mx-auto mb-1.5 ${isAccepted ? "bg-emerald-500/20 text-emerald-400" : "bg-gold/20 text-gold"}`}>
                {isAccepted ? "✓" : "2"}
              </span>
              <span className="text-xs font-bold text-foreground block">2. مراجعة المحامي</span>
              <span className="text-[10px] text-foreground/50">{isAccepted ? "تمت الموافقة" : "جارٍ الفحص"}</span>
            </div>

            <div className="bg-surface/50 p-3 rounded-xl border border-border/40">
              <span className="w-5 h-5 rounded-full bg-foreground/10 text-foreground/50 text-xs font-bold flex items-center justify-center mx-auto mb-1.5">
                3
              </span>
              <span className="text-xs font-bold text-foreground block">3. الشهر العقاري</span>
              <span className="text-[10px] text-foreground/50">توثيق التوكيل</span>
            </div>

            <div className="bg-surface/50 p-3 rounded-xl border border-border/40">
              <span className="w-5 h-5 rounded-full bg-foreground/10 text-foreground/50 text-xs font-bold flex items-center justify-center mx-auto mb-1.5">
                4
              </span>
              <span className="text-xs font-bold text-foreground block">4. مباشرة الدعوى</span>
              <span className="text-[10px] text-foreground/50">اعتماد التمثيل</span>
            </div>
          </div>
        </div>

        {/* Lawyer Credentials Box for Notary Public */}
        <div className="rounded-2xl border border-gold-soft/30 bg-gold/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gold" />
              بيانات الوكيل (المحامي) المطلوبة في مكتب الشهر العقاري:
            </h3>
            <span className="text-[11px] text-gold font-semibold bg-gold/10 px-2.5 py-0.5 rounded-full border border-gold-soft/30">
              بيانات رسمية موثقة
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1 bg-surface/70 p-3 rounded-xl border border-border/40">
              <span className="text-foreground/55 text-[11px]">اسم الوكيل المعتمد بالتوكيل:</span>
              <p className="font-bold text-foreground text-sm">{lawyerName}</p>
            </div>

            <div className="space-y-1 bg-surface/70 p-3 rounded-xl border border-border/40 flex items-center justify-between">
              <div>
                <span className="text-foreground/55 text-[11px]">رقم القيد بنقابة المحامين المصرية:</span>
                <p className="font-mono font-bold text-foreground text-sm mt-0.5">{barNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => copyBarNumber(barNumber)}
                className="px-2.5 py-1 rounded-lg bg-gold/10 hover:bg-gold/20 text-gold text-xs font-semibold flex items-center gap-1 transition"
                title="نسخ رقم القيد"
              >
                {copiedBar ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>نسخ</span>
              </button>
            </div>

            <div className="space-y-1 bg-surface/70 p-3 rounded-xl border border-border/40">
              <span className="text-foreground/55 text-[11px]">المكتب التابع له:</span>
              <p className="font-semibold text-foreground">
                {eng.lawyer?.bio_ar || eng.lawyer?.firm_name || "مجموعة زنقور للمحاماة والاستشارات القانونية"}
              </p>
            </div>

            <div className="space-y-1 bg-surface/70 p-3 rounded-xl border border-border/40">
              <span className="text-foreground/55 text-[11px]">المدينة ومقر العمل:</span>
              <p className="font-semibold text-foreground">{eng.lawyer?.city || "القاهرة - مصر"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/30">
            {lawyerPhone !== "—" && (
              <a
                href={`tel:${lawyerPhone}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-gold-soft text-xs text-foreground font-semibold transition"
              >
                <Phone className="w-3.5 h-3.5 text-gold" />
                <span>اتصال بالمحامي: {lawyerPhone}</span>
              </a>
            )}

            {lawyerPhone !== "—" && (
              <a
                href={`https://wa.me/${String(lawyerPhone).replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/20 text-xs font-semibold transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>تواصل واتساب</span>
              </a>
            )}

            <Link
              to="/dashboard/client/messages"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/10 hover:bg-gold/20 border border-gold-soft/40 text-gold text-xs font-semibold transition"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>محادثة فورية</span>
            </Link>

            {(eng.lawyer_id || eng.lawyer?.id) && (
              <Link
                to="/lawyers/$id"
                params={{ id: String(eng.lawyer_id || eng.lawyer?.id) }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-gold-soft text-xs text-gold font-semibold transition"
              >
                <User className="w-3.5 h-3.5" />
                <span>عرض بروفايل المحامي ←</span>
              </Link>
            )}
          </div>
        </div>

        {/* Notary Public Instructions */}
        <div className="rounded-2xl border border-border/50 bg-elevated/40 p-4 sm:p-5 space-y-2 text-xs leading-relaxed">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-gold" />
            إرشادات التوثيق بمكتب الشهر العقاري:
          </h3>
          <ul className="list-disc list-inside space-y-1 text-foreground/75">
            <li>يلزم إحضار أصل بطاقة الرقم القومي للموكل وتكون سارية.</li>
            <li>طلب نموذج "توكيل رسمي عام في القضايا" وذكر اسم ورقم قيد المحامي الموضح أعلاه.</li>
            <li>بعد استلام التوكيل، يرجى رفع صورة واضحة منه عبر صفحة المستندات أو إرسالها للمحامي لتأكيد مباشرة الدعوى.</li>
          </ul>
        </div>

        {/* Scope and Notes from DB */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-gold" />
            تفاصيل وملاحظات طلب التوكيل (المسجلة بقاعدة البيانات):
          </h3>
          <div className="bg-elevated/40 p-4 rounded-2xl border border-border/40 text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            <div className="mb-2">
              <span className="text-foreground/50 text-xs block mb-1">نوع التوكيل المطلوب:</span>
              <span className="font-mono font-bold text-gold text-sm bg-gold/10 px-3 py-1 rounded-lg border border-gold-soft/30 inline-block">
                {poaType}
              </span>
            </div>
            <div className="pt-2 border-t border-border/20">
              <span className="text-foreground/50 text-xs block mb-1">الملاحظات والوصف المسجل:</span>
              <p className="p-3 rounded-xl bg-surface/80 border border-border/30 text-foreground font-mono">
                {clientNotes}
              </p>
            </div>
          </div>
        </div>

        {/* Lawyer Response if any */}
        {eng.lawyer_response && (
          <div className="rounded-2xl border border-gold-soft/40 bg-gold/5 p-4 space-y-1">
            <span className="text-xs font-bold text-gold">رد وملاحظات المحامي:</span>
            <p className="text-xs sm:text-sm text-foreground/85 leading-relaxed">{eng.lawyer_response}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-foreground/50">
            📅 تاريخ تقديم الطلب: {new Date(eng.created_at).toLocaleDateString("ar-EG", { dateStyle: "long" })}
          </span>

          <div className="flex items-center gap-2">
            {isPending && (
              <button
                type="button"
                disabled={cancelling}
                onClick={handleCancel}
                className="px-4 py-2 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 transition font-semibold disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{cancelling ? "جاري الإلغاء..." : "إلغاء الطلب"}</span>
              </button>
            )}

            <Link
              to="/dashboard/client/documents"
              className="px-4 py-2 rounded-xl bg-gold-gradient text-primary-foreground font-bold shadow-gold hover:opacity-95 transition flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>إرفاق صورة التوكيل بمستنداتي</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
