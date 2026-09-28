import { createFileRoute, Link } from "@tanstack/react-router";
import { chatFetch } from "@/lib/chat-client";
import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/ai-assistant")({
  head: () => ({
    meta: [
      { title: "المساعد القانوني الذكي — الوكيل" },
      { name: "description", content: "اسأل المساعد الذكي للوكيل أي سؤال قانوني عن القانون المصري واحصل على إجابة فورية." },
    ],
  }),
  component: AiAssistant,
});

type Msg = { role: "user" | "assistant"; content: string };

function AiAssistant() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "السلام عليكم 🌟 أنا الوكيل — مساعدك القانوني الذكي. اسألني عن أي قضية مدنية، جنائية، عمالية، أو أحوال شخصية في القانون المصري.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const r = await chatFetch({ messages: next });
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as { text: string };
      setMessages((m) => [...m, { role: "assistant", content: data.text }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `حدث خطأ: ${(e as Error).message}. حاول مرة أخرى.` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [
    "ما حقوقي كموظف في مواجهة الفصل التعسفي؟",
    "كيف أرفع قضية نفقة؟",
    "ما إجراءات عقد الإيجار القانوني؟",
    "ما حكم رفض دفع مستحقات العمال؟",
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 sm:py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/30 rounded-full px-4 py-1.5 text-gold text-sm mb-4">
            <Sparkles className="h-4 w-4" /> مساعد قانوني مجاني
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-gradient-gold font-bold mb-2">
            اسأل عن حقوقك القانونية
          </h1>
          <p className="text-foreground/60 text-sm max-w-md mx-auto">
            خبير في القانون المصري — جنائي، مدني، عمالي، أسرة، عقاري
          </p>
        </div>

        <div className="bg-surface/60 border border-gold-soft/40 rounded-2xl p-4 sm:p-6 space-y-4 min-h-[400px] max-h-[60vh] overflow-y-auto mb-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 whitespace-pre-wrap text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-gold/15 border border-gold/30 text-foreground"
                    : "bg-elevated border border-border text-foreground/90"
                }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-end">
              <div className="bg-elevated border border-border rounded-2xl px-4 py-3 inline-flex items-center gap-2 text-foreground/60 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-gold" /> يفكّر...
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {messages.length <= 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {suggestions.map((s) => (
              <button key={s} onClick={() => setInput(s)}
                className="text-right text-xs text-foreground/70 bg-surface/60 border border-border hover:border-gold/50 hover:text-foreground rounded-xl px-3 py-2.5 transition">
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="اسأل عن أي مسألة قانونية..."
            rows={2}
            className="flex-1 resize-none bg-surface border border-gold-soft/50 focus:border-gold rounded-xl px-4 py-3 text-foreground placeholder:text-foreground/40 outline-none text-sm transition"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="bg-gold-gradient text-primary-foreground font-semibold px-5 py-3 rounded-xl shadow-gold inline-flex items-center gap-2 disabled:opacity-50 hover:scale-105 transition-transform">
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-center text-xs text-foreground/40 mt-4">
          ⚖️ هذه معلومات إرشادية — لا تُغني عن استشارة محامٍ معتمد
        </p>

        <div className="mt-6 text-center">
          <Link to="/marketplace" className="text-sm text-gold hover:underline">
            ابحث عن محامٍ متخصص في قضيتك ←
          </Link>
        </div>
      </main>
    </div>
  );
}
