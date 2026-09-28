import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/alwakeel-logo.jpeg";
import { Scale, Briefcase, Sparkles, Users, ShieldCheck, Gavel, ArrowLeft, Search } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "الوكيل — Al-Wakeel | منصة قانونية ذكية" },
      { name: "description", content: "الوكيل — أول منصة قانونية ذكية في مصر. إدارة مكاتب المحاماة، سوق قانوني، ومساعد قانوني بالذكاء الاصطناعي." },
      { property: "og:title", content: "الوكيل — Al-Wakeel" },
      { property: "og:description", content: "والله خير وكيل — منصة قانونية ذكية متكاملة." },
    ],
  }),
  component: Index,
});

function Arch({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 120" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5 118 V60 Q5 5 50 5 Q95 5 95 60 V118" />
    </svg>
  );
}

function Index() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <SiteHeader />




      {/* Hero */}
      <section className="relative islamic-pattern">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-32 grid lg:grid-cols-2 gap-16 items-center">
          <div className="animate-fade-up text-right">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold-soft bg-gold/5 text-gold text-xs mb-8">
              <Sparkles className="h-3 w-3" />
              أول منصة قانونية ذكية في مصر
            </div>

            <h1 className="font-display text-6xl md:text-7xl font-bold leading-[1.1] mb-6">
              <span className="text-foreground">العدالة</span>{" "}
              <span className="text-gradient-gold animate-shimmer">بين يديك</span>
            </h1>

            <p className="text-lg text-foreground/70 leading-relaxed mb-3 max-w-xl mr-0 ml-auto">
              منصة متكاملة تجمع إدارة مكاتب المحاماة، السوق القانوني، ومساعد ذكي يفهم القانون المصري — كل ذلك في مكان واحد.
            </p>
            <p className="font-display text-2xl text-gold/90 italic mb-10">— والله خير وكيل —</p>

            <div className="flex flex-wrap gap-4 justify-end">
              <Link to="/marketplace" className="bg-gold-gradient animate-shimmer text-primary-foreground font-semibold px-8 py-4 rounded-lg shadow-gold inline-flex items-center gap-2 hover:scale-105 transition-transform">
                ابحث عن محامي
                <Search className="h-4 w-4" />
              </Link>
              <Link to="/ai-assistant" className="border border-gold/50 text-gold font-semibold px-8 py-4 rounded-lg hover:bg-gold/10 transition inline-flex items-center gap-2">
                المساعد الذكي
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>


            <div className="grid grid-cols-3 gap-8 mt-16 pt-10 border-t border-gold-soft/40">
              {[
                { k: "2025", v: "انطلاقتنا" },
                { k: "100%", v: "محامون موثّقون" },
                { k: "24/7", v: "مساعد قانوني ذكي" },
              ].map((s) => (
                <div key={s.v} className="text-right">
                  <div className="font-display text-3xl text-gradient-gold font-bold">{s.k}</div>
                  <div className="text-xs text-foreground/60 mt-1">{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Logo showcase */}
          <div className="relative flex items-center justify-center animate-float">
            <div className="absolute inset-0 bg-gold/20 blur-[120px] rounded-full" />
            <div className="absolute inset-8 bg-gold/10 blur-[80px] rounded-full" />
            <Arch className="absolute inset-0 w-full h-full text-gold/15" />
            <div className="relative">
              <img
                src={logo}
                alt="الوكيل Al-Wakeel"
                className="relative w-[440px] h-[440px] object-cover rounded-3xl ring-1 ring-gold/40 shadow-gold"
              />
              <div className="absolute -inset-1 rounded-3xl ring-1 ring-gold/20 pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-28 bg-overlay/40 border-y border-gold-soft/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <Arch className="mx-auto h-16 w-12 text-gold/60 mb-4" />
            <h2 className="font-display text-5xl font-bold text-gradient-gold mb-4">ثلاث منصات في واحدة</h2>
            <p className="text-foreground/70 max-w-2xl mx-auto">
              نظام متكامل يخدم المحامين، الموكلين، والباحثين عن استشارة قانونية موثوقة
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Briefcase,
                title: "إدارة مكتب المحاماة",
                desc: "نظام شامل لإدارة القضايا، الموكلين، المواعيد، والفواتير في لوحة واحدة احترافية.",
                tag: "للمحامين",
              },
              {
                icon: Users,
                title: "السوق القانوني",
                desc: "ابحث وقارن بين أفضل المحامين في مصر حسب التخصص، التقييمات، والأسعار.",
                tag: "للموكلين",
              },
              {
                icon: Sparkles,
                title: "المساعد الذكي",
                desc: "ذكاء اصطناعي مدرّب على القانون المصري للإجابة على أسئلتك القانونية فوراً.",
                tag: "بالذكاء الاصطناعي",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group relative bg-surface/80 border border-border hover:border-gold/50 rounded-2xl p-8 transition-all hover:-translate-y-1 hover:shadow-gold"
              >
                <Arch className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-7 text-gold/30 group-hover:text-gold/60 transition" />
                <div className="text-xs text-gold/70 mb-4">{f.tag}</div>
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-gold/10 border border-gold/30 mb-6 group-hover:bg-gold/20 transition">
                  <f.icon className="h-7 w-7 text-gold" />
                </div>
                <h3 className="font-display text-2xl text-foreground mb-3">{f.title}</h3>
                <p className="text-foreground/70 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display text-4xl font-bold text-foreground mb-6">
              قانون مصري. <span className="text-gradient-gold">ذكاء عالمي.</span>
            </h2>
            <p className="text-foreground/70 leading-relaxed mb-8">
              مدعوم بأحدث نماذج الذكاء الاصطناعي ومتوافق تماماً مع التشريعات المصرية. كل استشارة سرية، كل قضية موثقة، وكل محامي معتمد.
            </p>
            <div className="space-y-4">
              {[
                { icon: ShieldCheck, t: "خصوصية تامة", d: "تشفير من طرف إلى طرف لكل بياناتك" },
                { icon: Gavel, t: "محامون معتمدون", d: "تحقق من نقابة المحامين المصرية" },
                { icon: Scale, t: "شفافية كاملة", d: "أسعار واضحة وتقييمات حقيقية" },
              ].map((i) => (
                <div key={i.t} className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
                    <i.icon className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{i.t}</div>
                    <div className="text-sm text-foreground/60">{i.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative bg-elevated border border-gold-soft rounded-2xl p-8 shadow-gold">
            <Arch className="absolute -top-4 left-1/2 -translate-x-1/2 h-10 w-8 text-gold/50 bg-background" />
            <div className="text-center">
              <div className="font-display text-7xl text-gradient-gold mb-2">⚖</div>
              <div className="font-display text-3xl text-foreground mb-3">والله خير وكيل</div>
              <div className="h-px w-24 bg-gold/40 mx-auto my-6" />
              <p className="text-foreground/70 italic font-display text-lg leading-relaxed">
                "العدل أساس الملك. نبني منصة تجعل الحق في متناول كل مصري — بسرعة، بشفافية، وبأمان."
              </p>
              <div className="mt-6 text-xs tracking-[0.3em] text-gold/70">— فريق الوكيل —</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="py-24 relative islamic-pattern">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Arch className="mx-auto h-20 w-16 text-gold/50 mb-6" />
          <h2 className="font-display text-5xl font-bold text-gradient-gold mb-6">ابدأ رحلتك القانونية</h2>
          <p className="text-foreground/70 text-lg mb-10 max-w-2xl mx-auto">
            انضم إلى آلاف المحامين والموكلين الذين يثقون بالوكيل لإدارة شؤونهم القانونية
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/auth" search={{ returnUrl: undefined, invite: undefined, type: undefined }} className="bg-gold-gradient animate-shimmer text-primary-foreground font-semibold px-10 py-4 rounded-lg shadow-gold hover:scale-105 transition-transform">
              سجّل كموكّل
            </Link>
            <Link to="/auth" search={{ returnUrl: undefined, invite: undefined, type: undefined }} className="border border-gold/50 text-gold font-semibold px-10 py-4 rounded-lg hover:bg-gold/10 transition">
              سجّل كمحامي
            </Link>
          </div>

        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
