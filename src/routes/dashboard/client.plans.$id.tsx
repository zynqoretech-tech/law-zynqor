import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Shield,
  CreditCard,
  Building2,
  Smartphone,
  Banknote,
  Copy,
  CheckCheck,
  Loader2,
  AlertCircle,
  FileText,
  Sparkles,
  Info,
  Database,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/laravel";

export const Route = createFileRoute("/dashboard/client/plans/$id")({
  head: () => ({ meta: [{ title: "طلب اشتراك في الباقة — زنقور للمحاماة" }] }),
  component: PlanCheckoutPage,
});

type PaymentChannel = {
  id: number | string;
  key: string;
  type: "bank" | "instapay" | "wallet" | "card" | "cash";
  name_ar: string;
  bank_name?: string;
  account_name?: string;
  branch?: string;
  account_number?: string;
  iban?: string;
  swift_code?: string;
  instapay_ipa?: string;
  wallet_number?: string;
  instructions_ar?: string;
  is_active: boolean;
  available_for_orders: boolean;
};

const DEFAULT_METHODS: PaymentChannel[] = [
  {
    id: 1,
    key: "cib_bank",
    type: "bank",
    name_ar: "تحويل بنكي رسمي (CIB / الأهلي / بنك مصر)",
    bank_name: "البنك التجاري الدولي (CIB)",
    account_name: "شركة زنقور للمحاماة والاستشارات القانونية ذ.م.م",
    branch: "الفرع الرئيسي - القاهرة",
    account_number: "100048291048",
    iban: "EG3800100004829104800000000000",
    swift_code: "CIBEEGCX",
    instructions_ar: "يرجى تحويل مبلغ الاشتراك إلى الحساب البنكي الرسمي وإدخال رقم الحساب في خانة الملاحظات لتأكيد التفعيل.",
    is_active: true,
    available_for_orders: true,
  },
  {
    id: 2,
    key: "instapay",
    type: "instapay",
    name_ar: "إنستاباي InstaPay (التحويل اللحظي المباشر)",
    instapay_ipa: "zynqor@instapay",
    wallet_number: "01005544332",
    instructions_ar: "قم بالتحويل عبر تطبيق إنستاباي إلى المعرف (IPA) الموضح أعلاه مباشرة بدون أي رسوم إضافية.",
    is_active: true,
    available_for_orders: true,
  },
  {
    id: 3,
    key: "mobile_wallets",
    type: "wallet",
    name_ar: "محافظ الهاتف المحمول (فودافون كاش / أورنج / وي / اتصالات)",
    wallet_number: "01005544332",
    instructions_ar: "حول قيمة الاشتراك إلى رقم المحفظة المعتمد من أي محفظة كاش إلكترونية.",
    is_active: true,
    available_for_orders: true,
  },
  {
    id: 4,
    key: "card_gateway",
    type: "card",
    name_ar: "بطاقة دفع إلكتروني (Visa / Mastercard / Meeza)",
    instructions_ar: "الدفع الآمن والمشفر عبر البطاقات البنكية وبطاقات ميزة الوطنية.",
    is_active: true,
    available_for_orders: true,
  },
  {
    id: 5,
    key: "cod_cash",
    type: "cash",
    name_ar: "الدفع نقداً بمقر الشركة أو عبر المندوب",
    instructions_ar: "سداد قيمة الاشتراك نقداً بمقر شركة زنقور للمحاماة أو عبر مندوب التحصيل المعتمد.",
    is_active: true,
    available_for_orders: true,
  },
];

const DEFAULT_PLANS_FALLBACK = [
  {
    id: 1,
    name: "باقة الاستشارات الشخصية للأفراد",
    name_ar: "باقة الاستشارات الشخصية للأفراد",
    price: 450,
    price_monthly: 450,
    currency: "EGP",
    billing_interval: "monthly",
    description: "تغطية قانونية متكاملة للأفراد، صياغة ومراجعة العقود الشخصية، واستشارات فورية على مدار الشهر.",
  },
  {
    id: 2,
    name: "باقة الشركات والرواد (Business Plan)",
    name_ar: "باقة الشركات والرواد (Business Plan)",
    price: 2400,
    price_monthly: 2400,
    currency: "EGP",
    billing_interval: "monthly",
    description: "الحل الأمثل للشركات الناشئة والمتوسطة لحماية الأعمال، العقود التجارية، والامتثال القانوني الكامل.",
  },
  {
    id: 3,
    name: "باقة المؤسسات والتمثيل القضائي (Corporate Enterprise)",
    name_ar: "باقة المؤسسات والتمثيل القضائي (Corporate Enterprise)",
    price: 6500,
    price_monthly: 6500,
    currency: "EGP",
    billing_interval: "monthly",
    description: "إدارة قانونية شاملة للكيانات الكبرى، نزاعات المحاكم، التحكيم التجاري، وصياغة السياسات والحوكمة.",
  },
];

function PlanCheckoutPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const rawId = String(params?.id || "1").trim();
  const cleanId = (!rawId || rawId === "{id}" || rawId === "%7Bid%7D" || isNaN(Number(rawId))) ? "1" : rawId;

  const navigate = useNavigate();
  const { user } = useAuth();

  const [allPlans, setAllPlans] = useState<any[]>(DEFAULT_PLANS_FALLBACK);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(cleanId);
  const [plan, setPlan] = useState<any>(null);
  const [channels, setChannels] = useState<PaymentChannel[]>(DEFAULT_METHODS);
  const [selectedChannelKey, setSelectedChannelKey] = useState<string>("cib_bank");
  const [clientNotes, setClientNotes] = useState<string>("");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // 1. Fetch Plans directly from DB
        let plansList: any[] = [];
        try {
          const rawPlans = await apiFetch("/subscription-plans");
          plansList = Array.isArray(rawPlans) ? rawPlans : rawPlans?.data || [];
        } catch {}

        if (!plansList.length) {
          try {
            const { data } = await supabase.from("subscription_plans").select("*");
            if (Array.isArray(data) && data.length > 0) {
              plansList = data;
            }
          } catch {}
        }

        if (plansList.length > 0) {
          setAllPlans(plansList);
          setIsDbLoaded(true);
          const currentPlan = plansList.find((p: any) => String(p.id) === String(cleanId)) || plansList[0];
          setPlan(currentPlan);
          setSelectedPlanId(String(currentPlan.id));
        } else {
          setAllPlans(DEFAULT_PLANS_FALLBACK);
          const currentPlan = DEFAULT_PLANS_FALLBACK.find((p: any) => String(p.id) === String(cleanId)) || DEFAULT_PLANS_FALLBACK[0];
          setPlan(currentPlan);
          setSelectedPlanId(String(currentPlan.id));
        }

        // 2. Fetch Payment Methods directly from DB
        let methodsList: any[] = [];
        try {
          const rawMethods = await apiFetch("/payment-methods");
          methodsList = Array.isArray(rawMethods) ? rawMethods : rawMethods?.data || [];
        } catch {}

        if (!methodsList.length) {
          try {
            const { data } = await supabase.from("payment_methods").select("*");
            if (Array.isArray(data) && data.length > 0) {
              methodsList = data;
            }
          } catch {}
        }

        if (methodsList.length > 0) {
          const activeMethods = methodsList.filter((m: any) => m.is_active);
          const finalChannels = activeMethods.length > 0 ? activeMethods : methodsList;
          setChannels(finalChannels);
          if (finalChannels[0]?.key) {
            setSelectedChannelKey(finalChannels[0].key);
          }
        } else {
          setChannels(DEFAULT_METHODS);
          setSelectedChannelKey("cib_bank");
        }
      } catch (err) {
        console.error("Error loading checkout data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [cleanId]);

  const handleSelectPlan = (p: any) => {
    setSelectedPlanId(String(p.id));
    setPlan(p);
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`تم نسخ ${fieldName} بنجاح`);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleSubscribe = async () => {
    setSubmitting(true);
    try {
      const activeChannel = channels.find((c) => c.key === selectedChannelKey) || channels[0] || DEFAULT_METHODS[0];
      const targetPlanId = plan?.id || selectedPlanId || cleanId;

      const payload = {
        subscription_plan_id: targetPlanId,
        plan_id: targetPlanId,
        payment_method_id: activeChannel?.id,
        payment_method_key: selectedChannelKey,
        payment_method_name: activeChannel?.name_ar,
        payment_method: activeChannel?.name_ar || selectedChannelKey,
        client_message: clientNotes,
        message: clientNotes,
        notes: clientNotes,
        transaction_reference: transactionRef,
      };

      try {
        await apiFetch("/plan-requests", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } catch {
        await supabase.from("plan_payment_requests").insert(payload);
      }

      toast.success("تم إرسال طلب الاشتراك بنجاح! سيتم فحص التحويل وتفعيل الباقة فور اعتماد الإدارة.");
      navigate({ to: "/dashboard/client/my-plans" });
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ أثناء تسجيل طلب الاشتراك. يرجى المحاولة مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  };

  const activeChannel = channels.find((c) => c.key === selectedChannelKey) || channels[0] || DEFAULT_METHODS[0];

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "bank":
        return <Building2 className="w-5 h-5 text-amber-500" />;
      case "instapay":
        return <Sparkles className="w-5 h-5 text-amber-400" />;
      case "wallet":
        return <Smartphone className="w-5 h-5 text-amber-500" />;
      case "card":
        return <CreditCard className="w-5 h-5 text-amber-400" />;
      case "cash":
        return <Banknote className="w-5 h-5 text-amber-500" />;
      default:
        return <CreditCard className="w-5 h-5 text-amber-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28">
        <Loader2 className="w-8 h-8 animate-spin text-gold mb-3" />
        <p className="text-sm text-foreground/60">جاري تحميل بيانات الباقة من قاعدة البيانات...</p>
      </div>
    );
  }

  const currentPlan = plan || allPlans.find((p) => String(p.id) === String(selectedPlanId)) || allPlans[0];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Header and Back navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Link
          to="/dashboard/client/plans"
          className="inline-flex items-center gap-2 text-xs font-semibold text-foreground/70 hover:text-gold transition"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى جميع الباقات القانونية</span>
        </Link>

        {isDbLoaded && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <Database className="w-3.5 h-3.5" />
            <span>بيانات حية مباشرة من قاعدة البيانات (subscription_plans)</span>
          </div>
        )}
      </div>

      {/* Interactive Plan Selector Bar */}
      <div className="rounded-3xl border border-border/60 bg-surface/90 p-5 shadow-lg">
        <div className="flex items-center gap-2.5 mb-3 text-xs font-bold text-foreground">
          <Layers className="w-4 h-4 text-gold" />
          <span>اختر أو غيّر الباقة المراد الاشتراك بها من قاعدة البيانات:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {allPlans.map((p) => {
            const isSelected = String(p.id) === String(selectedPlanId);
            const price = Number(p.price_monthly ?? p.price ?? 0);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPlan(p)}
                className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                  isSelected
                    ? "border-gold bg-gold/15 ring-2 ring-gold/80 shadow-md"
                    : "border-border/60 bg-surface/60 hover:border-gold-soft/50 hover:bg-surface"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-bold text-xs text-foreground line-clamp-1">{p.name_ar || p.name}</span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-gold text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-base font-extrabold text-foreground">{price.toLocaleString("ar-EG")}</span>
                  <span className="text-[11px] font-semibold text-gold">ج.م / شهرياً</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form & Payment Channel (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section 1: Choose Payment Method */}
          <div className="rounded-3xl border border-border/60 bg-surface/90 p-6 sm:p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/40">
              <div className="w-10 h-10 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold font-display text-foreground">
                  اختر طريقة وقناة الدفع المعتمدة
                </h2>
                <p className="text-xs text-foreground/60">
                  حدد القناة المفضلة لديك لتحويل وسداد رسوم الاشتراك ({channels.length} قنوات مسجلة بالنظام)
                </p>
              </div>
            </div>

            {/* Channels List Radios */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {channels.map((ch) => {
                const isSelected = ch.key === selectedChannelKey;
                return (
                  <button
                    key={ch.key}
                    type="button"
                    onClick={() => setSelectedChannelKey(ch.key)}
                    className={`flex items-start gap-3 p-4 rounded-2xl border text-right transition-all ${
                      isSelected
                        ? "border-gold bg-gold/10 ring-1 ring-gold shadow-md"
                        : "border-border/60 bg-surface hover:border-gold-soft/50"
                    }`}
                  >
                    <div className="mt-0.5">{getChannelIcon(ch.type)}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs sm:text-sm text-foreground">
                          {ch.name_ar}
                        </span>
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-gold text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                            ✓
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-foreground/55 capitalize mt-0.5 block">
                        {ch.type === "bank"
                          ? "حساب بنكي و IBAN"
                          : ch.type === "instapay"
                          ? "تحويل لحظي (IPA)"
                          : ch.type === "wallet"
                          ? "محافظ إلكترونية"
                          : ch.type === "card"
                          ? "فيزا / ماستركارد / ميزة"
                          : "دفع نقدي"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Channel Details Box */}
            {activeChannel && (
              <div className="rounded-2xl border border-gold-soft/40 bg-gold/5 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Info className="w-4 h-4 text-gold" />
                    بيانات السداد والتحويل:
                  </h3>
                  <span className="text-[11px] font-medium text-gold bg-gold/10 px-2.5 py-0.5 rounded-full border border-gold-soft/40">
                    قناة معتمدة رسميّاً
                  </span>
                </div>

                {/* Bank Details */}
                {activeChannel.type === "bank" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-foreground/55">اسم البنك:</span>
                      <p className="font-semibold text-foreground">{activeChannel.bank_name || "البنك التجاري الدولي (CIB)"}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-foreground/55">اسم صاحب الحساب:</span>
                      <p className="font-semibold text-foreground">{activeChannel.account_name || "شركة زنقور للمحاماة والاستشارات القانونية"}</p>
                    </div>

                    <div className="space-y-1 bg-surface/80 p-2.5 rounded-xl border border-border/40">
                      <span className="text-foreground/55">رقم الحساب البنكي:</span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-mono font-bold text-foreground text-sm tracking-wider">
                          {activeChannel.account_number || "100048291048"}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(activeChannel.account_number || "100048291048", "رقم الحساب")}
                          className="p-1 rounded hover:bg-gold/20 text-gold transition"
                          title="نسخ رقم الحساب"
                        >
                          {copiedField === "رقم الحساب" ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 bg-surface/80 p-2.5 rounded-xl border border-border/40">
                      <span className="text-foreground/55">الآيبان الدولي (IBAN):</span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-mono font-bold text-foreground text-xs break-all">
                          {activeChannel.iban || "EG3800100004829104800000000000"}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(activeChannel.iban || "EG3800100004829104800000000000", "رقم الآيبان")}
                          className="p-1 rounded hover:bg-gold/20 text-gold transition"
                          title="نسخ الآيبان"
                        >
                          {copiedField === "رقم الآيبان" ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {activeChannel.swift_code && (
                      <div className="space-y-1">
                        <span className="text-foreground/55">رمز السويفت (SWIFT):</span>
                        <p className="font-mono font-semibold text-foreground">{activeChannel.swift_code}</p>
                      </div>
                    )}

                    {activeChannel.branch && (
                      <div className="space-y-1">
                        <span className="text-foreground/55">الفرع:</span>
                        <p className="font-semibold text-foreground">{activeChannel.branch}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* InstaPay Details */}
                {activeChannel.type === "instapay" && (
                  <div className="space-y-3 text-xs">
                    <div className="bg-surface/80 p-3 rounded-xl border border-border/40 flex items-center justify-between">
                      <div>
                        <span className="text-foreground/55 text-[11px]">معرّف إنستاباي الرسمي (IPA):</span>
                        <p className="font-mono font-bold text-foreground text-sm mt-0.5">
                          {activeChannel.instapay_ipa || "zynqor@instapay"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(activeChannel.instapay_ipa || "zynqor@instapay", "معرف إنستاباي")}
                        className="px-3 py-1.5 rounded-lg bg-gold/10 hover:bg-gold/20 text-gold font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        {copiedField === "معرف إنستاباي" ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>نسخ المعرف</span>
                      </button>
                    </div>

                    {activeChannel.wallet_number && (
                      <div className="bg-surface/80 p-3 rounded-xl border border-border/40 flex items-center justify-between">
                        <div>
                          <span className="text-foreground/55 text-[11px]">رقم هاتف إنستاباي المرتبط:</span>
                          <p className="font-mono font-bold text-foreground text-sm mt-0.5">
                            {activeChannel.wallet_number}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(activeChannel.wallet_number || "", "رقم الهاتف")}
                          className="px-3 py-1.5 rounded-lg bg-gold/10 hover:bg-gold/20 text-gold font-bold text-xs flex items-center gap-1.5 transition"
                        >
                          {copiedField === "رقم الهاتف" ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>نسخ الرقم</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Mobile Wallet Details */}
                {activeChannel.type === "wallet" && (
                  <div className="space-y-3 text-xs">
                    <div className="bg-surface/80 p-3 rounded-xl border border-border/40 flex items-center justify-between">
                      <div>
                        <span className="text-foreground/55 text-[11px]">رقم المحفظة المعتمد (فودافون / أورنج / وي / اتصالات كاش):</span>
                        <p className="font-mono font-bold text-foreground text-base mt-0.5">
                          {activeChannel.wallet_number || "01005544332"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(activeChannel.wallet_number || "01005544332", "رقم المحفظة")}
                        className="px-3 py-1.5 rounded-lg bg-gold/10 hover:bg-gold/20 text-gold font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        {copiedField === "رقم المحفظة" ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>نسخ الرقم</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Instructions Text */}
                {activeChannel.instructions_ar && (
                  <div className="pt-2 border-t border-border/30 text-xs text-foreground/75 leading-relaxed">
                    <span className="font-semibold text-foreground ml-1">تعليمات التحويل:</span>
                    {activeChannel.instructions_ar}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Notes / Custom Message */}
          <div className="rounded-3xl border border-border/60 bg-surface/90 p-6 sm:p-8 shadow-xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-border/40">
              <div className="w-10 h-10 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold font-display text-foreground">
                  رسالة أو ملاحظات إضافية مع طلب الاشتراك
                </h2>
                <p className="text-xs text-foreground/60">
                  اكتب أي استفسار، متطلبات خاصة بشركتك، أو رقم الحوالة لتسريع تفعيل اشتراكك
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                  رقم العملية / مرجع التحويل أو رقم الهاتف المحول منه (اختياري لتسريع التأكيد):
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="مثال: مرجع إيداع إنستاباي 984210، رقم العملية البنكية، أو رقم محفظة فودافون كاش..."
                  className="w-full rounded-xl border border-border/60 bg-surface px-4 py-2.5 text-xs sm:text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                  رسالتك أو ملاحظاتك لإدارة شركة زنقور للمحاماة:
                </label>
                <textarea
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  rows={4}
                  placeholder="اكتب هنا أي تفاصيل تود إبلاغ المستشار القانوني بها (مثال: بيانات الشركة، نوع الاستشارات المطلوبة، استفسارات، أو متطلبات خاصة)..."
                  className="w-full rounded-2xl border border-border/60 bg-surface p-4 text-xs sm:text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition resize-y"
                />
                <p className="text-[11px] text-foreground/50 mt-1">
                  سيتم إرسال هذه الملاحظات مباشرة إلى الفريق الإداري والقانوني لشركة زنقور مع طلب الاشتراك.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="sticky top-20 rounded-3xl border border-gold-soft/40 bg-gradient-to-b from-surface via-surface to-gold/5 p-6 shadow-2xl">
            <h3 className="font-bold text-base font-display text-foreground mb-4 pb-3 border-b border-border/40 flex items-center justify-between">
              <span>ملخص طلب الاشتراك</span>
              <Sparkles className="w-4 h-4 text-gold" />
            </h3>

            {/* Plan Info */}
            <div className="space-y-3 mb-6">
              <div>
                <span className="text-[11px] text-foreground/50">الباقة المختارة:</span>
                <h4 className="font-bold text-foreground text-sm sm:text-base mt-0.5">
                  {currentPlan?.name_ar || currentPlan?.name}
                </h4>
              </div>

              <div>
                <span className="text-[11px] text-foreground/50">دورة الفوترة:</span>
                <p className="font-medium text-xs text-foreground">
                  تجديد شهري ({currentPlan?.billing_interval === "yearly" ? "سنوي" : "شهري"})
                </p>
              </div>

              <div>
                <span className="text-[11px] text-foreground/50">طريقة السداد المحددة:</span>
                <p className="font-medium text-xs text-gold">
                  {activeChannel?.name_ar || "تحويل رسمي"}
                </p>
              </div>
            </div>

            {/* Price breakdown */}
            <div className="pt-4 border-t border-border/40 space-y-2 mb-6 text-xs">
              <div className="flex justify-between text-foreground/70">
                <span>قيمة الباقة الشهرية:</span>
                <span className="font-semibold">{Number(currentPlan?.price_monthly ?? currentPlan?.price ?? 0).toLocaleString("ar-EG")} ج.م</span>
              </div>
              <div className="flex justify-between text-foreground/70">
                <span>ضريبة ورسوم المنصة:</span>
                <span className="text-emerald-500 font-semibold">مشمولة 0.00 ج.م</span>
              </div>

              <div className="pt-3 border-t border-border/50 flex justify-between items-baseline">
                <span className="font-bold text-sm text-foreground">المبلغ الإجمالي المستحق:</span>
                <div className="text-left">
                  <span className="text-2xl font-extrabold text-foreground">
                    {Number(currentPlan?.price_monthly ?? currentPlan?.price ?? 0).toLocaleString("ar-EG")}
                  </span>
                  <span className="text-xs font-semibold text-gold mr-1">ج.م</span>
                </div>
              </div>
            </div>

            {/* Confirm Button */}
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubscribe}
              className="w-full py-3.5 px-4 rounded-xl bg-gold-gradient text-primary-foreground font-bold text-sm shadow-gold hover:opacity-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري تسجيل الطلب...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>تأكيد وإرسال طلب الاشتراك</span>
                </>
              )}
            </button>

            {/* Security note */}
            <div className="mt-4 pt-4 border-t border-border/30 flex items-center gap-2 text-[11px] text-foreground/60">
              <Shield className="w-4 h-4 text-gold flex-shrink-0" />
              <span>دفع وتواصل آمن ومحمي 100% بنظام التشفير القانوني.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
