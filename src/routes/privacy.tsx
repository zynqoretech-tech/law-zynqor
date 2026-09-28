import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { apiGetPage } from "@/lib/laravel";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية — الوكيل" },
      { name: "description", content: "سياسة خصوصية منصة الوكيل: كيف نجمع بياناتك ونحميها ونحترم حقوقك." },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "سياسة الخصوصية — الوكيل" },
      { property: "og:description", content: "كيف نحمي بياناتك على منصة الوكيل." },
    ],
  }),
  component: PrivacyPage,
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

const DEFAULT_PRIVACY_SECTIONS: SectionItem[] = [
  {
    title: "1. جمع البيانات",
    content: "نقوم بجمع المعلومات التي تقدّمها عند التسجيل (الاسم، البريد الإلكتروني، رقم الهاتف، المحافظة، ودور الحساب) بالإضافة إلى البيانات التي تنشئها داخل المنصة كالقضايا والمستندات والاستشارات. كل ذلك يُستخدم حصراً لتشغيل خدمات الوكيل.",
  },
  {
    title: "2. حماية البيانات",
    content: "نستخدم تشفيراً قياسياً في النقل والتخزين، وسياسات صلاحيات صارمة على مستوى الصفّ (Row-Level Security) لضمان أن كل مستخدم يصل فقط لبياناته. مستنداتك تُحفظ في تخزين خاص ولا يُشاركها أحد بلا إذنك.",
  },
  {
    title: "3. الاستشارات والسرية",
    content: "محادثات الاستشارات بينك وبين المحامي خاصة. لا نطّلع على محتواها ولا نشاركه مع أي طرف ثالث. لا يُسمح لطاقم الوكيل بالوصول لبيانات أي حساب إلا بطلبك أو بأمر قضائي ساري.",
  },
  {
    title: "4. حقوق المستخدم",
    content: "يحق لك الاطلاع على بياناتك، تصحيحها، أو حذف حسابك في أي وقت. يكفي التواصل معنا عبر بريد الدعم لتنفيذ الطلب خلال أيام عمل قليلة.",
  },
  {
    title: "5. ملفات تعريف الارتباط",
    content: "نستخدم ملفات تعريف ارتباط أساسية لإبقاء جلستك مفتوحة فقط. لا نشارك بياناتك مع منصات إعلانية، ولا نبيعها لأي طرف ثالث.",
  },
  {
    title: "6. دور المنصة تجاه بياناتك",
    content: "«الوكيل» وسيط تقني فقط: نحن نستضيف البيانات ونؤمّنها، ولا نُقدّم خدمات قانونية ولا نتدخل في العلاقة بين المحامي والموكل. البيانات التي يرفعها المحامي عن موكليه (قضايا، مستندات، فواتير) يكون المحامي هو المسؤول عنها قانوناً بصفته المتحكم في تلك البيانات، وتعمل المنصة كمعالج تقني نيابةً عنه فقط.",
  },
  {
    title: "7. التواصل",
    content: "لأي استفسار حول الخصوصية: support@alwakeel.app",
  },
];

function PrivacyPage() {
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiGetPage("privacy");
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

  const title = page?.title || "سياسة الخصوصية";
  const lastUpdated = page?.last_updated_text || "2026";
  const sections = Array.isArray(page?.sections) && page.sections.length > 0
    ? page.sections
    : DEFAULT_PRIVACY_SECTIONS;

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

        <article className="prose-content space-y-6 text-foreground/85 leading-relaxed text-sm">
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

