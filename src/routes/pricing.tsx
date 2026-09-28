import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Sparkles, X, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SUPPORT_EMAIL, supportContactUrl, supportIsWhatsapp } from "@/lib/support";
import { createPaymentIntention } from "@/lib/payments";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "خطط الاشتراك — الوكيل" },
      { name: "description", content: "خطط اشتراك الوكيل للمحامين والمكاتب القانونية في مصر. ابدأ مجاناً." },
      { property: "og:title", content: "الأسعار — الوكيل" },
      { property: "og:description", content: "خطط مرنة تناسب المحامي الفردي والمكاتب الكبرى." },
    ],
  }),
  component: PricingPage,
});

type Plan = {
  id: string; name: string; price: string; period: string;
  desc: string; features: string[]; cta: string; highlight: boolean;
  action: "signup" | "subscribe" | "contact";
};

const PLANS: Plan[] = [
  { id: "trial", name: "تجريبي", price: "0", period: "3 أيام", desc: "جرّب المنصة بالكامل مجاناً لمدة 3 أيام",
    features: ["كل المزايا مفتوحة", "قضايا وموكلين بلا حد", "تحليلات ذكية", "ينتهي تلقائياً بعد 3 أيام"],
    cta: "ابدأ التجربة", highlight: false, action: "signup" },
  { id: "basic", name: "أساسي", price: "500", period: "شهرياً", desc: "للمحامي الفردي النشط",
    features: ["قضايا وموكلين بلا حد", "إدارة جلسات وتنبيهات", "فواتير ومستندات", "تحليلات ذكية"],
    cta: "اشترك الآن", highlight: false, action: "subscribe" },
  { id: "pro", name: "احترافي", price: "650", period: "شهرياً", desc: "الأكثر شعبية — مزايا موسّعة",
    features: ["كل مزايا الأساسي", "ظهور مميّز في السوق", "تقارير وإحصائيات", "أولوية الدعم"],
    cta: "اشترك الآن", highlight: true, action: "subscribe" },
  { id: "office", name: "مكتب", price: "845", period: "شهرياً", desc: "للمكاتب والفرق القانونية",
    features: ["كل مزايا الاحترافي", "حسابات فريق وصلاحيات", "تكامل API", "مدير حساب مخصّص"],
    cta: "اشترك الآن", highlight: false, action: "subscribe" },
];

