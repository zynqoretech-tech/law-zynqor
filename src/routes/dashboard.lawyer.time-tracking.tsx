import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Play, Square, Plus, X, Timer, Receipt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/dashboard/lawyer/time-tracking")({
  head: () => ({ meta: [{ title: "تتبع ساعات العمل — الوكيل" }] }),
  component: TimeTrackingPage,
});

type Entry = {
  id: string;
  description: string;
  case_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number;
  is_billable: boolean;
  hourly_rate: number;
  billed_amount: number;
  created_at: string;
};

function fmt(sec: number) {
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function TimeTrackingPage() {
  const { userId } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [cases, setCases] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<{ start: number } | null>(null);
  const [tick, setTick] = useState(0);
  const [stopDialog, setStopDialog] = useState<{ start: number; end: number } | null>(null);
  const [addDialog, setAddDialog] = useState(false);
  const [invoiceDialog, setInvoiceDialog] = useState(false);
  const iv = useRef<ReturnType<typeof setInterval> | null>(null);

  async function reload() {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase.from("time_entries").select("*").eq("lawyer_id", userId)
      .order("created_at", { ascending: false }).limit(50);
    setEntries((data as Entry[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    if (!userId) return;
    reload();
    supabase.from("cases").select("id, title").eq("lawyer_id", userId)
      .then(({ data }) => setCases(data ?? []));
  }, [userId]);

  useEffect(() => {
    if (running) {
      iv.current = setInterval(() => setTick((t) => t + 1), 1000);
      return () => { if (iv.current) clearInterval(iv.current); };
    }
  }, [running]);

  const elapsed = running ? Math.floor((Date.now() - running.start) / 1000) : 0;
  void tick;

  function start() { setRunning({ start: Date.now() }); }
  function stop() {
    if (!running) return;
    setStopDialog({ start: running.start, end: Date.now() });
    setRunning(null);
  }

  const today = entries.filter((e) => new Date(e.created_at).toDateString() === new Date().toDateString());
  const todayMins = today.reduce((s, e) => s + (Number(e.duration_minutes) || 0), 0);
  const billableMins = today.filter((e) => e.is_billable).reduce((s, e) => s + (Number(e.duration_minutes) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-gradient-gold font-bold inline-flex items-center gap-2"><Timer className="h-7 w-7" /> تتبع ساعات العمل</h1>
          <p className="text-foreground/60 text-sm mt-1">سجّل وقتك واحسب أتعابك بدقة</p>
        </div>
        <button onClick={() => setInvoiceDialog(true)}
          className="inline-flex items-center gap-2 bg-gold/15 border border-gold/40 text-gold font-semibold px-4 py-2.5 rounded-lg hover:bg-gold/25 transition">
          <Receipt className="h-4 w-4" /> 💰 تحويل لفاتورة
        </button>
      </div>

      <div className="bg-surface/60 border border-gold-soft/40 rounded-2xl p-6 text-center">
        <div className="font-mono text-5xl font-bold text-gold mb-4">{fmt(elapsed)}</div>
        {running ? (
          <button onClick={stop} className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl">
            <Square className="h-5 w-5" /> إيقاف
          </button>
        ) : (
          <button onClick={start} className="inline-flex items-center gap-2 bg-gold-gradient text-primary-foreground font-semibold px-6 py-3 rounded-xl shadow-gold">
            <Play className="h-5 w-5" /> ابدأ المؤقت
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="إجمالي اليوم" value={`${((Number(todayMins) || 0) / 60).toFixed(1)} ساعة`} />
        <Stat label="قابل للفوترة اليوم" value={`${((Number(billableMins) || 0) / 60).toFixed(1)} ساعة`} />
        <Stat label="عدد الإدخالات" value={String(today.length)} />
      </div>

      <div className="flex justify-between items-center">
        <h2 className="font-display text-xl">سجل الوقت</h2>
        <button onClick={() => setAddDialog(true)} className="inline-flex items-center gap-2 bg-elevated border border-gold/40 text-gold rounded-lg px-3 py-1.5 text-sm">
          <Plus className="h-4 w-4" /> إدخال يدوي
        </button>
      </div>

      {loading ? <div className="text-center text-foreground/50 py-8">جاري التحميل...</div> : entries.length === 0 ? (
        <div className="text-center py-12 text-foreground/50">لا توجد إدخالات بعد</div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => {
            const mins = Number(e.duration_minutes) || 0;
            const rate = Number(e.hourly_rate) || 0;
            const billed = Number(e.billed_amount ?? (mins / 60) * rate) || 0;
            return (
              <div key={e.id} className="bg-surface border border-border rounded-lg p-3 flex items-center justify-between gap-3 text-sm">
                <div className="flex-1">
                  <div className="font-medium">{e.description}</div>
                  <div className="text-xs text-foreground/50">{new Date(e.created_at).toLocaleString("ar-EG")}</div>
                </div>
                <div className="text-left">
                  <div className="font-semibold">{(mins / 60).toFixed(2)} س</div>
                  {e.is_billable && <div className="text-xs text-gold">{billed.toFixed(0)} ج.م</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {stopDialog && (
        <SaveEntryDialog cases={cases} userId={userId!} start={stopDialog.start} end={stopDialog.end}
          onClose={() => setStopDialog(null)} onSaved={() => { setStopDialog(null); reload(); }} />
      )}
      {addDialog && (
        <ManualEntryDialog cases={cases} userId={userId!}
          onClose={() => setAddDialog(false)} onSaved={() => { setAddDialog(false); reload(); }} />
      )}
      {invoiceDialog && (
        <InvoiceFromTimeDialog cases={cases} userId={userId!}
          onClose={() => setInvoiceDialog(false)} onCreated={() => { setInvoiceDialog(false); reload(); }} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="text-xs text-foreground/60">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}

function SaveEntryDialog({ cases, userId, start, end, onClose, onSaved }: {
  cases: { id: string; title: string }[]; userId: string; start: number; end: number;
  onClose: () => void; onSaved: () => void;
}) {
  const [desc, setDesc] = useState("");
  const [caseId, setCaseId] = useState("");
  const [billable, setBillable] = useState(true);
  const [rate, setRate] = useState("300");
  const [saving, setSaving] = useState(false);
  const mins = Math.max(1, Math.round((end - start) / 60000));

  async function save() {
    if (!desc.trim() || saving) return;
    setSaving(true);
    const r = Number(rate) || 0;
    await supabase.from("time_entries").insert({
      lawyer_id: userId, case_id: caseId || null,
      description: desc.trim(),
      started_at: new Date(start).toISOString(),
      ended_at: new Date(end).toISOString(),
      duration_minutes: mins, is_billable: billable,
      hourly_rate: r, billed_amount: billable ? (mins / 60) * r : 0,
    });
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">حفظ الإدخال — {fmt((end - start) / 1000)}</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="وصف العمل *" rows={2} className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm" />
        <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm">
          <option value="">— بدون قضية —</option>
          {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2 items-center">
          <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} /> قابل للفوترة</label>
          <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="ج.م/ساعة" className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={save} disabled={!desc.trim() || saving} className="w-full bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-lg shadow-gold disabled:opacity-50">{saving ? "جاري..." : "حفظ"}</button>
      </div>
    </div>
  );
}

function ManualEntryDialog({ cases, userId, onClose, onSaved }: {
  cases: { id: string; title: string }[]; userId: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [desc, setDesc] = useState("");
  const [caseId, setCaseId] = useState("");
  const [mins, setMins] = useState("60");
  const [rate, setRate] = useState("300");
  const [billable, setBillable] = useState(true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!desc.trim() || saving) return;
    setSaving(true);
    const m = Number(mins) || 0; const r = Number(rate) || 0;
    await supabase.from("time_entries").insert({
      lawyer_id: userId, case_id: caseId || null,
      description: desc.trim(), duration_minutes: m,
      is_billable: billable, hourly_rate: r,
      billed_amount: billable ? (m / 60) * r : 0,
    });
    onSaved();
  }
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">إدخال يدوي</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="وصف العمل *" rows={2} className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm" />
        <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm">
          <option value="">— بدون قضية —</option>
          {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-foreground/60">دقائق<input type="number" value={mins} onChange={(e) => setMins(e.target.value)} className="w-full mt-1 bg-elevated border border-border rounded-lg px-3 py-2 text-sm" /></label>
          <label className="text-xs text-foreground/60">ج.م/ساعة<input type="number" value={rate} onChange={(e) => setRate(e.target.value)} className="w-full mt-1 bg-elevated border border-border rounded-lg px-3 py-2 text-sm" /></label>
          <label className="text-xs text-foreground/60 flex items-end gap-1"><input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} /> فوترة</label>
        </div>
        <button onClick={save} disabled={!desc.trim() || saving} className="w-full bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-lg shadow-gold disabled:opacity-50">{saving ? "جاري..." : "حفظ"}</button>
      </div>
    </div>
  );
}

function InvoiceFromTimeDialog({ cases, userId, onClose, onCreated }: {
  cases: { id: string; title: string }[]; userId: string;
  onClose: () => void; onCreated: () => void;
}) {
  const [caseId, setCaseId] = useState("");
  const [entries, setEntries] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [caseInfo, setCaseInfo] = useState<{ client_id: string | null } | null>(null);

  useEffect(() => {
    if (!caseId) { setEntries([]); setSelected(new Set()); setCaseInfo(null); return; }
    setLoading(true);
    (async () => {
      const [eRes, cRes] = await Promise.all([
        supabase.from("time_entries").select("*").eq("lawyer_id", userId).eq("case_id", caseId).eq("is_billable", true).neq("status", "billed").order("created_at", { ascending: false }),
        supabase.from("cases").select("client_id").eq("id", caseId).single(),
      ]);
      setEntries(eRes.data ?? []);
      setSelected(new Set((eRes.data ?? []).map((e: any) => e.id)));
      setCaseInfo((cRes.data as any) ?? null);
      setLoading(false);
    })();
  }, [caseId, userId]);

  const chosen = entries.filter((e) => selected.has(e.id));
  const total = chosen.reduce((s, e) => s + (Number(e.billed_amount) || (Number(e.duration_minutes || 0) / 60) * Number(e.hourly_rate || 0)), 0);

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function create() {
    if (chosen.length === 0 || !caseId || saving) return;
    setSaving(true);
    const lineItems = chosen.map((e) => ({
      description: e.description,
      quantity: Number((Number(e.duration_minutes || 0) / 60).toFixed(2)),
      price: Number(e.hourly_rate || 0),
    }));
    const inv = {
      lawyer_id: userId,
      client_id: caseInfo?.client_id ?? null,
      case_id: caseId,
      invoice_number: `INV-${Date.now().toString().slice(-8)}`,
      amount: total,
      paid_amount: 0,
      tax_percent: 0,
      tax_amount: 0,
      total_amount: total,
      status: "pending",
      line_items: lineItems,
    };
    const { error } = await supabase.from("invoices").insert(inv);
    if (error) { toast.error(error.message); setSaving(false); return; }
    await supabase.from("time_entries").update({ status: "billed" }).in("id", chosen.map((e) => e.id));
    toast.success("تم إنشاء الفاتورة ✓");
    onCreated();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-lg w-full space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">تحويل ساعات لفاتورة</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm">
          <option value="">— اختر قضية —</option>
          {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        {loading && <div className="text-xs text-foreground/50 text-center py-4">جاري التحميل...</div>}
        {!loading && caseId && entries.length === 0 && (
          <div className="text-xs text-foreground/50 text-center py-4">لا توجد ساعات قابلة للفوترة في هذه القضية</div>
        )}
        {entries.length > 0 && (
          <>
            <div className="space-y-1.5 max-h-64 overflow-y-auto border border-border rounded-lg p-2">
              {entries.map((e) => (
                <label key={e.id} className="flex items-start gap-2 text-xs bg-elevated rounded p-2 cursor-pointer">
                  <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium">{e.description}</div>
                    <div className="text-foreground/50">{((Number(e.duration_minutes) || 0) / 60).toFixed(2)} س × {(Number(e.hourly_rate) || 0).toFixed(0)} = {(Number(e.billed_amount) || ((Number(e.duration_minutes) || 0) / 60) * (Number(e.hourly_rate) || 0)).toFixed(0)} ج.م</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-between items-center bg-gold/10 border border-gold/30 rounded-lg p-3">
              <span className="text-sm">الإجمالي ({chosen.length} إدخال)</span>
              <span className="font-bold text-gold text-lg">{(Number(total) || 0).toFixed(0)} ج.م</span>
            </div>
            <button onClick={create} disabled={chosen.length === 0 || saving} className="w-full bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-lg shadow-gold disabled:opacity-50">
              {saving ? "جاري الإنشاء..." : "إنشاء الفاتورة"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
