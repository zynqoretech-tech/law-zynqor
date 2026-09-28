import { createFileRoute } from "@tanstack/react-router";
import { AIChat } from "@/components/AIChat";

export const Route = createFileRoute("/dashboard/client/ai")({
  head: () => ({ meta: [{ title: "اسأل AI — الوكيل" }] }),
  component: ClientAI,
});

const TOOLS = [
  { v: "legal_qa", l: "استشارة قانونية", icon: "⚖️", placeholder: "اسأل أي سؤال قانوني..." },
  { v: "summary", l: "تلخيص مستند", icon: "📋", placeholder: "الصق المستند للتلخيص..." },
] as const;

function ClientAI() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl text-gradient-gold font-bold">المساعد القانوني الذكي</h1>
        <p className="text-foreground/60 text-sm mt-1">اسأل في أي مسألة قانونية واحصل على إجابة فورية</p>
      </div>
      <AIChat tools={TOOLS as any} defaultTool="legal_qa" />
    </div>
  );
}
