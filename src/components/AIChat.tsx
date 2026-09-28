import { useEffect, useRef, useState } from "react";
import { chatFetch } from "@/lib/chat-client";
import { Send, Loader2, Download, Trash2 } from "lucide-react";

function cleanMarkdown(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ""))
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1");
}

function downloadAsPdf(text: string, title = "مستند") {
  const clean = cleanMarkdown(text);
  const safeTitle = title.replace(/[<>&]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]!));
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>
@page { size: A4; margin: 2.2cm; }
body { font-family: "Amiri","Traditional Arabic","Times New Roman",serif; line-height: 2; font-size: 14pt; color:#111; margin:0; }
h1 { font-size: 20pt; text-align:center; margin: 0 0 20px; }
pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; font-size: inherit; margin:0; }
@media print { .noprint { display:none; } }
.noprint{position:fixed;top:10px;left:10px;background:#c9a13b;color:#fff;border:0;padding:10px 16px;border-radius:8px;font-size:14px;cursor:pointer;font-family:sans-serif;}
</style></head><body>
<button class="noprint" onclick="window.print()">طباعة / حفظ PDF</button>
<h1>${safeTitle}</h1>
<pre>${clean.replace(/[<>&]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]!))}</pre>
<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),400));</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}


type Msg = { role: "user" | "assistant"; content: string; statutes_used?: string[] };
type Tool = { v: string; l: string; icon: string; placeholder: string };

const WINDOW = 10;

function getToolGreeting(toolV: string): string {
  const greetings: Record<string, string> = {
    legal_qa: "اسألني عن أي مسألة قانونية وسأجيبك بما يتوافق مع القانون المصري.",
    contract_review: "الصق نص العقد وسأحلله وأرصد البنود الخطرة والجيدة.",
    draft: "أخبرني بنوع العقد وتفاصيله وسأصيغه لك.",
    summary: "الصق المستند وسألخصه في نقاط واضحة.",
    legal_brief: "صف القضية وطلبات الدفاع وسأصيغ مذكرة بأسلوب المحاكم المصرية.",
    deadline_calc: "اكتب تاريخ الحدث (حكم/إعلان) وسأحسب لك الأجل القانوني والأيام المتبقية.",
    case_strategy: "صف القضية بتفاصيلها وسأقدم تحليلاً استراتيجياً متكاملاً.",
    poa_draft: "حدد نوع التوكيل وبيانات الأطراف وسأصيغه قانونياً.",
    legal_research: "ابحث في التشريعات وأحكام النقض المصرية.",
    court_fees_calc: "أعطني قيمة الدعوى ونوعها لأحسب الرسوم التقديرية.",
  };
  return greetings[toolV] ?? "";
}

const INITIAL_MSG: Msg = {
  role: "assistant",
  content: "أهلاً، أنا الوكيل — مساعدك القانوني الذكي. اختر أداة وابدأ.",
};