function PricingPage() {
  const [selected, setSelected] = useState<Plan | null>(null);
  const [paying, setPaying] = useState(false);

  async function payNow(plan: Plan) {
    if (!["basic", "pro", "office"].includes(plan.id)) return;
    setPaying(true);
    try {
      const res = await createPaymentIntention({
        purpose: "subscription",
        plan: plan.id as "basic" | "pro" | "office",
      });
      if (!res.available) {
        if (res.reason === "unauthenticated") {
          toast.error("سجّل الدخول أولاً لإتمام الدفع");
          return;
        }
        if (res.reason === "rate_limited" || res.status === 429) {
          toast.error("حاول مرة أخرى بعد قليل");
          return;
        }
        // Fallback: WhatsApp — payment gateway not configured yet
        window.open(
          supportContactUrl(`أرغب في الاشتراك في خطة ${plan.name} (${plan.price} ج.م / ${plan.period})`),
          "_blank",
        );
        return;
      }
      window.location.href = res.checkout_url;
    } catch (e) {
      toast.error("تعذّر بدء الدفع — تواصل معنا عبر واتساب");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="islamic-pattern flex-1">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold-soft bg-gold/5 text-gold text-xs mb-6">
            <Sparkles className="h-3 w-3" /> أسعار شفافة بدون رسوم خفية
          </div>
          <h1 className="font-display text-4xl sm:text-6xl text-gradient-gold font-bold mb-4">خطط تناسب الجميع</h1>
          <p className="text-foreground/70 max-w-2xl mx-auto">
            من المحامي الفردي إلى المكتب الكبير — اختر الخطة التي تناسب ممارستك القانونية وابدأ اليوم.
          </p>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((p) => (
            <div key={p.id} className={`relative rounded-2xl border p-6 flex flex-col ${
              p.highlight ? "border-gold bg-gradient-to-b from-gold/10 to-transparent shadow-gold scale-[1.02]" : "border-gold-soft bg-surface"
            }`}>
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold-gradient text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                  الأكثر شعبية
                </div>
              )}
              <h3 className="font-display text-2xl text-gradient-gold font-bold">{p.name}</h3>
              <p className="text-xs text-foreground/60 mt-1 mb-4">{p.desc}</p>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="font-display text-5xl text-foreground font-bold">{p.price}</span>
                <span className="text-foreground/60 text-sm">ج.م / {p.period}</span>
              </div>
              <ul className="space-y-3 mb-6 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground/85">
                    <Check className="h-4 w-4 text-gold mt-0.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              {p.action === "signup" ? (
                <Link to="/auth" search={{ returnUrl: undefined, invite: undefined, type: undefined }} className={`text-center font-semibold py-3 rounded-xl transition border border-gold/40 text-gold hover:bg-gold/10`}>
                  {p.cta}
                </Link>
              ) : p.action === "contact" ? (
                <a
                  href={supportContactUrl(`أرغب في الاشتراك في خطة ${p.name} للمكاتب`)}
                  target={supportIsWhatsapp() ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="text-center font-semibold py-3 rounded-xl transition border border-gold/40 text-gold hover:bg-gold/10">
                  {p.cta}
                </a>
              ) : (
                <button onClick={() => setSelected(p)}
                  className={`text-center font-semibold py-3 rounded-xl transition ${
                    p.highlight ? "bg-gold-gradient text-primary-foreground shadow-gold hover:scale-[1.02]" : "border border-gold/40 text-gold hover:bg-gold/10"
                  }`}>
                  {p.cta}
                </button>
              )}
            </div>
          ))}
        </section>

        <p className="text-center text-xs text-foreground/50 max-w-2xl mx-auto px-4 pb-16">
          الأسعار بالجنيه المصري — الدفع عبر {supportIsWhatsapp() ? "واتساب" : "البريد الإلكتروني"} حالياً — قريباً: بطاقات ائتمان وخصم مباشر.
        </p>
      </main>
      <SiteFooter />

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-md w-full shadow-gold relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelected(null)} className="absolute top-3 left-3 text-foreground/60 hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display text-2xl text-gradient-gold font-bold mb-2">خطة {selected.name}</h3>
            <div className="text-foreground/70 text-sm mb-1">{selected.desc}</div>
            <div className="flex items-baseline gap-2 mb-5">
              <span className="font-display text-4xl text-gold font-bold">{selected.price}</span>
              <span className="text-foreground/60 text-sm">ج.م / {selected.period}</span>
            </div>
            <div className="bg-gold/5 border border-gold/20 rounded-xl p-4 text-sm text-foreground/85 leading-relaxed mb-5">
              ادفع الآن بالفيزا أو المحفظة الإلكترونية أو فوري — التفعيل تلقائي بعد الدفع.
              وإن تعذّر ذلك فسنُحوّلك للتواصل عبر واتساب.
            </div>
            <button
              onClick={() => payNow(selected)}
              disabled={paying}
              className="w-full inline-flex items-center justify-center gap-2 bg-gold-gradient text-primary-foreground font-semibold py-3 rounded-xl shadow-gold hover:scale-[1.02] transition disabled:opacity-50 mb-2">
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              ادفع الآن ({selected.price} ج.م)
            </button>
            <a
              href={supportContactUrl(`أرغب في الاشتراك في خطة ${selected.name} (${selected.price} ج.م / ${selected.period})`)}
              target={supportIsWhatsapp() ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="block text-center border border-gold/40 text-gold font-medium py-2.5 rounded-xl hover:bg-gold/10 transition text-sm">
              {supportIsWhatsapp() ? "تواصل عبر واتساب بدلاً من ذلك" : `راسلنا على ${SUPPORT_EMAIL}`}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
