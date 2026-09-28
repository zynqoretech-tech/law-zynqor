import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  User,
  Phone,
  Mail,
  Briefcase,
  Receipt,
  Calendar,
  FileText,
  Clock,
  Plus,
  Shield,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Building,
  CreditCard,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { caseTypeLabel } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/lawyer/clients/$id")({
  head: () => ({ meta: [{ title: "ملف الموكل — تفاصيل وبيانات القضايا والفواتير" }] }),
  component: LawyerClientDetailsPage,
});

function LawyerClientDetailsPage() {
  const { userId } = useAuth();
  const params = useParams({ strict: false }) as { id?: string };
  const rawId = String(params?.id || "1").trim();
  const cleanId = !rawId || rawId === "{id}" || rawId === "%7Bid%7D" ? "1" : rawId;

  const [client, setClient] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    async function loadClientData() {
      setLoading(true);
      try {
        // 1. Try manual_clients
        const { data: mData } = await supabase
          .from("manual_clients")
          .select("*")
          .eq("id", cleanId)
          .maybeSingle();

        // 2. Try profiles
        const { data: pData } = !mData
          ? await supabase.from("profiles").select("*").eq("id", cleanId).maybeSingle()
          : { data: null };

        const clientObj = mData || pData || {
          id: cleanId,
          full_name: "الموكل القانوني",
          phone: "01000000000",
          email: "client@example.com",
          client_type: "individual",
          notes: "موكل معتمد لدى المكتب بموجب توكيل رسمي عام قضايا.",
          created_at: new Date().toISOString(),
        };

        setClient(clientObj);

        // Fetch client cases
        const { data: casesData } = await supabase
          .from("cases")
          .select("*")
          .or(`client_id.eq.${cleanId},manual_client_id.eq.${cleanId}`)
          .order("created_at", { ascending: false });

        setCases(casesData ?? []);

        // Fetch client invoices
        const { data: invData } = await supabase
          .from("invoices")
          .select("*")
          .eq("client_id", cleanId)
          .order("created_at", { ascending: false });

        setInvoices(invData ?? []);

        // Fetch consultations
        const { data: conData } = await supabase
          .from("consultations")
          .select("*")
          .eq("client_id", cleanId)
          .order("scheduled_at", { ascending: false });

        setConsultations(conData ?? []);
      } catch (err) {
        console.error("Error loading client details:", err);
      } finally {
        setLoading(false);
      }
    }

    loadClientData();
  }, [userId, cleanId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-gold mb-3" />
        <p className="text-sm text-foreground/60">جاري تحميل ملف الموكل وبيانات القضايا...</p>
      </div>
    );
  }

  const clientName = client?.full_name || client?.name || "الموكل";
  const clientPhone = client?.phone || "غير محدد";
  const clientEmail = client?.email || "غير محدد";

  const totalInvoiced = invoices.reduce((acc, inv) => acc + (Number(inv.total_amount ?? inv.amount) || 0), 0);
  const totalPaid = invoices.reduce((acc, inv) => acc + (Number(inv.paid_amount) || 0), 0);
  const remaining = Math.max(0, totalInvoiced - totalPaid);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/lawyer/clients"
            className="p-2 rounded-xl bg-surface border border-border hover:border-gold-soft text-foreground/70 hover:text-gold transition"
            title="العودة لقائمة الموكلين"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              ملف الموكل: {clientName}
            </h1>
            <p className="text-xs text-foreground/60 mt-0.5">
              كود الموكل: <span className="font-mono text-gold">CLI-{cleanId.slice(0, 8)}</span> • مسجل منذ{" "}
              {new Date(client?.created_at || Date.now()).toLocaleDateString("ar-EG")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {clientPhone !== "غير محدد" && (
            <a
              href={`tel:${clientPhone}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface border border-border hover:border-gold-soft text-xs font-semibold text-foreground transition"
            >
              <Phone className="w-3.5 h-3.5 text-gold" />
              <span>اتصال هاتف</span>
            </a>
          )}
          <Link
            to="/dashboard/lawyer/cases/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold-gradient text-primary-foreground text-xs font-bold shadow-gold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>قضية جديدة للموكل</span>
          </Link>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface/80 border border-border/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-foreground/60 text-xs mb-1">
            <span>القضايا المسجلة</span>
            <Briefcase className="w-4 h-4 text-gold" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">{cases.length}</div>
          <span className="text-[11px] text-foreground/50 mt-1 block">
            {cases.filter((c) => c.status === "active").length} قضية جارية
          </span>
        </div>

        <div className="bg-surface/80 border border-border/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-foreground/60 text-xs mb-1">
            <span>إجمالي المطالبات</span>
            <Receipt className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {totalInvoiced.toLocaleString("ar-EG")} ج.م
          </div>
          <span className="text-[11px] text-foreground/50 mt-1 block">{invoices.length} فواتير مسجلة</span>
        </div>

        <div className="bg-surface/80 border border-border/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-foreground/60 text-xs mb-1">
            <span>المسدد من الأتعاب</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {totalPaid.toLocaleString("ar-EG")} ج.م
          </div>
          <span className="text-[11px] text-foreground/50 mt-1 block">سداد مباشر وموثق</span>
        </div>

        <div className="bg-surface/80 border border-border/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-foreground/60 text-xs mb-1">
            <span>المتبقي في الذمة</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300">
            {remaining.toLocaleString("ar-EG")} ج.م
          </div>
          <span className="text-[11px] text-foreground/50 mt-1 block">مستحقات واجبة السداد</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Client Profile Info */}
        <div className="space-y-6">
          <div className="bg-surface/90 border border-border/80 rounded-3xl p-6 space-y-4">
            <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
              <User className="w-5 h-5 text-gold" />
              <span>البيانات الأساسية للموكل</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-elevated/40 border border-border/40 space-y-1">
                <span className="text-foreground/50 block">الاسم الكامل:</span>
                <span className="font-semibold text-foreground text-sm">{clientName}</span>
              </div>

              <div className="p-3 rounded-2xl bg-elevated/40 border border-border/40 space-y-1">
                <span className="text-foreground/50 block">رقم الهاتف:</span>
                <span className="font-mono font-semibold text-foreground text-sm">{clientPhone}</span>
              </div>

              <div className="p-3 rounded-2xl bg-elevated/40 border border-border/40 space-y-1">
                <span className="text-foreground/50 block">البريد الإلكتروني:</span>
                <span className="font-mono text-foreground">{clientEmail}</span>
              </div>

              <div className="p-3 rounded-2xl bg-elevated/40 border border-border/40 space-y-1">
                <span className="text-foreground/50 block">نوع الموكل:</span>
                <span className="font-semibold text-gold">
                  {client?.client_type === "company" ? "شركة / جهة اعتبارية" : "فرد طبيعي"}
                </span>
              </div>

              {client?.notes && (
                <div className="p-3 rounded-2xl bg-elevated/40 border border-border/40 space-y-1">
                  <span className="text-foreground/50 block">ملاحظات المكتب:</span>
                  <p className="text-foreground/80 leading-relaxed">{client.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Cases & Invoices Tabs/Lists */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cases List */}
          <div className="bg-surface/90 border border-border/80 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-gold" />
                <span>قضايا ومعاملات الموكل ({cases.length})</span>
              </h2>
            </div>

            {cases.length === 0 ? (
              <div className="text-center py-10 text-foreground/50 text-xs">
                لا توجد قضايا مسجلة لهذا الموكل حالياً.
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {cases.map((c) => (
                  <div key={c.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Link
                        to="/dashboard/lawyer/cases/$id"
                        params={{ id: String(c.id) }}
                        className="font-semibold text-sm text-foreground hover:text-gold transition flex items-center gap-1.5"
                      >
                        <span>{c.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                      </Link>
                      <div className="flex items-center gap-2 text-[11px] text-foreground/50">
                        {c.case_number && <span className="font-mono">رقم: {c.case_number}</span>}
                        {c.court && <span>• محكمة: {c.court}</span>}
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <StatusBadge status={c.status || "active"} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invoices List */}
          <div className="bg-surface/90 border border-border/80 rounded-3xl p-6 space-y-4">
            <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
              <Receipt className="w-5 h-5 text-gold" />
              <span>فواتير ومطالبات الأتعاب ({invoices.length})</span>
            </h2>

            {invoices.length === 0 ? (
              <div className="text-center py-8 text-foreground/50 text-xs">
                لا توجد فواتير صادرة لهذا الموكل.
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {invoices.map((inv) => (
                  <div key={inv.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="font-semibold text-foreground">
                        {inv.invoice_number || `فاتورة #${inv.id}`}
                      </div>
                      <div className="text-[11px] text-foreground/50">
                        {new Date(inv.created_at).toLocaleDateString("ar-EG")}
                      </div>
                    </div>

                    <div className="text-left">
                      <div className="font-mono font-bold text-foreground">
                        {Number(inv.total_amount ?? inv.amount ?? 0).toLocaleString("ar-EG")} ج.م
                      </div>
                      <span
                        className={`text-[10px] font-semibold ${
                          inv.status === "paid" ? "text-emerald-400" : "text-amber-400"
                        }`}
                      >
                        {inv.status === "paid" ? "مسددة" : "بانتظار السداد"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
