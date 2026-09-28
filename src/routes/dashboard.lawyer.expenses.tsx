import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, X, Receipt, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/dashboard/lawyer/expenses")({
  head: () => ({ meta: [{ title: "مصروفات القضايا — الوكيل" }] }),
  component: ExpensesPage,
});

const TYPES: { v: string; l: string }[] = [
  { v: "court_fees", l: "رسوم محكمة" },
  { v: "stamps", l: "طوابع دمغة" },
  { v: "travel", l: "انتقالات" },
  { v: "expert", l: "خبراء" },
  { v: "translation", l: "ترجمة" },
  { v: "registration", l: "تسجيل/شهر عقاري" },
  { v: "notary", l: "توثيق" },
  { v: "other", l: "أخرى" },
];

type Expense = {
  id: string; case_id: string; type: string; description: string;
  amount: number; paid_at: string | null; is_billable: boolean; is_reimbursed: boolean;
};

function ExpensesPage() {
  const { userId } = useAuth();
  const [items, setItems] = useState<Expense[]>([]);
  const [cases, setCases] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [billDialog, setBillDialog] = useState(false);

  async function reload() {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase.from("case_expenses").select("*").eq("lawyer_id", userId)
      .order("paid_at", { ascending: false, nullsFirst: false });
    setItems((data as Expense[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    if (!userId) return;
    reload();
    supabase.from("cases").select("id, title").eq("lawyer_id", userId)
      .then(({ data }) => setCases(data ?? []));
  }, [userId]);

  const total = items.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const unreimbursed = items.filter((e) => e.is_billable && !e.is_reimbursed).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const reimbursed = items.filter((e) => e.is_reimbursed).reduce((s, e) => s + (Number(e.amount) || 0), 0);

  async function toggleReimb(id: string, v: boolean) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, is_reimbursed: v } : x)));
    await supabase.from("case_expenses").update({ is_reimbursed: v }).eq("id", id);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-gradient-gold font-bold inline-flex items-center gap-2"><Receipt className="h-7 w-7" /> مصروفات القضايا</h1>
          <p className="text-foreground/60 text-sm mt-1">تابع مصروفات المحاكم والاسترداد من الموكلين</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setBillDialog(true)} className="inline-flex items-center gap-2 bg-gold/15 border border-gold/40 text-gold font-semibold px-4 py-2.5 rounded-lg hover:bg-gold/25 transition">
            <Send className="h-4 w-4" /> 💰 إرسال للموكل
          </button>
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 bg-gold-gradient text-primary-foreground font-semibold px-4 py-2.5 rounded-lg shadow-gold">
            <Plus className="h-4 w-4" /> مصروف جديد
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat label="إجمالي المصروفات" value={`${(Number(total) || 0).toFixed(0)} ج.م`} />
        <Stat label="غير مُستردة" value={`${(Number(unreimbursed) || 0).toFixed(0)} ج.م`} color="text-orange-300" />
        <Stat label="تم استردادها" value={`${(Number(reimbursed) || 0).toFixed(0)} ج.م`} color="text-green-400" />
      </div>

      {loading ? <div className="text-center py-8 text-foreground/50">جاري التحميل...</div> : items.length === 0 ? (
        <div className="text-center py-16 text-foreground/50"><div className="text-5xl mb-3">💸</div>لا توجد مصروفات</div>
      ) : (
        <div className="space-y-2">
          {items.map((e) => (
            <div key={e.id} className="bg-surface border border-border rounded-lg p-3 flex items-center justify-between gap-3 text-sm flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <div className="font-medium">{e.description}</div>
                <div className="text-xs text-foreground/50">
                  {TYPES.find((t) => t.v === e.type)?.l ?? e.type}
                  {e.paid_at && ` • ${new Date(e.paid_at).toLocaleDateString("ar-EG")}`}
                </div>
              </div>
              <div className="font-semibold">{Number(e.amount).toFixed(0)} ج.م</div>
              {e.is_billable && (
                <label className="text-xs flex items-center gap-1.5">
                  <input type="checkbox" checked={e.is_reimbursed} onChange={(ev) => toggleReimb(e.id, ev.target.checked)} />
                  {e.is_reimbursed ? "مُسترد" : "بانتظار الاسترداد"}
                </label>
              )}
            </div>
          ))}
        </div>
      )}

      {open && <NewExpenseDialog cases={cases} userId={userId!} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); reload(); }} />}
      {billDialog && <BillExpensesDialog cases={cases} userId={userId!} onClose={() => setBillDialog(false)} onCreated={() => { setBillDialog(false); reload(); }} />}
    </div>
  );
}

