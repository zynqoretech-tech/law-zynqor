import { handleSupabaseError } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDialog, DashStat, EmptyState } from "@/components/DashboardShared";
import { StatusBadge } from "@/components/ui/StatusBadge";

const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

export const Route = createFileRoute("/dashboard/lawyer/billing")({
  head: () => ({ meta: [{ title: "الأتعاب — الوكيل" }] }),
  component: BillingPage,
});

const inputCls = "w-full bg-elevated border border-gold-soft/40 focus:border-gold rounded-lg px-3 py-2.5 text-foreground outline-none text-sm";

function BillingPage() {
  const { userId } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [stats, setStats] = useState({ month: 0, paid: 0, overdue: 0, pending: 0 });
  const [cases, setCases] = useState<any[]>([]);
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [newInvoice, setNewInvoice] = useState({ amount: "", due_date: "", notes: "", case_id: "" });
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showReceipts, setShowReceipts] = useState(false);
  const [chartData, setChartData] = useState<{ month: string; amount: number }[]>([]);
  const [genBusy, setGenBusy] = useState(false);
  const [unbilled, setUnbilled] = useState<{ time: any[]; exp: any[]; total: number } | null>(null);


  const load = async () => {
    if (!userId) return;
    const { data } = await supabase.from("invoices")
      .select("*, client:profiles!client_id(full_name), case:cases!case_id(title)")
      .eq("lawyer_id", userId)
      .order("created_at", { ascending: false });
    const list = data ?? [];
    setInvoices(list);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let m = 0, p = 0, o = 0, pe = 0;
    list.forEach((i: any) => {
      const isReceipt = (i.invoice_number ?? "").startsWith("RCP-");
      const created = new Date(i.created_at);
      if (!isReceipt && created >= monthStart) m += Number(i.total_amount) || 0;
      if (i.status === "paid") p += Number(i.paid_amount) || 0;
      if (!isReceipt && i.status === "overdue") o += Number(i.total_amount) || 0;
      if (!isReceipt && ["pending", "draft", "partial"].includes(i.status)) {
        pe += (Number(i.total_amount) || 0) - (Number(i.paid_amount) || 0);
      }
    });
    setStats({ month: m, paid: p, overdue: o, pending: pe });

    const nowD = new Date();
    const chart: { month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(nowD.getFullYear(), nowD.getMonth() - i, 1);
      const end = new Date(nowD.getFullYear(), nowD.getMonth() - i + 1, 1);
      const monthInvoices = list.filter((inv: any) => {
        if ((inv.invoice_number ?? "").startsWith("RCP-")) return false;
        const cr = new Date(inv.created_at);
        return cr >= d && cr < end;
      });
      const total = monthInvoices.reduce((s: number, inv: any) => s + (Number(inv.total_amount) || 0), 0);
      chart.push({ month: MONTHS_AR[d.getMonth()], amount: total });
    }
    setChartData(chart);
  };


  useEffect(() => { load(); }, [userId]);

  useEffect(() => {
    if (!userId) return;
    supabase.from("cases")
      .select("id, title, client_id, manual_client_id")
      .eq("lawyer_id", userId)
      .eq("status", "active")
      .then(({ data }) => setCases(data ?? []));
  }, [userId]);

  // When a case is selected in the new-invoice modal, fetch unbilled time + expenses
  useEffect(() => {
    if (!newInvoice.case_id) { setUnbilled(null); return; }
    (async () => {
      const [tRes, eRes] = await Promise.all([
        supabase.from("time_entries").select("*")
          .eq("case_id", newInvoice.case_id).eq("is_billable", true).neq("status", "billed"),
        supabase.from("case_expenses").select("*")
          .eq("case_id", newInvoice.case_id).eq("is_billable", true).eq("is_reimbursed", false),
      ]);
      const time = tRes.data ?? [];
      const exp = eRes.data ?? [];
      const total = time.reduce((s, t) => s + (Number(t.billed_amount) || (Number(t.duration_minutes) / 60) * Number(t.hourly_rate) || 0), 0)
                  + exp.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      setUnbilled({ time, exp, total });
    })();
  }, [newInvoice.case_id]);

  async function generateFromUnbilled() {
    if (!unbilled || !newInvoice.case_id) return;
    if (unbilled.time.length === 0 && unbilled.exp.length === 0) {
      return toast.error("لا توجد بنود غير مفوترة لهذه القضية");
    }
    setGenBusy(true);
    try {
      const year = new Date().getFullYear();
      const ts = Date.now().toString().slice(-6);
      const invoiceNumber = `INV-${year}-${ts}`;
      const selectedCase = cases.find((c) => c.id === newInvoice.case_id);
      const items: any[] = [];
      unbilled.time.forEach((t) => {
        const amt = Number(t.billed_amount) || (Number(t.duration_minutes) / 60) * Number(t.hourly_rate);
        items.push({
          description: `⏱ ${t.description} (${(Number(t.duration_minutes) / 60).toFixed(2)} ساعة)`,
          quantity: 1, price: Math.round(amt),
        });
      });
      unbilled.exp.forEach((e) => {
        items.push({ description: `💼 ${e.description}`, quantity: 1, price: Number(e.amount) });
      });
      const total = items.reduce((s, i) => s + i.price, 0);
      const { data: inv, error } = await supabase.from("invoices").insert({
        invoice_number: invoiceNumber,
        lawyer_id: userId,
        client_id: selectedCase?.client_id ?? null,
        manual_client_id: selectedCase?.manual_client_id ?? null,
        case_id: newInvoice.case_id,
        amount: total, paid_amount: 0, tax_percent: 0, tax_amount: 0, total_amount: total,
        status: "pending",
        due_date: newInvoice.due_date || null,
        notes: newInvoice.notes || `فاتورة آلية من ${unbilled.time.length} ساعة عمل و ${unbilled.exp.length} مصروف`,
        line_items: items,
      }).select().single();
      if (error) throw error;
      // Mark time entries as billed, expenses as reimbursed
      if (unbilled.time.length) {
        await supabase.from("time_entries").update({ status: "billed" })
          .in("id", unbilled.time.map((t) => t.id));
      }
      if (unbilled.exp.length) {
        await supabase.from("case_expenses").update({ is_reimbursed: true })
          .in("id", unbilled.exp.map((e) => e.id));
      }
      toast.success(`تم إنشاء فاتورة ${inv?.invoice_number} بقيمة ${total.toLocaleString()} ج ✓`);
      setShowNewInvoice(false);
      setNewInvoice({ amount: "", due_date: "", notes: "", case_id: "" });
      setUnbilled(null);
      load();
    } catch (e) {
      toast.error(handleSupabaseError(e));
    } finally {
      setGenBusy(false);
    }
  }

  async function createInvoice() {
    const amount = Number(newInvoice.amount);
    if (!amount || amount <= 0) return toast.error("أدخل مبلغاً صحيحاً");
    setCreating(true);
    try {
      const year = new Date().getFullYear();
      const ts = Date.now().toString().slice(-6);
      const invoiceNumber = `INV-${year}-${ts}`;
      const selectedCase = cases.find((c) => c.id === newInvoice.case_id);
      const clientId = selectedCase?.client_id ?? null;
      const { error } = await supabase.from("invoices").insert({
        invoice_number: invoiceNumber,
        lawyer_id: userId,
        client_id: clientId,
        manual_client_id: selectedCase?.manual_client_id ?? null,
        case_id: newInvoice.case_id || null,
        amount,
        paid_amount: 0,
        tax_percent: 0,
        tax_amount: 0,
        total_amount: amount,
        status: "pending",
        due_date: newInvoice.due_date || null,
        notes: newInvoice.notes || null,
        line_items: [{ description: "أتعاب قانونية", quantity: 1, price: amount }],
      });
      if (error) throw error;
      toast.success(`تم إنشاء الفاتورة ${invoiceNumber} ✓`);
      setShowNewInvoice(false);
      setNewInvoice({ amount: "", due_date: "", notes: "", case_id: "" });
      load();
    } catch (e) {
      toast.error(handleSupabaseError(e));
    } finally {
      setCreating(false);
    }
  }

  async function markPaid(invoiceId: string, totalAmount: number) {
    const { error } = await supabase.from("invoices").update({
      status: "paid",
      paid_amount: totalAmount,
    }).eq("id", invoiceId);
    if (error) return toast.error(error.message);
    toast.success("تم تحديد الفاتورة كمدفوعة ✓");
    load();
  }

  async function deleteInvoice() {
    if (!confirmDelete) return;
    const { error } = await supabase.from("invoices").delete().eq("id", confirmDelete);
    setConfirmDelete(null);
    if (error) return toast.error(error.message);
    toast.success("تم حذف الفاتورة");
    load();
  }

  function printInvoice(inv: any) {
    const content = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة ${inv.invoice_number}</title>
        <style>
          body { font-family: 'Arial', sans-serif; direction: rtl; padding: 40px; color: #1a1a2e; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #c9a227; padding-bottom: 20px; }
          .logo { font-size: 32px; font-weight: bold; color: #c9a227; }
          .subtitle { color: #666; font-size: 12px; letter-spacing: 0.3em; }
          .invoice-num { font-size: 14px; color: #666; margin-top: 10px; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .label { color: #666; }
          .value { font-weight: bold; }
          .total-row { font-size: 18px; font-weight: bold; color: #c9a227; margin-top: 20px; padding-top: 10px; border-top: 2px solid #c9a227; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">الوكيل</div>
          <div class="subtitle">AL-WAKEEL</div>
          <div class="invoice-num">فاتورة رقم: ${inv.invoice_number}</div>
          <div class="invoice-num">${new Date(inv.created_at).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}</div>
        </div>
        <div class="row"><span class="label">الموكل</span><span class="value">${inv.client?.full_name ?? "—"}</span></div>
        ${inv.case?.title ? `<div class="row"><span class="label">القضية</span><span class="value">${inv.case.title}</span></div>` : ""}
        <div class="row"><span class="label">المبلغ</span><span class="value">${Number(inv.total_amount).toLocaleString()} جنيه</span></div>
        <div class="row"><span class="label">المدفوع</span><span class="value">${Number(inv.paid_amount).toLocaleString()} جنيه</span></div>
        ${inv.due_date ? `<div class="row"><span class="label">تاريخ الاستحقاق</span><span class="value">${new Date(inv.due_date).toLocaleDateString("ar-EG")}</span></div>` : ""}
        <div class="row total-row"><span>الإجمالي المتبقي</span><span>${(Number(inv.total_amount) - Number(inv.paid_amount)).toLocaleString()} جنيه</span></div>
        ${inv.notes ? `<div style="margin-top:20px;color:#666;font-size:13px;">${inv.notes}</div>` : ""}
        <div class="footer">الوكيل — منصة قانونية ذكية</div>
      </body>
      </html>
    `;
    const w = window.open("", "_blank", "width=800,height=600");
    if (w) {
      w.document.write(content);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 300);
    }
  }

  const displayInvoices = showReceipts
    ? invoices
    : invoices.filter((i) => !i.invoice_number?.startsWith("RCP-"));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-3xl text-gradient-gold font-bold">الأتعاب والفواتير</h1>
        <button
          onClick={() => setShowNewInvoice(true)}
          className="inline-flex items-center gap-2 bg-gold-gradient text-primary-foreground font-semibold px-4 py-2 rounded-lg text-sm shadow-gold">
          <Plus className="h-4 w-4" /> فاتورة جديدة
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashStat label="هذا الشهر" value={`${stats.month.toLocaleString()} ج`} />
        <DashStat label="إجمالي المحصّل" value={`${stats.paid.toLocaleString()} ج`} />
        <DashStat label="متأخر" value={`${stats.overdue.toLocaleString()} ج`} />
        <DashStat label="معلق" value={`${stats.pending.toLocaleString()} ج`} />
      </div>

      {chartData.some((d) => d.amount > 0) && (
        <div className="bg-surface border border-gold-soft/40 rounded-2xl p-5">
          <div className="font-display text-lg text-gradient-gold mb-4">الإيرادات — آخر 6 أشهر</div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => (v > 0 ? `${(v / 1000).toFixed(0)}k` : "0")} />
                <Tooltip
                  formatter={(value: number) => [`${value.toLocaleString()} ج`, "الإيرادات"]}
                  contentStyle={{ background: "var(--overlay)", border: "1px solid rgba(201,162,39,0.3)", borderRadius: "12px", fontSize: 12, direction: "rtl" }}
                  cursor={{ fill: "rgba(201,162,39,0.08)" }} />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {chartData.map((_e, idx) => (
                    <Cell key={idx} fill={idx === chartData.length - 1 ? "#c9a227" : "rgba(201,162,39,0.4)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {invoices.length > 0 && (
        <div className="bg-surface border border-gold-soft/40 rounded-2xl p-5">
          <div className="text-xs text-foreground/60 mb-3">نظرة عامة</div>
          <div className="space-y-3">
            {(() => {
              const officialInvoices = invoices.filter((i) => !(i.invoice_number ?? "").startsWith("RCP-"));
              const grandTotal = officialInvoices.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
              const items = [
                { label: "مدفوع", value: stats.paid, color: "bg-green-500" },
                { label: "معلق", value: stats.pending, color: "bg-yellow-500" },
                { label: "متأخر", value: stats.overdue, color: "bg-red-500" },
              ];
              return items.map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs text-foreground/60 mb-1">
                    <span>{item.label}</span>
                    <span>{item.value.toLocaleString()} ج</span>
                  </div>
                  <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full transition-all`}
                      style={{ width: grandTotal > 0 ? `${Math.min(100, (item.value / grandTotal) * 100)}%` : "0%" }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {invoices.length === 0 ? (
          <EmptyState icon="🧾" title="لا توجد فواتير بعد" desc="أنشئ فاتورتك الأولى من زر فاتورة جديدة" />
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border text-xs">
              <span className="text-foreground/60">{displayInvoices.length} فاتورة</span>
              <label className="inline-flex items-center gap-2 text-foreground/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showReceipts}
                  onChange={(e) => setShowReceipts(e.target.checked)}
                  className="accent-gold rounded"
                />
                عرض إيصالات الدفع
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-elevated text-foreground/60 text-xs">
                  <tr>
                    <th className="text-right p-3">رقم</th>
                    <th className="text-right p-3">الموكل</th>
                    <th className="text-right p-3">المبلغ</th>
                    <th className="text-right p-3">المدفوع</th>
                    <th className="text-right p-3">الحالة</th>
                    <th className="text-right p-3">التاريخ</th>
                    <th className="text-right p-3">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {displayInvoices.map((i) => (
                    <tr key={i.id} className="border-t border-border">
                      <td className="p-3 font-mono text-xs">{i.invoice_number}</td>
                      <td className="p-3 text-xs text-foreground/70">{i.client?.full_name ?? "—"}</td>
                      <td className="p-3">{Number(i.total_amount).toLocaleString()} ج</td>
                      <td className="p-3">{Number(i.paid_amount).toLocaleString()} ج</td>
                      <td className="p-3"><StatusBadge status={i.status} /></td>
                      <td className="p-3 text-xs text-foreground/60">{new Date(i.created_at).toLocaleDateString("ar-EG")}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {i.status !== "paid" && (
                            <button onClick={() => markPaid(i.id, Number(i.total_amount))}
                              className="text-xs text-green-400 px-2 py-1 border border-green-500/30 rounded hover:bg-green-500/10 transition"
                              title="تحديد كمدفوع">
                              ✓ مدفوع
                            </button>
                          )}
                          <button onClick={() => printInvoice(i)}
                            className="text-xs text-foreground/50 hover:text-gold px-2 py-1"
                            title="طباعة الفاتورة">
                            🖨️
                          </button>
                          <button onClick={() => setConfirmDelete(i.id)}
                            className="text-xs text-destructive/70 hover:text-destructive px-2 py-1" title="حذف">
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showNewInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between">
              <h3 className="font-display text-xl text-gradient-gold">فاتورة جديدة</h3>
              <button onClick={() => setShowNewInvoice(false)} className="text-foreground/60 hover:text-foreground">✕</button>
            </div>
            <div>
              <label className="block text-xs text-foreground/70 mb-1.5">القضية (اختياري)</label>
              <select value={newInvoice.case_id}
                onChange={(e) => setNewInvoice({ ...newInvoice, case_id: e.target.value })}
                className={inputCls}>
                <option value="">— بدون ربط بقضية —</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
            {unbilled && (unbilled.time.length > 0 || unbilled.exp.length > 0) && (
              <div className="bg-gold/5 border border-gold/30 rounded-lg p-3 space-y-2">
                <div className="text-xs text-foreground/70">
                  بنود غير مفوترة: <b>{unbilled.time.length}</b> ساعة عمل + <b>{unbilled.exp.length}</b> مصروف
                </div>
                <div className="text-sm text-gold font-semibold">
                  الإجمالي المقترح: {Math.round(unbilled.total).toLocaleString()} ج
                </div>
                <button type="button" onClick={generateFromUnbilled} disabled={genBusy}
                  className="w-full bg-gold/20 border border-gold/40 text-gold font-semibold py-2 rounded-lg text-sm hover:bg-gold/30 disabled:opacity-60">
                  {genBusy ? "..." : "⚡ إنشاء فاتورة آلية من البنود غير المفوترة"}
                </button>
              </div>
            )}
            <div>
              <label className="block text-xs text-foreground/70 mb-1.5">المبلغ (ج.م) *</label>
              <input type="number" min="1" value={newInvoice.amount}
                onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })}
                className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-foreground/70 mb-1.5">تاريخ الاستحقاق</label>
              <input type="date" value={newInvoice.due_date}
                onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-foreground/70 mb-1.5">ملاحظات</label>
              <textarea rows={2} value={newInvoice.notes}
                onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
                className={inputCls} />
            </div>
            <div className="flex gap-2">
              <button onClick={createInvoice} disabled={creating}
                className="flex-1 bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-lg disabled:opacity-60">
                {creating ? "جاري الإنشاء..." : "إنشاء الفاتورة"}
              </button>
              <button onClick={() => setShowNewInvoice(false)}
                className="border border-border text-foreground/70 px-4 py-2.5 rounded-lg">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="حذف الفاتورة"
        desc="سيتم حذف هذه الفاتورة نهائياً. هل تريد المتابعة؟"
        onConfirm={deleteInvoice}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
