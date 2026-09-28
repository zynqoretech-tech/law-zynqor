import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Receipt, Eye, ArrowLeft, ArrowUpRight, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/laravel";
import { EmptyState } from "@/components/DashboardShared";

export const Route = createFileRoute("/dashboard/client/invoices/")({
  head: () => ({ meta: [{ title: "فواتيري ومستحقاتي — زنقور للمحاماة" }] }),
  component: ClientInvoicesPage,
});

const STATUS_LABELS: Record<string, { l: string; cls: string }> = {
  paid: { l: "مدفوعة بالكامل", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40" },
  pending: { l: "بانتظار السداد", cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40" },
  overdue: { l: "متأخرة", cls: "bg-red-500/15 text-red-300 border-red-500/40" },
  cancelled: { l: "ملغاة", cls: "bg-foreground/5 text-foreground/40 border-border" },
};

function ClientInvoicesPage() {
  const { userId } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInvoices() {
      setLoading(true);
      try {
        // 1. Try Laravel API first
        const apiRes = await apiFetch("/invoices").catch(() => null);
        const list = Array.isArray(apiRes) ? apiRes : apiRes?.data || [];
        if (list.length > 0) {
          setInvoices(list);
          setLoading(false);
          return;
        }
      } catch {}

      // 2. Fallback to Supabase client
      try {
        const sel = "*, case:cases!case_id(title, case_number), lawyer:profiles!lawyer_id(id, full_name, phone)";
        const { data } = await supabase.from("invoices").select(sel).order("created_at", { ascending: false });
        setInvoices(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadInvoices();
  }, [userId]);

  const lawyerPhone = invoices.find((i) => i.lawyer?.phone)?.lawyer?.phone;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
            فواتيري والمستحقات المالية
          </h1>
          <p className="text-xs sm:text-sm text-foreground/60 mt-1">
            متابعة الفواتير الرسمية، المبالغ المسددة، وطرق التحويل البنكي المعتمدة
          </p>
        </div>
        <div className="text-xs font-semibold text-foreground/70 bg-surface px-3 py-1.5 rounded-xl border border-border">
          إجمالي الفواتير: <span className="text-gold font-bold">{invoices.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border/80 rounded-2xl p-5 h-44 animate-pulse" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="لا توجد فواتير بعد"
          desc="ستظهر هنا أي مطالبات أو فواتير قانونية صادرة لأتعابك أو استشاراتك."
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {invoices.map((inv) => {
            const total = Number(inv.total_amount ?? inv.amount ?? 0);
            const paid = Number(inv.paid_amount ?? 0);
            const remaining = Math.max(0, total - paid);
            const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
            const st = STATUS_LABELS[inv.status] ?? {
              l: inv.status || "معلقة",
              cls: "bg-foreground/5 text-foreground/40 border-border",
            };
            const invNumber = inv.invoice_number || `INV-${inv.id}`;

            return (
              <div
                key={inv.id}
                className="bg-surface/90 border border-border/80 hover:border-gold-soft/50 rounded-2xl p-5 space-y-4 shadow-sm transition flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs text-foreground/50 font-mono">رقم الفاتورة: {invNumber}</span>
                      <h3 className="font-bold text-base text-foreground mt-0.5">
                        {inv.title || inv.case?.title || "أتعاب استشارات ومتابعة قانونية"}
                      </h3>
                      {inv.lawyer?.user?.name || inv.lawyer?.full_name ? (
                        <div className="text-xs text-gold/80 mt-0.5">
                          المحامي: {inv.lawyer?.user?.name || inv.lawyer?.full_name}
                        </div>
                      ) : null}
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${st.cls} whitespace-nowrap`}>
                      {st.l}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-elevated/60 rounded-xl p-2.5 border border-border/40">
                      <div className="text-foreground/50">الإجمالي</div>
                      <div className="font-bold text-foreground mt-1 text-sm">{total.toLocaleString("ar-EG")} ج.م</div>
                    </div>
                    <div className="bg-elevated/60 rounded-xl p-2.5 border border-border/40">
                      <div className="text-foreground/50">المدفوع</div>
                      <div className="font-bold text-emerald-400 mt-1 text-sm">{paid.toLocaleString("ar-EG")} ج.م</div>
                    </div>
                    <div className="bg-elevated/60 rounded-xl p-2.5 border border-border/40">
                      <div className="text-foreground/50">المتبقي</div>
                      <div className="font-bold text-gold mt-1 text-sm">{remaining.toLocaleString("ar-EG")} ج.م</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="h-2 bg-elevated rounded-full overflow-hidden">
                      <div className="h-full bg-gold-gradient transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-[11px] text-foreground/50">
                      <span>نسبة السداد: {pct}%</span>
                      {inv.due_date && (
                        <span>الاستحقاق: {new Date(inv.due_date).toLocaleDateString("ar-EG")}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/40">
                  <Link
                    to="/dashboard/client/invoices/$id"
                    params={{ id: String(inv.id) }}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gold/10 hover:bg-gold/20 border border-gold-soft/50 text-gold font-bold text-xs transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>عرض الفاتورة وتفاصيل السداد</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {invoices.length > 0 && lawyerPhone && (
        <div className="bg-surface border border-gold-soft/40 rounded-2xl p-5 text-center">
          <div className="text-xs sm:text-sm text-foreground/70 mb-3 flex items-center justify-center gap-2">
            <Receipt className="h-4 w-4 text-gold" />
            <span>لمناقشة بنود الفاتورة أو تأكيد إيداع التحويل البنكي، تواصل مع المحامي مباشرة:</span>
          </div>
          <a
            href={`https://wa.me/${String(lawyerPhone).replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#25D366] text-white px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition hover:opacity-95"
          >
            <span>💬 تواصل مع المحامي عبر واتساب</span>
          </a>
        </div>
      )}
    </div>
  );
}
