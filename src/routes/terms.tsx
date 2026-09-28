import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { apiGetPage } from "@/lib/laravel";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "شروط الاستخدام — الوكيل" },
      { name: "description", content: "الشروط والأحكام لاستخدام منصة الوكيل القانونية في مصر والشرق الأوسط." },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "شروط الاستخدام — الوكيل" },
      { property: "og:description", content: "الشروط والأحكام لاستخدام منصة الوكيل." },
    ],
  }),
  component: TermsPage,
});

interface SectionItem {
  id?: number | string;
  title: string;
  content: string;
}

interface PageData {
  title: string;
  subtitle?: string;
  last_updated_text?: string;
  contact_email?: string;
  sections?: SectionItem[];
  content?: string;
}

const DEFAULT_TERMS_SECTIONS: SectionItem[] = [
  {
    title: "1. القبول بالشروط",
    content: "باستخدامك لمنصة «الوكيل» فإنك تقر وتوافق على الالتزام الكامل بهذه الشروط والأحكام. إذا كنت لا توافق على أي بند منها، يرجى التوقف فوراً عن استخدام المنصة.",
  },
  {
    title: "2. طبيعة الخدمة والوساطة التقنية",
    content: "الوكيل منصة إلكترونية رقمية تربط الموكلين بنخبة المحامين المعتمدين وتُوفّر حزمة أدوات لإدارة الممارسات والملفات القانونية. المنصة ليست طرفاً في أي تعاقد أو تمثيل قانوني ينشأ بين المحامي والموكل.",
  },
  {
    title: "3. إخلاء مسؤولية المساعد الذكي (AI)",
    content: "المساعد القانوني الذكي وتقنيات الذكاء الاصطناعي تقدّم معلومات إرشادية وتلخيصية عامة فقط، ولا تُعد استشارة قانونية رسمية ملزمة ولا تُغني عن توكيل أو استشارة محامٍ مرخص وممارس. لا تتحمل المنصة أدنى مسؤولية عن قرارات تُتخذ بناءً على مخرجات الذكاء الاصطناعي.",
  },
  {
    title: "4. التزامات ومسؤولية المستخدم",
    content: "يتعهد المستخدم بصحة ودقة كافة البيانات والمستندات المدخلة، والالتزام بالقوانين المنظمة وأخلاقيات المهنة. يحق لإدارة المنصة تعليق أو حظر أي حساب يخالف الضوابط والآداب العامة.",
  },
  {
    title: "5. الأتعاب، الخطط والاشتراكات",
    content: "تُحدد أسعار الخطط والاشتراكات بالعملة الموضحة وتسري فور تأكيد الدفع أو موافقة الإدارة. تخضع طلبات ترقية الخطط والاشتراكات للمراجعة والتفعيل وفق السياسات المعتمدة.",
  },
  {
    title: "6. حدود دور المنصة (بند جوهري)",
    content: "الوكيل وسيط تقني فقط؛ لا نمارس أعمال المحاماة ولا نوظف المحامين ولا نضمن كفاءتهم أو مآل القضايا. كل اتفاق أو وكالة أو أتعاب هي عقد مستقل ومباشر بين المحامي والموكل وحدهما.",
  },
  {
    title: "7. نطاق التحقق والتوثيق",
    content: "يقتصر تدقيق المنصة على فحص شكلي وإداري للمستندات والبيانات المسجلة لتعزيز الموثوقية وتفادي الحسابات غير الحقيقية، دون أن يترتب على ذلك أي كفالة أو مسؤولية تضامنية على المنصة.",
  },
  {
    title: "8. حدود المسؤولية",
    content: "تُقدَّم المنصة وخدماتها الرقمية «كما هي». لا تتحمل المنصة أي مسؤولية عن أضرار غير مباشرة أو فوات مواعيد أو نزاعات شخصية بين الأطراف، وتنحصر أي مسؤولية قانونية - إن وجدت - في حدود المبالغ المدفوعة لاشتراك المنصة خلال آخر 3 أشهر.",
  },
  {
    title: "9. التعويض وحماية الحقوق",
    content: "يوافق المستخدم على إبراء ذمة منصة «الوكيل» والقائمين عليها من أي مطالبات أو خسائر ناتجة عن إساءة استخدامه للمنصة أو مخالفته الصريحة لهذه الشروط.",
  },
  {
    title: "10. تسوية النزاعات والاختصاص القضائي",
    content: "تخضع هذه الشروط وتُفسر وفق القوانين والأنظمة السارية، وتختص المحاكم النظامية المختصة مكانياً بنظر أي نزاع قد ينشأ بخصوص استخدام المنصة.",
  },
  {
    title: "11. الملكية الفكرية",
    content: "العلامة التجارية «الوكيل» والتصاميم البرمجية والشفرات المصدرية ومواد المنصة كافة محمية بحقوق الملكية الفكرية ولا يجوز نسخها أو استغلالها دون موافقة كتابية مسبقة.",
  },
  {
    title: "12. تحديث الشروط والأحكام",
    content: "تحتفظ إدارة المنصة بحق تعديل أو تحديث هذه الشروط في أي وقت مع إشعار المستخدمين عبر الموقع أو البريد الإلكتروني، ويُعد الاستمرار في استخدام المنصة موافقة تامة على الشروط المحدثة.",
  },
  {
    title: "13. قنوات التواصل القانوني",
    content: "لأي استفسارات قانونية أو مراسلات رسمية تخص الشروط والأحكام: support@alwakeel.app",
  },
];

function TermsPage() {
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiGetPage("terms");
        if (active && data) {
          setPage(data);
        }
      } catch (err) {
        // Fallback to default sections if error occurs
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const title = page?.title || "شروط الاستخدام";
  const lastUpdated = page?.last_updated_text || "2026";
  const sections = Array.isArray(page?.sections) && page.sections.length > 0
    ? page.sections
    : DEFAULT_TERMS_SECTIONS;

  return (
    <div className="min-h-screen flex flex-col" dir="rtl">
      <SiteHeader />
      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 sm:py-16 w-full">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-display text-4xl text-gradient-gold font-bold">{title}</h1>
          {loading && <Loader2 className="w-5 h-5 text-gold animate-spin" />}
        </div>
        <p className="text-xs text-foreground/50 mb-10">آخر تحديث: {lastUpdated}</p>

        {page?.subtitle && (
          <p className="text-sm text-foreground/70 mb-8 p-3 rounded-lg bg-gold/5 border border-gold/15">
            {page.subtitle}
          </p>
        )}

        <article className="space-y-6 text-foreground/85 leading-relaxed text-sm">
          {sections.map((sec, idx) => (
            <Section key={sec.id ?? idx} title={sec.title}>
              {sec.content}
            </Section>
          ))}

          {page?.content && !page?.sections?.length && (
            <div className="whitespace-pre-line leading-relaxed text-foreground/85">
              {page.content}
            </div>
          )}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface/30 p-4 rounded-xl border border-gold-soft/20 hover:border-gold-soft/40 transition">
      <h2 className="font-display text-lg text-gold font-semibold mb-2">{title}</h2>
      <p className="text-foreground/80 leading-relaxed text-sm whitespace-pre-line">{children}</p>
    </section>
  );
}
