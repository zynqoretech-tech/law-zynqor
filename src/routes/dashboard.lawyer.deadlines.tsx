import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, X, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { chatFetch } from "@/lib/chat-client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/dashboard/lawyer/deadlines")({
  head: () => ({ meta: [{ title: "الآجال القانونية — الوكيل" }] }),
  component: DeadlinesPage,
});

type Deadline = {
  id: string;
  case_id: string | null;
  type: string;
  title: string;
  trigger_date: string;
  deadline_days: number;
  due_date: string;
  status: "active" | "completed" | "expired" | "waived";
  alert_days_before: number;
  notes: string | null;
};

const TYPE_DAYS: Record<string, { l: string; d: number }> = {
  appeal: { l: "استئناف ابتدائي", d: 40 },
  cassation: { l: "طعن بالنقض", d: 60 },
  execution_objection: { l: "إشكال تنفيذ", d: 7 },
  admin_appeal: { l: "إلغاء إداري", d: 60 },
  limitation: { l: "تقادم", d: 365 },
  reply: { l: "رد على مذكرة", d: 15 },
  other: { l: "أخرى", d: 30 },
};

function daysLeft(due: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(due); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function urgencyColor(days: number) {
  if (days < 0) return "bg-red-500/20 border-red-500/50 text-red-300";
  if (days <= 3) return "bg-red-500/15 border-red-500/40 text-red-300";
  if (days <= 7) return "bg-orange-500/15 border-orange-500/40 text-orange-300";
  if (days <= 30) return "bg-yellow-500/15 border-yellow-500/40 text-yellow-300";
  return "bg-green-500/15 border-green-500/40 text-green-300";
}

const PAGE_SIZE = 20;

function DeadlinesPage() {
  const { userId } = useAuth();
  const [items, setItems] = useState<Deadline[]>([]);
  const [cases, setCases] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);

  async function reload() {
    if (!userId) return;
    setLoading(true);
    const { data, count } = await supabase.from("deadlines")
      .select("*", { count: "exact" })
      .eq("lawyer_id", userId)
      .order("due_date", { ascending: true })
      .range(0, PAGE_SIZE - 1);
    const list = (data as Deadline[]) ?? [];
    setItems(list);
    setLoadedCount(list.length);
    setTotalCount(count ?? list.length);
    setLoading(false);
  }
  async function loadMore() {
    if (!userId) return;
    const { data } = await supabase.from("deadlines")
      .select("*")
      .eq("lawyer_id", userId)
      .order("due_date", { ascending: true })
      .range(loadedCount, loadedCount + PAGE_SIZE - 1);
    const list = (data as Deadline[]) ?? [];
    setItems((xs) => [...xs, ...list]);
    setLoadedCount((n) => n + list.length);
  }
  useEffect(() => {
    if (!userId) return;
    reload();
    supabase.from("cases").select("id, title").eq("lawyer_id", userId)
      .then(({ data }) => setCases(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const urgent = items.filter((d) => d.status === "active" && daysLeft(d.due_date) <= 7);

  async function complete(id: string) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status: "completed" } : x)));
    await supabase.from("deadlines").update({ status: "completed" }).eq("id", id);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-gradient-gold font-bold inline-flex items-center gap-2">
            <Clock className="h-7 w-7" /> الآجال القانونية
          </h1>
          <p className="text-foreground/60 text-sm mt-1">تابع مواعيد الطعون والتقادم بدقة</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAiOpen(true)} className="inline-flex items-center gap-2 bg-elevated border border-gold/40 text-gold font-semibold px-4 py-2.5 rounded-lg">
            🤖 احسب بالذكاء الاصطناعي
          </button>
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 bg-gold-gradient text-primary-foreground font-semibold px-4 py-2.5 rounded-lg shadow-gold">
            <Plus className="h-4 w-4" /> أجل جديد
          </button>
        </div>
      </div>

      {urgent.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-red-300">تحذير: {urgent.length} أجل ينتهي خلال أسبوع</div>
            <div className="text-xs text-red-200/70 mt-1">{urgent.slice(0, 3).map((d) => d.title).join("، ")}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-surface border border-border rounded-xl p-4 h-20 animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-foreground/50">
          <div className="text-5xl mb-3">⏳</div>
          <div>لا توجد آجال مسجلة</div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((d) => {
            const left = daysLeft(d.due_date);
            const done = d.status === "completed";
            return (
              <div key={d.id} className={`border rounded-xl p-4 ${done ? "bg-surface/40 border-border opacity-60" : urgencyColor(left)}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-semibold mb-1">{d.title}</div>
                    <div className="text-xs opacity-80">
                      {TYPE_DAYS[d.type]?.l ?? d.type} • تاريخ البداية: {new Date(d.trigger_date).toLocaleDateString("ar-EG")} • الانتهاء: {new Date(d.due_date).toLocaleDateString("ar-EG")}
                    </div>
                    {d.notes && <div className="text-xs opacity-70 mt-1">{d.notes}</div>}
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-lg">
                      {done ? "✓ تم" : left < 0 ? `متأخر ${Math.abs(left)} يوم` : left === 0 ? "اليوم!" : `${left} يوم`}
                    </div>
                    {!done && (
                      <button onClick={() => complete(d.id)} className="text-xs underline mt-1">تحديد كمنجز</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalCount > loadedCount && !loading && (
        <button onClick={loadMore} className="w-full py-2.5 border border-gold/40 text-gold rounded-xl hover:bg-gold/10 text-sm transition">
          تحميل المزيد ({totalCount - loadedCount} متبقي)
        </button>
      )}

      {open && <NewDeadlineDialog cases={cases} userId={userId!} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); reload(); }} />}
      {aiOpen && <AICalcDialog onClose={() => setAiOpen(false)} cases={cases} userId={userId!} onCreated={() => { setAiOpen(false); reload(); }} />}
    </div>
  );
}

function NewDeadlineDialog({ cases, userId, onClose, onCreated }: { cases: { id: string; title: string }[]; userId: string; onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState("appeal");
  const [title, setTitle] = useState("");
  const [caseId, setCaseId] = useState("");
  const [triggerDate, setTriggerDate] = useState("");
  const [days, setDays] = useState(40);
  const [alert, setAlert] = useState(7);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDays(TYPE_DAYS[type]?.d ?? 30); }, [type]);

  const dueDate = (() => {
    if (!triggerDate) return "";
    const d = new Date(triggerDate);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  })();

  async function save() {
    if (!title.trim() || !triggerDate || saving) return;
    setSaving(true);
    await supabase.from("deadlines").insert({
      lawyer_id: userId,
      case_id: caseId || null,
      type, title: title.trim(),
      trigger_date: triggerDate, deadline_days: days, due_date: dueDate,
      alert_days_before: alert, notes: notes.trim() || null,
    });
    onCreated();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">أجل جديد</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm">
          {Object.entries(TYPE_DAYS).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الأجل *" className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm" />
        <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm">
          <option value="">— بدون قضية —</option>
          {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-foreground/60">تاريخ البداية<input type="date" value={triggerDate} onChange={(e) => setTriggerDate(e.target.value)} className="w-full mt-1 bg-elevated border border-border rounded-lg px-3 py-2 text-sm" /></label>
          <label className="text-xs text-foreground/60">عدد الأيام<input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-full mt-1 bg-elevated border border-border rounded-lg px-3 py-2 text-sm" /></label>
        </div>
        {dueDate && <div className="text-sm bg-gold/10 border border-gold/30 rounded-lg p-3">تاريخ الانتهاء المحسوب: <strong>{new Date(dueDate).toLocaleDateString("ar-EG")}</strong></div>}
        <label className="text-xs text-foreground/60 block">تنبيه قبل (أيام)<input type="number" value={alert} onChange={(e) => setAlert(Number(e.target.value))} className="w-full mt-1 bg-elevated border border-border rounded-lg px-3 py-2 text-sm" /></label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات" rows={2} className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm" />
        <button onClick={save} disabled={!title.trim() || !triggerDate || saving} className="w-full bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-lg shadow-gold disabled:opacity-50">{saving ? "جاري..." : "حفظ"}</button>
      </div>
    </div>
  );
}

function AICalcDialog({ onClose, cases, userId, onCreated }: { onClose: () => void; cases: { id: string; title: string }[]; userId: string; onCreated: () => void }) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState<{ date: string; type: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [caseId, setCaseId] = useState<string>("");

  async function ask() {
    if (!q.trim() || loading) return;
    setLoading(true); setAnswer("");
    try {
      const r = await chatFetch({ tool: "deadline_calc", messages: [{ role: "user", content: q }] });
      const d = await r.json() as { text: string };
      setAnswer(d.text);
      setExtracted(extractDateAndType(d.text + " " + q));
    } finally { setLoading(false); }
  }

  async function addToDeadlines() {
    if (!extracted || saving) return;
    setSaving(true);
    const { error } = await supabase.from("deadlines").insert({
      lawyer_id: userId,
      case_id: caseId || null,
      type: extracted.type,
      title: `${TYPE_DAYS[extracted.type]?.l ?? extracted.type} — تم حسابه بالذكاء الاصطناعي`,
      trigger_date: new Date().toISOString().slice(0, 10),
      deadline_days: TYPE_DAYS[extracted.type]?.d ?? 30,
      due_date: extracted.date,
      alert_days_before: 7,
      notes: q,
    });
    setSaving(false);
    if (!error) {
      const { toast } = await import("sonner");
      toast.success("تمت إضافة الأجل ✓");
      onCreated();
    } else {
      const { toast } = await import("sonner");
      toast.error("تعذرت الإضافة: " + error.message);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-lg w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">🤖 حاسبة الآجال الذكية</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-foreground/60">اكتب وصفاً مثل: "صدر حكم ابتدائي بالرفض يوم 15 مايو 2026، أحتاج معرفة ميعاد الاستئناف".</p>
        <textarea value={q} onChange={(e) => setQ(e.target.value)} placeholder="..." rows={3} className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm" />
        <button onClick={ask} disabled={loading || !q.trim()} className="w-full bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-lg shadow-gold disabled:opacity-50">
          {loading ? "جاري الحساب..." : "احسب"}
        </button>
        {answer && (
          <>
            <div className="bg-elevated border border-border rounded-lg p-3 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">{answer}</div>
            {extracted && (
              <div className="space-y-2 border-t border-border pt-3">
                <div className="text-xs text-gold">تاريخ مستخرَج: {extracted.date} — النوع: {TYPE_DAYS[extracted.type]?.l ?? extracted.type}</div>
                <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-xs">
                  <option value="">— بدون ربط بقضية —</option>
                  {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                <button onClick={addToDeadlines} disabled={saving} className="w-full bg-gold/20 hover:bg-gold/30 text-gold border border-gold/40 font-semibold py-2 rounded-lg text-sm disabled:opacity-50">
                  {saving ? "جاري الحفظ..." : "📌 إضافة لمتابعة الآجال"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const AR_MONTHS: Record<string, number> = {
  يناير: 1, فبراير: 2, مارس: 3, أبريل: 4, مايو: 5, يونيو: 6,
  يوليو: 7, يوليه: 7, أغسطس: 8, اغسطس: 8, سبتمبر: 9, أكتوبر: 10, نوفمبر: 11, ديسمبر: 12,
};

function extractDateAndType(text: string): { date: string; type: string } | null {
  let date: string | null = null;
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    date = `${iso[1]}-${iso[2]}-${iso[3]}`;
  } else {
    const ar = text.match(/(\d{1,2})\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|يوليه|أغسطس|اغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s+(\d{4})/);
    if (ar) {
      const day = String(parseInt(ar[1], 10)).padStart(2, "0");
      const month = String(AR_MONTHS[ar[2]]).padStart(2, "0");
      date = `${ar[3]}-${month}-${day}`;
    }
  }
  if (!date) return null;
  let type = "other";
  if (/نقض/.test(text)) type = "cassation";
  else if (/استئناف.*إدار|إلغاء/.test(text)) type = "admin_appeal";
  else if (/استئناف/.test(text)) type = "appeal";
  else if (/إشكال|تنفيذ/.test(text)) type = "execution_objection";
  else if (/تقادم/.test(text)) type = "limitation";
  else if (/رد|مذكرة/.test(text)) type = "reply";
  return { date, type };
}