function BillExpensesDialog({ cases, userId, onClose, onCreated }: {
  cases: { id: string; title: string }[]; userId: string;
  onClose: () => void; onCreated: () => void;
}) {
  const [caseId, setCaseId] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [caseInfo, setCaseInfo] = useState<{ client_id: string | null } | null>(null);

  useEffect(() => {
    if (!caseId) { setItems([]); setSelected(new Set()); setCaseInfo(null); return; }
    setLoading(true);
    (async () => {
      const [eRes, cRes] = await Promise.all([
        supabase.from("case_expenses").select("*").eq("lawyer_id", userId).eq("case_id", caseId).eq("is_billable", true).eq("is_reimbursed", false),
        supabase.from("cases").select("client_id").eq("id", caseId).single(),
      ]);
      setItems(eRes.data ?? []);
      setSelected(new Set((eRes.data ?? []).map((e: any) => e.id)));
      setCaseInfo((cRes.data as any) ?? null);
      setLoading(false);
    })();
  }, [caseId, userId]);

  const chosen = items.filter((x) => selected.has(x.id));
  const total = chosen.reduce((s, x) => s + Number(x.amount || 0), 0);
  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  async function create() {
    if (chosen.length === 0 || !caseId || saving) return;
    setSaving(true);
    const lineItems = chosen.map((e) => ({ description: e.description, quantity: 1, price: Number(e.amount) || 0 }));
    const { error } = await supabase.from("invoices").insert({
      lawyer_id: userId,
      client_id: caseInfo?.client_id ?? null,
      case_id: caseId,
      invoice_number: `EXP-${Date.now().toString().slice(-8)}`,
      amount: total,
      paid_amount: 0,
      tax_percent: 0,
      tax_amount: 0,
      total_amount: total,
      status: "pending",
      line_items: lineItems,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    await supabase.from("case_expenses").update({ is_reimbursed: true }).in("id", chosen.map((e) => e.id));
    toast.success("تم إرسال المصروفات للموكل ✓");
    onCreated();
  }
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-lg w-full space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">إرسال مصروفات للموكل</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm">
          <option value="">— اختر قضية —</option>
          {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        {loading && <div className="text-xs text-foreground/50 text-center py-4">جاري التحميل...</div>}
        {!loading && caseId && items.length === 0 && (
          <div className="text-xs text-foreground/50 text-center py-4">لا توجد مصروفات قابلة للاسترداد في هذه القضية</div>
        )}
        {items.length > 0 && (
          <>
            <div className="space-y-1.5 max-h-64 overflow-y-auto border border-border rounded-lg p-2">
              {items.map((e) => (
                <label key={e.id} className="flex items-start gap-2 text-xs bg-elevated rounded p-2 cursor-pointer">
                  <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium">{e.description}</div>
                    <div className="text-foreground/50">{Number(e.amount).toFixed(0)} ج.م</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-between items-center bg-gold/10 border border-gold/30 rounded-lg p-3">
              <span className="text-sm">الإجمالي ({chosen.length})</span>
              <span className="font-bold text-gold text-lg">{total.toFixed(0)} ج.م</span>
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

function Stat({ label, value, color = "" }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="text-xs text-foreground/60">{label}</div>
      <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function NewExpenseDialog({ cases, userId, onClose, onCreated }: {
  cases: { id: string; title: string }[]; userId: string; onClose: () => void; onCreated: () => void;
}) {
  const [caseId, setCaseId] = useState(cases[0]?.id ?? "");
  const [type, setType] = useState("court_fees");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [billable, setBillable] = useState(true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!caseId || !desc.trim() || !amount || saving) return;
    setSaving(true);
    await supabase.from("case_expenses").insert({
      lawyer_id: userId, case_id: caseId, type,
      description: desc.trim(), amount: Number(amount),
      paid_at: paidAt || null, is_billable: billable,
    });
    onCreated();
  }
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">مصروف جديد</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm">
          <option value="">— اختر قضية —</option>
          {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm">
          {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="وصف المصروف *" className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="المبلغ ج.م *" className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm" />
          <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm" />
        </div>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} /> يُضاف للموكل</label>
        <button onClick={save} disabled={!caseId || !desc.trim() || !amount || saving} className="w-full bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-lg shadow-gold disabled:opacity-50">{saving ? "جاري..." : "حفظ"}</button>
      </div>
    </div>
  );
}
