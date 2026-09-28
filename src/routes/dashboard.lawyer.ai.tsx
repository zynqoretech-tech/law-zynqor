import { createFileRoute } from "@tanstack/react-router";
import { AIChat } from "@/components/AIChat";

export const Route = createFileRoute("/dashboard/lawyer/ai")({
  head: () => ({ meta: [{ title: "مساعد AI القانوني — الوكيل" }] }),
  component: LawyerAI,
});

const TOOLS = [
  { v: "legal_qa", l: "استشارة قانونية", icon: "⚖️", placeholder: "اسأل في أي مسألة قانونية..." },
  { v: "contract_review", l: "تحليل عقد", icon: "📄", placeholder: "الصق نص العقد للتحليل..." },
  { v: "draft", l: "صياغة عقد", icon: "📝", placeholder: "صف العقد المطلوب صياغته..." },
  { v: "summary", l: "تلخيص مستند", icon: "📋", placeholder: "الصق المستند للتلخيص..." },
  { v: "legal_brief", l: "مذكرة دفاع", icon: "🧾", placeholder: "صف القضية وطلبات الدفاع..." },
  { v: "deadline_calc", l: "حساب الآجال", icon: "⏳", placeholder: "مثال: حكم ابتدائي صدر يوم 15 مايو 2026..." },
  { v: "case_strategy", l: "استراتيجية قضية", icon: "♟️", placeholder: "صف القضية بالتفصيل لتحليلها..." },
  { v: "poa_draft", l: "صياغة توكيل", icon: "✍️", placeholder: "نوع التوكيل وبيانات الأطراف..." },
  { v: "legal_research", l: "بحث قانوني", icon: "🔎", placeholder: "ابحث في التشريعات والأحكام..." },
  { v: "court_fees_calc", l: "حساب الرسوم", icon: "💰", placeholder: "قيمة الدعوى ونوعها لحساب الرسوم..." },
] as const;

function LawyerAI() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl text-gradient-gold font-bold">المساعد القانوني الذكي</h1>
        <p className="text-foreground/60 text-sm mt-1">أدوات متخصصة للمحامين</p>
      </div>
      <AIChat tools={TOOLS as any} defaultTool="legal_qa" />
    </div>
  );
}
