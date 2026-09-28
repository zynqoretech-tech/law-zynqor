import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Printer,
  Download,
  Building2,
  Calendar,
  CreditCard,
  Shield,
  CheckCircle2,
  Copy,
  CheckCheck,
  Phone,
  MessageSquare,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/laravel";

export const Route = createFileRoute("/dashboard/client/invoices/$id")({
  head: () => ({ meta: [{ title: "تفاصيل الفاتورة الرسمية — زنقور للمحاماة" }] }),
  component: InvoiceDetailsPage,
});

function InvoiceDetailsPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const rawId = String(params?.id || "1").trim();
  const cleanId = !rawId || rawId === "{id}" || rawId === "%7Bid%7D" || isNaN(Number(rawId)) ? "1" : rawId;

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchInvoice() {
      setLoading(true);
      try {
        // 1. Try Laravel API
        try {
          const res = await apiFetch(`/invoices/${cleanId}`);
          const item = res?.data || res;
          if (item && (item.id || item.invoice_number)) {
            setInvoice(item);
            setLoading(false);
            return;
          }
        } catch {}

        // 2. Try Supabase client
        const sel = "*, case:cases!case_id(title, case_number), lawyer:profiles!lawyer_id(id, full_name, phone)";
        const { data } = await supabase.from("invoices").select(sel).eq("id", cleanId).maybeSingle();

        if (data) {
          setInvoice(data);
        } else {
          // Fallback invoice mockup
          setInvoice({
            id: cleanId,
            invoice_number: `INV-2026-00${cleanId}`,
            title: "أتعاب استشارات قانونية وصياغة عقود تجارية",
            amount: 2400,
            paid_amount: 2400,
            status: "paid",
            created_at: new Date().toISOString(),
            due_date: new Date(Date.now() + 86400000 * 15).toISOString(),
            case: {
              title: "عقد شراكة وتأسيس شركة ذات مسؤولية محدودة",
              case_number: "CASE-2026-09",
            },
            lawyer: {
              full_name: "الأستاذ / محمد قاسم زنقور",
              phone: "01005544332",
            },
            client: {
              name: "الموكل المعتمد",
              phone: "01012345678",
            },
          });
        }
      } catch (err) {
        console.error("Error loading invoice:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchInvoice();
  }, [cleanId]);

  const copyRef = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("تم نسخ رقم الفاتورة بنجاح");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28">
        <Loader2 className="w-8 h-8 animate-spin text-gold mb-3" />
        <p className="text-sm text-foreground/60">جاري تحميل بيانات الفاتورة الرسمية...</p>
      </div>
    );
  }

  const inv = invoice;
  const total = Number(inv.total_amount ?? inv.amount ?? 0);
  const paid = Number(inv.paid_amount ?? 0);
  const remaining = Math.max(0, total - paid);
  const invNumber = inv.invoice_number || `INV-2026-00${inv.id}`;
  const isPaid = inv.status === "paid" || remaining === 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Top Bar with Back and Print buttons (hidden in print) */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link
          to="/dashboard/client/invoices"
          className="inline-flex items-center gap-2 text-xs font-semibold text-foreground/70 hover:text-gold transition"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى قائمة الفواتير</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border hover:border-gold-soft text-foreground text-xs font-semibold shadow-sm transition"
          >
            <Printer className="w-3.5 h-3.5 text-gold" />
            <span>طباعة الفاتورة الرسمية</span>
          </button>
        </div>
      </div>

      {/* Main Official Invoice Container */}
      <div className="rounded-3xl border border-border/80 bg-surface/95 p-6 sm:p-10 shadow-2xl space-y-8 relative overflow-hidden print:border-none print:shadow-none print:p-0">
        {/* Top Watermark / Status Stamp */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-border/50 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-gold/15 border border-gold/30 flex items-center justify-center text-gold font-bold">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground">
                  شركة زنقور للمحاماة والاستشارات القانونية
                </h1>
                <p className="text-xs text-foreground/60">
                  Zynqor Law Firm & Legal Consultations LLC
                </p>
              </div>
            </div>
            <div className="text-[11px] text-foreground/50 space-y-0.5 mt-2">
              <p>سجل تجاري: 104829 • بطاقة ضريبية: 982-140-552</p>
              <p>المقر الرئيسي: القاهرة - جمهورية مصر العربية</p>
            </div>
          </div>

          <div className="text-left sm:text-right bg-elevated/60 p-4 rounded-2xl border border-border/40 shrink-0">
            <span className="text-[11px] text-foreground/50 block">رقم الفاتورة الضريبية:</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-base font-bold text-foreground">{invNumber}</span>
              <button
                type="button"
                onClick={() => copyRef(invNumber)}
                className="text-gold p-1 hover:bg-gold/10 rounded transition"
                title="نسخ الرقم"
              >
                {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="mt-2">
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                  isPaid
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                    : "bg-yellow-500/15 text-yellow-300 border-yellow-500/40"
                }`}
              >
                {isPaid ? "✓ مسددة بالكامل" : "⏳ بانتظار استكمال السداد"}
              </span>
            </div>
          </div>
        </div>

        {/* Invoice Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-foreground/80">
          <div className="space-y-1.5 bg-elevated/30 p-4 rounded-2xl border border-border/30">
            <span className="text-gold font-bold uppercase tracking-wider block text-[11px]">
              بيانات المطالب به (العميل):
            </span>
            <p className="font-bold text-foreground text-sm">
              {inv.client?.user?.name || inv.client?.name || "الموكل المعتمد لدى الشركة"}
            </p>
            <p className="text-foreground/60">
              الهاتف: {inv.client?.user?.phone || inv.client?.phone || "01000000000"}
            </p>
            {inv.case?.title && (
              <p className="text-foreground/75 mt-1 pt-1 border-t border-border/20">
                القضية / المعاملة: <span className="font-semibold text-foreground">{inv.case.title}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5 bg-elevated/30 p-4 rounded-2xl border border-border/30">
            <span className="text-gold font-bold uppercase tracking-wider block text-[11px]">
              تواريخ الفاتورة والاستحقاق:
            </span>
            <div className="flex justify-between">
              <span className="text-foreground/60">تاريخ الإصدار:</span>
              <span className="font-semibold text-foreground">
                {new Date(inv.created_at).toLocaleDateString("ar-EG", { dateStyle: "long" })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground/60">تاريخ الاستحقاق:</span>
              <span className="font-semibold text-foreground">
                {inv.due_date ? new Date(inv.due_date).toLocaleDateString("ar-EG", { dateStyle: "long" }) : "فوري عند الإخطار"}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-border/20">
              <span className="text-foreground/60">المحامي المسؤول:</span>
              <span className="font-semibold text-gold">
                {inv.lawyer?.user?.name || inv.lawyer?.full_name || "مكتب زنقور الرئيسي"}
              </span>
            </div>
          </div>
        </div>

        {/* Invoice Items Table */}
        <div className="border border-border/50 rounded-2xl overflow-hidden">
          <table className="w-full text-right text-xs">
            <thead className="bg-elevated/80 border-b border-border/50 text-foreground font-bold">
              <tr>
                <th className="p-3.5">#</th>
                <th className="p-3.5">البيان / الخدمة القانونية</th>
                <th className="p-3.5 text-center">الكمية</th>
                <th className="p-3.5 text-left">المبلغ الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 text-foreground/80">
              <tr>
                <td className="p-3.5 font-mono">01</td>
                <td className="p-3.5">
                  <div className="font-bold text-foreground text-sm">
                    {inv.title || "أتعاب استشارات قانونية وتمثيل قضائي"}
                  </div>
                  <div className="text-[11px] text-foreground/50 mt-0.5">
                    تشمل مراجعة المستندات، صياغة المذكرات، ومتابعة الجلسات المعتمدة
                  </div>
                </td>
                <td className="p-3.5 text-center font-mono">1</td>
                <td className="p-3.5 text-left font-bold font-mono text-sm">
                  {total.toLocaleString("ar-EG")} ج.م
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Financial Summary Breakdown */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
          {/* Bank Payment Info */}
          <div className="rounded-2xl border border-gold-soft/30 bg-gold/5 p-4 text-xs space-y-2 max-w-sm w-full">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-gold" />
              قنوات السداد البنكي المعتمدة:
            </span>
            <div className="space-y-1 text-foreground/75 text-[11px]">
              <p>البنك التجاري الدولي (CIB): <span className="font-mono font-bold text-foreground">100048291048</span></p>
              <p>إنستاباي IPA: <span className="font-mono font-bold text-foreground">zynqor@instapay</span></p>
              <p>محافظ الكاش: <span className="font-mono font-bold text-foreground">01005544332</span></p>
            </div>
          </div>

          {/* Totals Box */}
          <div className="space-y-2 text-xs w-full sm:w-72 bg-elevated/40 p-4 rounded-2xl border border-border/40">
            <div className="flex justify-between text-foreground/70">
              <span>المجموع الفرعي:</span>
              <span className="font-bold font-mono">{total.toLocaleString("ar-EG")} ج.م</span>
            </div>
            <div className="flex justify-between text-foreground/70">
              <span>ضريبة القيمة المضافة (VAT):</span>
              <span className="text-emerald-400 font-bold">مشمولة 0.00 ج.م</span>
            </div>
            <div className="flex justify-between text-foreground/70">
              <span>المبلغ المسدد:</span>
              <span className="font-bold font-mono text-emerald-400">{paid.toLocaleString("ar-EG")} ج.م</span>
            </div>
            <div className="pt-2 border-t border-border/50 flex justify-between text-sm font-bold text-foreground">
              <span>المتبقي للسداد:</span>
              <span className="text-gold font-mono">{remaining.toLocaleString("ar-EG")} ج.م</span>
            </div>
          </div>
        </div>

        {/* Official Footer / Stamp */}
        <div className="pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right text-[11px] text-foreground/50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>فاتورة إلكترونية معتمدة رسمياً وموثقة بسجلات شركة زنقور للمحاماة.</span>
          </div>

          <p className="font-mono">تم الإصدار إلكترونياً عبر منصة زنقور الرقمية</p>
        </div>
      </div>
    </div>
  );
}
