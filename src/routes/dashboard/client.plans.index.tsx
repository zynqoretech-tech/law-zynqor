import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Sparkles, Shield, ArrowLeft, Loader2, CreditCard, ChevronRight, Zap, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/laravel";

export const Route = createFileRoute("/dashboard/client/plans/")({
  head: () => ({ meta: [{ title: "باقات الخدمات القانونية — زنقور للمحاماة" }] }),
  component: ClientPlansPage,
});

export type PlanItem = {
  id: number | string;
  name: string;
  name_ar?: string;
  description?: string;
  price: number;
  price_monthly?: number;
  price_yearly?: number;
  currency?: string;
  billing_interval?: string;
  is_popular?: boolean;
  features?: string[];
  ai_enabled?: boolean;
  voice_enabled?: boolean;
  monthly_ai_limit?: number;
};

const DEFAULT_PLANS: PlanItem[] = [
  {
    id: 1,
    name: "باقة الاستشارات الشخصية للأفراد",
    name_ar: "باقة الاستشارات الشخصية للأفراد",
    description: "تغطية قانونية متكاملة للأفراد، صياغة ومراجعة العقود الشخصية، واستشارات فورية على مدار الشهر.",
    price: 450,
    price_monthly: 450,
    currency: "EGP",
    billing_interval: "monthly",
    is_popular: false,
    features: [
      "حتى 4 استشارات قانونية متخصصة شهرياً",
      "مراجعة وصياغة عقود الإيجار والبيع والعمل",
      "استعلامات الذكاء الاصطناعي القانوني غير محدودة",
      "دعم مباشر عبر المحادثة الفورية وتوثيق المستندات",
      "أولوية الرد في غضون 4 ساعات",
    ],
  },
  {
    id: 2,
    name: "باقة الشركات والرواد (Business Plan)",
    name_ar: "باقة الشركات والرواد (Business Plan)",
    description: "الحل الأمثل للشركات الناشئة والمتوسطة لحماية الأعمال، العقود التجارية، والامتثال القانوني الكامل.",
    price: 2400,
    price_monthly: 2400,
    currency: "EGP",
    billing_interval: "monthly",
    is_popular: true,
    features: [
      "مستشار قانوني مخصص لمتابعة أعمال شركتك",
      "صياغة ومراجعة غير محدودة للعقود والاتفاقيات",
      "تأسيس وتعديل عقود الشركات والسجل التجاري والبطاقة الضريبية",
      "تمثيل أمام مكتب العمل والتأمينات والجهات الرسمية",
      "تحليل العقود والنزاعات بواسطة الذكاء الاصطناعي القانوني",
      "جلسات استشارية مرئية أسبوعية وتغطية 24/7",
    ],
  },
  {
    id: 3,
    name: "باقة المؤسسات والتمثيل القضائي (Corporate Enterprise)",
    name_ar: "باقة المؤسسات والتمثيل القضائي (Corporate Enterprise)",
    description: "إدارة قانونية شاملة للكيانات الكبرى، نزاعات المحاكم، التحكيم التجاري، وصياغة السياسات والحوكمة.",
    price: 6500,
    price_monthly: 6500,
    currency: "EGP",
    billing_interval: "monthly",
    is_popular: false,
    features: [
      "إدارة شاملة لجميع دعاوى وقضايا الشركة بالمحاكم المصرية",
      "فريق قانوني متكامل متخصص في التحكيم والنزاعات المالية",
      "حضور كافة جلسات المحاكم وإيداع المذكرات والطعون",
      "صياغة لوائح تنظيم العمل والامتثال الضريبي والحوكمة",
      "تكامل مستندي وأرشفة إلكترونية مشفرة للمستندات والتوكيلات",
      "خط دعم هاتفي وميداني مباشر وفوري VIP",
    ],
  },
];

