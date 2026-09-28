import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Loader2, BookOpen, Bookmark, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { chatFetch } from "@/lib/chat-client";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDialog } from "@/components/DashboardShared";

export const Route = createFileRoute("/dashboard/lawyer/research")({
  head: () => ({ meta: [{ title: "البحث القانوني — الوكيل" }] }),
  component: ResearchPage,
});

type Saved = { id: string; title: string; query: string; result: string | null; created_at: string };

function clean(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ""))
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1");
}

function ResearchPage() {
  const { userId } = useAuth();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [active, setActive] = useState<Saved | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const SHORTCUTS = [
    { l: "مواعيد الاستئناف", q: "ما هي مواعيد الطعن بالاستئناف في الأحكام المدنية والجنائية في القانون المصري؟" },
    { l: "قانون العمل", q: "ما أهم أحكام قانون العمل المصري رقم 12 لسنة 2003 المتعلقة بإنهاء الخدمة والتعويض؟" },
    { l: "قانون الإيجار", q: "ما أحكام عقد الإيجار وفق القانون المصري رقم 4 لسنة 1996 وحالات إخلاء العين؟" },
    { l: "إجراءات التنفيذ", q: "ما إجراءات التنفيذ الجبري في القانون المصري وكيف يتم إشكال التنفيذ؟" },
    { l: "شروط صحة العقد", q: "ما هي شروط انعقاد العقد وصحته وفق القانون المدني المصري؟" },
  ];

  function runShortcut(q: string) {
    setQuery(q);
    setActive(null);
    setTimeout(() => { runWith(q); }, 0);
  }

  async function reload() {
    if (!userId) return;
    const { data } = await supabase
      .from("legal_research")
      .select("id, title, query, result, created_at")
      .eq("lawyer_id", userId)
      .eq("is_saved", true)
      .order("created_at", { ascending: false })
      .limit(50);
    setSaved((data as Saved[]) ?? []);
  }
  useEffect(() => { reload(); }, [userId]);

  async function run() { return runWith(query); }

  async function runWith(raw: string) {
    const q = raw.trim();
    if (!q || loading) return;
    setLoading(true);
    setResult("");
    try {
      const r = await chatFetch({ tool: "legal_research", messages: [{ role: "user", content: q }] });
      const data = (await r.json()) as { text: string };
      setResult(clean(data.text));
    } catch (e) {
      setResult(`خطأ: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!userId || !query.trim() || !result.trim()) return;
    await supabase.from("legal_research").insert({
      lawyer_id: userId,
      title: query.slice(0, 100),
      query: query.trim(),
      result,
      is_saved: true,
      type: "ai",
    });
    const { toast } = await import("sonner");
    toast.success("تم حفظ البحث");
    reload();
  }

  async function doRemove(id: string) {
    setConfirmId(null);
    await supabase.from("legal_research").delete().eq("id", id);
    if (active?.id === id) setActive(null);
    reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-gradient-gold font-bold inline-flex items-center gap-2">
          <BookOpen className="h-7 w-7" /> البحث القانوني
        </h1>
        <p className="text-foreground/60 text-sm mt-1">ابحث في القوانين والسوابق القضائية المصرية</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-surface border border-gold-soft/40 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {SHORTCUTS.map((s) => (
                <button
                  key={s.l}
                  onClick={() => runShortcut(s.q)}
                  disabled={loading}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-gold/30 text-gold/80 hover:bg-gold/10 hover:border-gold disabled:opacity-50 transition"
                >
                  {s.l}
                </button>
              ))}
            </div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="مثال: ما حكم الفسخ في عقد البيع وفق القانون المدني المصري؟"
              rows={3}
              className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button onClick={run} disabled={loading || !query.trim()} className="flex-1 bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-lg shadow-gold disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري البحث...</> : <><Search className="h-4 w-4" /> ابحث</>}
              </button>
              {result && (
                <button onClick={save} className="bg-gold/15 hover:bg-gold/25 text-gold border border-gold/40 rounded-lg px-4 py-2.5 inline-flex items-center gap-1.5 text-sm">
                  <Bookmark className="h-4 w-4" /> حفظ
                </button>
              )}
            </div>
          </div>

          {(result || active) && (
            <div className="bg-elevated border border-border rounded-2xl p-5 whitespace-pre-wrap leading-relaxed text-sm">
              {active ? (
                <>
                  <div className="text-xs text-gold mb-2 font-semibold">{active.query}</div>
                  {clean(active.result ?? "")}
                </>
              ) : result}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-foreground/70 mb-2">المحفوظات ({saved.length})</div>
          {saved.length === 0 ? (
            <div className="text-xs text-foreground/40 text-center py-6 border border-dashed border-border rounded-xl">لا توجد أبحاث محفوظة</div>
          ) : saved.map((s) => (
            <div key={s.id} className={`bg-surface border rounded-xl p-3 cursor-pointer transition ${active?.id === s.id ? "border-gold" : "border-border hover:border-gold/40"}`} onClick={() => setActive(s)}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-medium line-clamp-2 flex-1">{s.title}</div>
                <button onClick={(e) => { e.stopPropagation(); setConfirmId(s.id); }} className="text-foreground/40 hover:text-red-400 shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="text-[10px] text-foreground/40 mt-1">{new Date(s.created_at).toLocaleDateString("ar-EG")}</div>
            </div>
          ))}
        </div>
      </div>
      <ConfirmDialog
        open={!!confirmId}
        title="حذف البحث المحفوظ"
        desc="سيتم حذف هذا البحث نهائياً."
        onConfirm={() => confirmId && doRemove(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