export function AIChat({ tools, defaultTool }: { tools: readonly Tool[]; defaultTool: string }) {
  const storageKey = `alwakeel_chat_${defaultTool}`;
  const [tool, setTool] = useState(defaultTool);
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (typeof window === "undefined") return [INITIAL_MSG];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Msg[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [INITIAL_MSG];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages.slice(-50))); } catch {}
  }, [messages, storageKey]);

  function clearChat() {
    setMessages([INITIAL_MSG]);
    try { localStorage.removeItem(storageKey); } catch {}
  }

  const active = tools.find((t) => t.v === tool) ?? tools[0];

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const all: Msg[] = [...messages, { role: "user", content: text }];
    const toSend = all.length > WINDOW ? all.slice(-WINDOW) : all;
    setMessages(all);
    setInput("");
    setLoading(true);
    try {
      const r = await chatFetch({ messages: toSend, tool });
      const data = (await r.json()) as { text: string; statutes_used?: string[] };
      setMessages((m) => [...m, { role: "assistant", content: data.text, statutes_used: data.statutes_used ?? [] }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `حدث خطأ: ${(e as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tools.map((t) => (
          <button
            key={t.v}
            onClick={() => {
              if (tool !== t.v) {
                setTool(t.v);
                setMessages([{
                  role: "assistant",
                  content: `تم التبديل إلى: ${t.l} ${t.icon}\n${getToolGreeting(t.v)}`,
                }]);
                setInput("");
              }
            }}
            className={`px-3 py-3 rounded-xl border text-sm transition flex flex-col items-center gap-1 ${tool === t.v ? "bg-gold/15 border-gold text-gold" : "bg-surface/60 border-border text-foreground/70 hover:border-gold/60"}`}
          >
            <span className="text-xl">{t.icon}</span>
            <span className="text-xs">{t.l}</span>
          </button>
        ))}
      </div>

      <div className="bg-surface/60 border border-gold-soft/40 rounded-2xl p-4 md:p-6 space-y-3 overflow-y-auto min-h-[400px] max-h-[60vh]">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            <MessageBubble msg={m} tool={tool} />
          </div>
        ))}
        {loading && (
          <div className="flex justify-end">
            <div className="bg-elevated border border-border rounded-2xl px-4 py-3 inline-flex items-center gap-2 text-foreground/60">
              <Loader2 className="h-4 w-4 animate-spin text-gold" /> الوكيل يفكّر...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-center justify-between text-xs text-foreground/50">
        <span>المحادثة محفوظة تلقائياً في هذا المتصفح</span>
        {messages.length > 1 && (
          <button onClick={clearChat} className="inline-flex items-center gap-1 hover:text-red-400 transition">
            <Trash2 className="h-3 w-3" /> مسح المحادثة
          </button>
        )}
      </div>

      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={active.placeholder}
          rows={2}
          className="flex-1 resize-none bg-surface border border-gold-soft/50 focus:border-gold rounded-xl px-4 py-3 text-foreground outline-none"
        />
        <button onClick={send} disabled={loading || !input.trim()} className="bg-gold-gradient text-primary-foreground font-semibold px-5 py-3 rounded-xl shadow-gold inline-flex items-center gap-2 disabled:opacity-50">
          <Send className="h-4 w-4" /> إرسال
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ msg, tool }: { msg: Msg; tool: string }) {
  if (msg.role === "assistant" && tool === "contract_review") {
    try {
      const parsed = JSON.parse(msg.content);
      if (typeof parsed === "object" && parsed && ("risk_score" in parsed || "risky_clauses" in parsed)) {
        return <ContractAnalysis data={parsed} />;
      }
    } catch {}
  }
  const isAssistant = msg.role === "assistant";
  const text = isAssistant ? cleanMarkdown(msg.content) : msg.content;
  const showPdf = isAssistant && text.trim().length > 40;
  const title = tool === "draft" ? "مسودة عقد" : tool === "summary" ? "ملخص مستند" : "استشارة قانونية";
  return (
    <div className={`max-w-[85%] rounded-2xl px-4 py-3 whitespace-pre-wrap leading-relaxed ${isAssistant ? "bg-elevated border border-border text-foreground/90" : "bg-gold/15 border border-gold/30 text-foreground"}`}>
      {text}
      {isAssistant && msg.statutes_used && msg.statutes_used.length > 0 && (
        <div className="mt-2 text-xs text-foreground/50 border-t border-border pt-2">
          📖 المصادر المُستشهَد بها: {msg.statutes_used.join("، ")}
        </div>
      )}
      {showPdf && (
        <button
          onClick={() => downloadAsPdf(text, title)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs bg-gold/15 hover:bg-gold/25 text-gold border border-gold/40 rounded-lg px-3 py-1.5 transition"
        >
          <Download className="h-3.5 w-3.5" /> تحميل PDF
        </button>
      )}
    </div>
  );
}

function ContractAnalysis({ data }: { data: any }) {
  const score = Number(data.risk_score) || 0;
  const riskColor = score >= 70 ? "text-red-400" : score >= 40 ? "text-yellow-400" : "text-green-400";
  const barColor = score >= 70 ? "bg-red-500" : score >= 40 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="max-w-[90%] bg-elevated border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className={`font-display text-4xl font-bold ${riskColor}`}>
          {score}<span className="text-lg">/100</span>
        </div>
        <div>
          <div className="text-xs text-foreground/60">درجة المخاطرة</div>
          <div className="w-32 h-2 bg-surface rounded-full mt-1 overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score}%` }} />
          </div>
        </div>
      </div>
      {data.summary && (
        <div className="text-sm text-foreground/80 bg-surface rounded-lg p-3">{data.summary}</div>
      )}
      {Array.isArray(data.risky_clauses) && data.risky_clauses.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-red-400 mb-2">⚠️ بنود تحتاج مراجعة ({data.risky_clauses.length})</div>
          <div className="space-y-2">
            {data.risky_clauses.map((c: any, i: number) => (
              <div key={i} className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${c.severity === "high" ? "bg-red-500/30 text-red-300" : c.severity === "medium" ? "bg-yellow-500/30 text-yellow-300" : "bg-blue-500/30 text-blue-300"}`}>
                    {c.severity === "high" ? "عالي" : c.severity === "medium" ? "متوسط" : "منخفض"}
                  </span>
                </div>
                <div className="text-foreground/90 text-xs font-medium mb-1">{c.clause}</div>
                <div className="text-foreground/70 text-xs">{c.explanation}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {Array.isArray(data.good_clauses) && data.good_clauses.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-green-400 mb-2">✅ بنود جيدة ({data.good_clauses.length})</div>
          <div className="space-y-1">
            {data.good_clauses.map((c: any, i: number) => (
              <div key={i} className="text-xs text-foreground/70 bg-green-500/10 border border-green-500/20 rounded px-3 py-2">
                {c.clause}
              </div>
            ))}
          </div>
        </div>
      )}
      {Array.isArray(data.recommendations) && data.recommendations.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gold mb-2">📋 التوصيات</div>
          <ul className="space-y-1">
            {data.recommendations.map((r: string, i: number) => (
              <li key={i} className="text-xs text-foreground/80 flex gap-2">
                <span className="text-gold shrink-0">•</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
