import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Scale, Sparkles, ShieldCheck, Users, Heart, Award, CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { apiGetPage } from "@/lib/laravel";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "من نحن — الوكيل" },
      { name: "description", content: "الوكيل: رسالتنا تمكين المحامي المصري بأدوات حديثة وذكاء اصطناعي يفهم القانون المصري." },
      { property: "og:title", content: "من نحن — الوكيل" },
      { property: "og:description", content: "أول منصة قانونية ذكية في مصر — والله خير وكيل." },
    ],
  }),
  component: AboutPage,
});

const ICON_MAP: Record<string, any> = {
  ShieldCheck,
  Sparkles,
  Users,
  Heart,
  Scale,
  Award,
  CheckCircle,
};

const DEFAULT_VALUES = [
  { icon: "ShieldCheck", title: "الموثوقية", text: "بياناتك محمية ومعتمدة. كل المحامين موثّقون من النقابة." },
  { icon: "Sparkles", title: "الذكاء", text: "مساعد قانوني مدرَّب على القانون المصري ومُحدَّث بأحدث التشريعات." },
  { icon: "Users", title: "المجتمع", text: "نربط الموكّل بالمحامي المناسب، ونمكّن المحامي بإدارة كاملة لممارسته." },
  { icon: "Heart", title: "الإنسانية", text: "العدالة حقّ — نسعى لتسهيل الوصول إليها لكل مصري." },
];

const DEFAULT_STATS = [
  { label: "محامٍ ومستشار معتمد", value: "+500" },
  { label: "استشارة قانونية منجزة", value: "+15,000" },
  { label: "محافظة مغطاة في مصر", value: "27" },
  { label: "نسبة رضا الموكلين", value: "98%" },
];

function AboutPage() {
  const [page, setPage] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiGetPage("about");
        if (active && data) {
          setPage(data);
        }
      } catch (err) {
        // Fallback to defaults
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const title = page?.title || "رسالتنا";
  const missionText = page?.content || "الوكيل هو أول منصة قانونية ذكية في مصر، نجمع بين خبرة المحامي المصري وقوة الذكاء الاصطناعي لنوفّر تجربة قانونية حديثة، شفّافة، ومتاحة للجميع. نؤمن أن العدالة لا يجب أن تكون رفاهية، وأن التكنولوجيا قادرة على تقصير المسافة بين الموكّل والمحامي.";
  const values = Array.isArray(page?.meta?.values) && page.meta.values.length > 0
    ? page.meta.values
    : DEFAULT_VALUES;
  const stats = Array.isArray(page?.meta?.stats) && page.meta.stats.length > 0
    ? page.meta.stats
    : DEFAULT_STATS;
  const cta = page?.meta?.cta || {
    title: "انضم إلينا اليوم",
    subtitle: "سواء كنت محامياً تبحث عن أدوات احترافية، أو موكّلاً تبحث عن استشارة موثوقة.",
    button_text: "ابدأ الآن مجاناً",
    button_url: "/auth",
  };

  return (
    <div className="min-h-screen flex flex-col" dir="rtl">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero / Mission */}
        <section className="islamic-pattern border-b border-gold-soft/30">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
            <div className="inline-flex p-3 rounded-2xl bg-gold/10 border border-gold/30 mb-6">
              <Scale className="h-12 w-12 text-gold" />
            </div>
            <div className="flex items-center justify-center gap-3 mb-6">
              <h1 className="font-display text-4xl sm:text-6xl text-gradient-gold font-bold">{title}</h1>
              {loading && <Loader2 className="w-6 h-6 text-gold animate-spin" />}
            </div>
            {page?.subtitle && (
              <p className="text-sm sm:text-base text-gold/90 font-medium mb-4 max-w-2xl mx-auto">
                {page.subtitle}
              </p>
            )}
            <p className="text-foreground/80 text-lg leading-relaxed max-w-3xl mx-auto whitespace-pre-line">
              {missionText}
            </p>
          </div>
        </section>

        {/* Stats Section */}
        {stats.length > 0 && (
          <section className="border-b border-gold-soft/20 bg-surface/50 backdrop-blur-sm">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                {stats.map((s: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-xl bg-elevated/40 border border-gold-soft/20">
                    <div className="font-display text-3xl sm:text-4xl text-gradient-gold font-extrabold mb-1">
                      {s.value}
                    </div>
                    <div className="text-xs sm:text-sm text-foreground/70 font-medium">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Values Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl text-gradient-gold font-bold mb-3">قيمنا ومبادئنا</h2>
            <p className="text-sm text-foreground/60 max-w-xl mx-auto">
              المبادئ الأساسية التي نسترشد بها في تطوير خدمات المنصة وخدمة المجتمع القانوني في مصر
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v: any, idx: number) => {
              const IconComp = ICON_MAP[v.icon] || ShieldCheck;
              return (
                <div key={v.title ?? idx} className="bg-surface border border-gold-soft/40 hover:border-gold rounded-2xl p-6 text-center transition-all hover:shadow-gold duration-300">
                  <div className="inline-flex p-3 rounded-xl bg-gold/10 border border-gold/20 mb-4">
                    <IconComp className="h-8 w-8 text-gold" />
                  </div>
                  <h3 className="font-display text-xl text-foreground font-semibold mb-2">{v.title}</h3>
                  <p className="text-foreground/70 text-sm leading-relaxed">{v.text || v.content}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Call to Action */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
          <div className="bg-surface border border-gold-soft/40 rounded-3xl p-10 sm:p-14 shadow-gold relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-60 h-60 bg-gold/10 rounded-full blur-3xl pointer-events-none" />
            <h2 className="font-display text-3xl sm:text-4xl text-gradient-gold font-bold mb-4">{cta.title}</h2>
            <p className="text-foreground/70 mb-8 max-w-xl mx-auto leading-relaxed">{cta.subtitle}</p>
            <Link
              to={cta.button_url || "/auth"}
              search={{ returnUrl: undefined, invite: undefined, type: undefined }}
              className="inline-flex items-center gap-2 bg-gold-gradient animate-shimmer text-primary-foreground font-semibold px-8 py-3.5 rounded-xl shadow-gold hover:scale-[1.03] transition"
            >
              <span>{cta.button_text || "ابدأ الآن مجاناً"}</span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