function ClientPlansPage() {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFromDb, setIsFromDb] = useState(false);

  useEffect(() => {
    async function loadPlans() {
      try {
        setLoading(true);
        const res = await apiFetch("/subscription-plans");
        const list = Array.isArray(res) ? res : res?.data || [];
        if (list.length > 0) {
          setPlans(list);
          setIsFromDb(true);
        } else {
          const { data } = await supabase.from("subscription_plans").select("*");
          if (Array.isArray(data) && data.length > 0) {
            setPlans(data);
            setIsFromDb(true);
          } else {
            setPlans(DEFAULT_PLANS);
          }
        }
      } catch {
        try {
          const { data } = await supabase.from("subscription_plans").select("*");
          if (Array.isArray(data) && data.length > 0) {
            setPlans(data);
            setIsFromDb(true);
          } else {
            setPlans(DEFAULT_PLANS);
          }
        } catch {
          setPlans(DEFAULT_PLANS);
        }
      } finally {
        setLoading(false);
      }
    }
    loadPlans();
  }, []);

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-gold-soft/30 bg-gradient-to-br from-surface via-surface/90 to-gold/5 p-6 sm:p-10 shadow-xl">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gold/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold-soft text-gold text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-gold" />
                باقات زنقور للاستشارات والتمثيل القانوني المعتمد
              </span>
              {isFromDb && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium">
                  <Database className="w-3 h-3" />
                  قادمة من قاعدة البيانات (subscription_plans)
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-4xl font-display font-bold text-foreground">
              اختر خطة الحماية والدعم القانوني المناسبة لك
            </h1>
            <p className="text-foreground/70 text-sm sm:text-base leading-relaxed">
              نوفر للأفراد والشركات والمؤسسات تغطية قانونية احترافية، صياغة ومراجعة العقود، وحلول التمثيل القضائي بإشراف نخبة من المحامين والمستشارين المعتمدين.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Link
              to="/dashboard/client/my-plans"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-gold-soft text-foreground hover:bg-gold/10 transition font-medium text-sm text-center"
            >
              <CreditCard className="w-4 h-4 text-gold" />
              عرض اشتراكاتي الحالية
            </Link>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gold mb-3" />
          <p className="text-sm text-foreground/60">جاري تحميل الباقات المتاحة من قاعدة البيانات...</p>
        </div>
      ) : (
        /* Plans Grid */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          {plans.map((plan) => {
            const isPopular = plan.is_popular || Number(plan.id) === 2;
            const price = Number(plan.price_monthly ?? plan.price ?? 0);
            const features = Array.isArray(plan.features) ? plan.features : (DEFAULT_PLANS.find(p => String(p.id) === String(plan.id))?.features || [
              "استشارات قانونية فورية ومتخصصة",
              "مراجعة وصياغة العقود القانونية",
              "متابعة مستمرة وإشعارات الجلسات",
              "دعم فني واستشاري عبر المنصة"
            ]);

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col justify-between rounded-3xl p-6 sm:p-8 transition-all duration-300 border ${
                  isPopular
                    ? "border-gold bg-gradient-to-b from-gold/15 via-surface to-surface shadow-2xl shadow-gold/10 ring-1 ring-gold scale-[1.02]"
                    : "border-border/60 bg-surface/90 hover:border-gold-soft/60 shadow-lg"
                }`}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gold-gradient text-primary-foreground text-xs font-bold px-4 py-1 rounded-full shadow-md flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    الباقة الأكثر طلباً للشركات
                  </div>
                )}

                <div>
                  <div className="mb-4">
                    <h3 className="text-xl font-bold font-display text-foreground mb-2">
                      {plan.name_ar || plan.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-foreground/65 leading-relaxed min-h-[40px]">
                      {plan.description || "تغطية استشارية وقضائية متكاملة مصممة لأجلك."}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="my-6 pb-6 border-b border-border/40">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl sm:text-4xl font-extrabold text-foreground">
                        {price.toLocaleString("ar-EG")}
                      </span>
                      <span className="text-sm font-semibold text-gold">ج.م</span>
                      <span className="text-xs text-foreground/60">/ شهرياً</span>
                    </div>
                    <p className="text-[11px] text-foreground/50 mt-1">تجديد شهري مرن — إمكانية الإلغاء أو الترقية في أي وقت</p>
                  </div>

                  {/* Features list */}
                  <div className="space-y-3 mb-8">
                    <p className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">
                      المزايا المتضمنة في الباقة:
                    </p>
                    <ul className="space-y-2.5">
                      {features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground/85">
                          <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-gold/15 text-gold flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Action button */}
                <div className="pt-4 border-t border-border/40 mt-auto">
                  <Link
                    to="/dashboard/client/plans/$id"
                    params={{ id: String(plan.id) }}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition duration-200 ${
                      isPopular
                        ? "bg-gold-gradient text-primary-foreground shadow-gold hover:opacity-95"
                        : "bg-surface hover:bg-gold/15 text-foreground border border-gold-soft/60"
                    }`}
                  >
                    <span>طلب اشتراك في الباقة</span>
                    <ArrowLeft className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trust & Guarantee Box */}
      <div className="rounded-2xl border border-border/40 bg-surface/50 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold flex-shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-foreground text-sm">ضمان الجودة والسرية التامة</h4>
            <p className="text-xs text-foreground/60 mt-0.5">
              جميع الاستشارات والخدمات القانونية موثقة ومعتمدة وتخضع لميثاق شرف المحاماة المصري وسرية البيانات.
            </p>
          </div>
        </div>

        <Link
          to="/dashboard/client/messages"
          className="text-xs text-gold hover:underline font-semibold flex items-center gap-1"
        >
          <span>تواصل مع الدعم القانوني للاستفسارات الخاصة</span>
          <ChevronRight className="w-3.5 h-3.5 rotate-180" />
        </Link>
      </div>
    </div>
  );
}
