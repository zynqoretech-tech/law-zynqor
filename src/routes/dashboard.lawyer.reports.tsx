import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3, Scale, Clock, Wallet, Receipt, TrendingUp, CheckSquare,
  Calendar, Users, Printer, Download, Search, Filter, CheckCircle2,
  AlertTriangle, ShieldCheck, FileText, ArrowUpRight, Award, FolderKanban
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, CartesianGrid
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/dashboard/lawyer/reports")({
  head: () => ({ meta: [{ title: "التقارير والإحصائيات الشاملة — الوكيل" }] }),
  component: ReportsPage,
});

type TimeRange = "30" | "90" | "365" | "all";
type ReportSection = "all" | "financial" | "cases" | "productivity" | "deadlines_tasks" | "roster";

const STATUS_LABELS: Record<string, string> = {
  active: "نشطة",
  open: "مفتوحة",
  won: "كسبت (رابحة)",
  closed: "مغلقة",
  lost: "خسرت",
  on_hold: "معلقة",
  pending: "قيد المراجعة",
};

const STAGE_LABELS: Record<string, string> = {
  investigation: "التحقيق والنيابة",
  first_instance: "المحكمة الابتدائية",
  appeal: "محكمة الاستئناف",
  cassation: "محكمة النقض",
  enforcement: "مرحلة التنفيذ",
  settlement: "التسوية والمفاوضات",
};

const CHART_COLORS = ["#c9a13b", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#6b7280"];

function ReportsPage() {
  const { userId } = useAuth();
  const [period, setPeriod] = useState<TimeRange>("90");
  const [activeSection, setActiveSection] = useState<ReportSection>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [caseFilterStatus, setCaseFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  const [rawCases, setRawCases] = useState<any[]>([]);
  const [rawTime, setRawTime] = useState<any[]>([]);
  const [rawExpenses, setRawExpenses] = useState<any[]>([]);
  const [rawInvoices, setRawInvoices] = useState<any[]>([]);
  const [rawTasks, setRawTasks] = useState<any[]>([]);
  const [rawDeadlines, setRawDeadlines] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        let sinceStr: string | null = null;
        if (period !== "all") {
          const since = new Date();
          since.setDate(since.getDate() - Number(period));
          sinceStr = since.toISOString();
        }

        const casesPromise = supabase.from("cases").select("*").eq("lawyer_id", userId);

        let timePromise = supabase.from("time_entries").select("*").eq("lawyer_id", userId);
        let expPromise = supabase.from("case_expenses").select("*").eq("lawyer_id", userId);
        let invPromise = supabase.from("invoices").select("*").eq("lawyer_id", userId);
        let tasksPromise = supabase.from("tasks").select("*").eq("lawyer_id", userId);
        let deadlinesPromise = supabase.from("deadlines").select("*").eq("lawyer_id", userId);

        if (sinceStr) {
          timePromise = timePromise.gte("created_at", sinceStr);
          expPromise = expPromise.gte("created_at", sinceStr);
          invPromise = invPromise.gte("created_at", sinceStr);
          tasksPromise = tasksPromise.gte("created_at", sinceStr);
          deadlinesPromise = deadlinesPromise.gte("created_at", sinceStr);
        }

        const [casesQ, timeQ, expQ, invQ, tasksQ, deadlinesQ] = await Promise.all([
          casesPromise,
          timePromise,
          expPromise,
          invPromise,
          tasksPromise,
          deadlinesPromise,
        ]);

        setRawCases(Array.isArray(casesQ.data) ? casesQ.data : []);
        setRawTime(Array.isArray(timeQ.data) ? timeQ.data : []);
        setRawExpenses(Array.isArray(expQ.data) ? expQ.data : []);
        setRawInvoices(Array.isArray(invQ.data) ? invQ.data : []);
        setRawTasks(Array.isArray(tasksQ.data) ? tasksQ.data : []);
        setRawDeadlines(Array.isArray(deadlinesQ.data) ? deadlinesQ.data : []);
      } catch (err) {
        console.error("Error loading reports data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, period]);

  // Computed Analytical Metrics
  const metrics = useMemo(() => {
    const totalCases = rawCases.length;
    const activeCases = rawCases.filter((c) => c.status === "active" || c.status === "open").length;
    const wonCases = rawCases.filter((c) => c.status === "won").length;
    const lostCases = rawCases.filter((c) => c.status === "lost").length;
    const closedCases = rawCases.filter((c) => c.status === "closed" || c.status === "won" || c.status === "lost").length;

    const winRate = (wonCases + lostCases) > 0
      ? Math.round((wonCases / (wonCases + lostCases)) * 100)
      : totalCases > 0 && wonCases > 0
      ? Math.round((wonCases / totalCases) * 100)
      : 0;

    const totalHours = rawTime.reduce((s, t) => s + (Number(t.duration_minutes) || 0) / 60, 0);
    const billableHours = rawTime.filter((t) => t.is_billable).reduce((s, t) => s + (Number(t.duration_minutes) || 0) / 60, 0);
    const billableValue = rawTime.filter((t) => t.is_billable).reduce((s, t) => s + (Number(t.billed_amount) || 0), 0);
    const utilizationRate = totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0;
    const avgHourlyRate = billableHours > 0 ? Math.round(billableValue / billableHours) : 0;

    const totalExpenses = rawExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const reimbursableExpenses = rawExpenses.filter((e) => e.is_billable && !e.is_reimbursed).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const reimbursedExpenses = rawExpenses.filter((e) => e.is_reimbursed).reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const totalInvoiced = rawInvoices.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
    const totalPaid = rawInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
    const totalOutstanding = rawInvoices.filter((i) => i.status !== "paid").reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
    const collectionRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

    const uniqueClientsCount = new Set(rawCases.map((c) => c.client_id).filter(Boolean)).size;

    const totalTasks = rawTasks.length;
    const completedTasks = rawTasks.filter((t) => t.status === "completed" || t.status === "done").length;
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const now = new Date();
    const next7Days = new Date();
    next7Days.setDate(now.getDate() + 7);

    const totalDeadlines = rawDeadlines.length;
    const upcomingDeadlines7Days = rawDeadlines.filter((d) => {
      const dateVal = d.deadline_date || d.due_date;
      if (!dateVal) return false;
      const dt = new Date(dateVal);
      return dt >= now && dt <= next7Days && d.status !== "completed";
    }).length;

    // Distribution by Status
    const byStatusMap: Record<string, number> = {};
    rawCases.forEach((c) => {
      const s = c.status || "open";
      byStatusMap[s] = (byStatusMap[s] || 0) + 1;
    });

    const statusChartData = Object.entries(byStatusMap).map(([k, v]) => ({
      key: k,
      name: STATUS_LABELS[k] || k,
      value: v,
    }));

    // Distribution by Stage
    const byStageMap: Record<string, number> = {};
    rawCases.forEach((c) => {
      if (c.stage) {
        byStageMap[c.stage] = (byStageMap[c.stage] || 0) + 1;
      }
    });

    // Distribution by Court
    const byCourtMap: Record<string, number> = {};
    rawCases.forEach((c) => {
      if (c.court_name) {
        byCourtMap[c.court_name] = (byCourtMap[c.court_name] || 0) + 1;
      }
    });

    return {
      totalCases,
      activeCases,
      wonCases,
      lostCases,
      closedCases,
      winRate,
      totalHours,
      billableHours,
      billableValue,
      utilizationRate,
      avgHourlyRate,
      totalExpenses,
      reimbursableExpenses,
      reimbursedExpenses,
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      collectionRate,
      uniqueClientsCount,
      totalTasks,
      completedTasks,
      taskCompletionRate,
      totalDeadlines,
      upcomingDeadlines7Days,
      statusChartData,
      byStatusMap,
      byStageMap,
      byCourtMap,
    };
  }, [rawCases, rawTime, rawExpenses, rawInvoices, rawTasks, rawDeadlines]);

  // Filtered Cases Roster
  const filteredCases = useMemo(() => {
    return rawCases.filter((c) => {
      const matchesSearch =
        !searchTerm.trim() ||
        (c.title && c.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.case_number && String(c.case_number).toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.court_name && c.court_name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = caseFilterStatus === "all" || c.status === caseFilterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [rawCases, searchTerm, caseFilterStatus]);

  const money = (n: number) => `${Math.round(n).toLocaleString("ar-EG")} ج.م`;

  // CSV Export handler
  const handleExportCSV = () => {
    const headerRows = [
      ["تقرير الأداء الشامل لمكتب المحاماة"],
      [`الفترة: ${period === "all" ? "جميع الفترات" : period + " يوم"}`, `تاريخ الإصدار: ${new Date().toLocaleDateString("ar-EG")}`],
      [],
      ["المؤشر العام", "القيمة"],
      ["إجمالي القضايا المسجلة", metrics.totalCases],
      ["القضايا النشطة", metrics.activeCases],
      ["القضايا الرابحة", metrics.wonCases],
      ["القضايا المغلقة", metrics.closedCases],
      ["نسبة كسب القضايا", `${metrics.winRate}%`],
      ["إجمالي ساعات العمل", metrics.totalHours.toFixed(1)],
      ["ساعات قابلة للفوترة", metrics.billableHours.toFixed(1)],
      ["نسبة استغلال الساعات", `${metrics.utilizationRate}%`],
      ["قيمة الساعات المفوترة", Math.round(metrics.billableValue)],
      ["إجمالي الفواتير الصادرة", Math.round(metrics.totalInvoiced)],
      ["المبالغ المحصلة", Math.round(metrics.totalPaid)],
      ["المستحقات غير المحصلة", Math.round(metrics.totalOutstanding)],
      ["نسبة التحصيل", `${metrics.collectionRate}%`],
      ["إجمالي المصروفات القضائية", Math.round(metrics.totalExpenses)],
      ["المصروفات المستردة", Math.round(metrics.reimbursedExpenses)],
      ["المصروفات المعلقة للاسترداد", Math.round(metrics.reimbursableExpenses)],
      ["إجمالي الموكلين", metrics.uniqueClientsCount],
      ["المهام المنفذة", `${metrics.completedTasks} من ${metrics.totalTasks}`],
      ["الآجال القضائية القادمة (خلال 7 أيام)", metrics.upcomingDeadlines7Days],
      [],
      ["جدول تفاصيل القضايا"],
      ["رقم القضية", "عنوان القضية", "المحكمة", "المرحلة", "الحالة", "الأتعاب المتفق عليها", "المسدد", "تاريخ الجلسة القادمة"],
    ];

    const caseRows = rawCases.map((c) => [
      c.case_number || "—",
      `"${(c.title || "").replace(/"/g, '""')}"`,
      `"${(c.court_name || "—").replace(/"/g, '""')}"`,
      STAGE_LABELS[c.stage] || c.stage || "—",
      STATUS_LABELS[c.status] || c.status || "—",
      Number(c.fee_agreed || 0),
      Number(c.fee_paid || 0),
      c.next_hearing_date ? new Date(c.next_hearing_date).toLocaleDateString("ar-EG") : "—",
    ]);

    const csvContent = "\uFEFF" + [...headerRows, ...caseRows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lawyer-comprehensive-report-${period}d-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 pb-16 print:p-0 print:space-y-4">
      {/* Top Header & Global Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-display text-3xl text-gradient-gold font-bold inline-flex items-center gap-2.5">
            <BarChart3 className="h-8 w-8 text-gold" /> التقارير والإحصائيات الشاملة
          </h1>
          <p className="text-foreground/60 text-sm mt-1">
            تحليل دقيق لأداء المكتب، المحفظة القضائية، التدفق المالي، والإنتاجية المهنية
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex gap-1 bg-surface border border-gold-soft/30 rounded-xl p-1">
            {([
              ["30", "30 يوماً"],
              ["90", "3 أشهر"],
              ["365", "سنة كاملة"],
              ["all", "جميع الفترات"],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setPeriod(val)}
                className={`text-xs px-3 py-1.5 rounded-lg transition font-medium ${
                  period === val
                    ? "bg-gold text-primary-foreground font-bold shadow-sm"
                    : "text-foreground/70 hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-xs border border-gold-soft/40 text-foreground/80 hover:text-gold hover:border-gold px-3.5 py-2 rounded-xl transition bg-surface/70"
            title="طباعة التقرير أو حفظه بصيغة PDF"
          >
            <Printer className="h-3.5 w-3.5" /> طباعة التقرير
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 text-xs bg-gold/10 border border-gold/40 text-gold hover:bg-gold hover:text-primary-foreground px-3.5 py-2 rounded-xl transition font-medium"
            title="تصدير بيانات التقرير بتنسيق Excel CSV"
          >
            <Download className="h-3.5 w-3.5" /> تصدير Excel / CSV
          </button>
        </div>
      </div>

      {/* Section Arrangement Navigation Bar */}
      <div className="flex gap-2 p-1.5 bg-surface border border-gold-soft/30 rounded-2xl overflow-x-auto print:hidden">
        {[
          { key: "all", label: "📊 لوحة المؤشرات الكاملة" },
          { key: "financial", label: "💰 المالية والتحصيل" },
          { key: "cases", label: "⚖️ القضايا ومراحل التقاضي" },
          { key: "productivity", label: "⏱️ إنتاجية وساعات العمل" },
          { key: "deadlines_tasks", label: "📅 الآجال والمهام" },
          { key: "roster", label: "📋 سجل القضايا الشامل" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveSection(tab.key as ReportSection)}
            className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeSection === tab.key
                ? "bg-gold text-primary-foreground shadow-gold"
                : "text-foreground/70 hover:text-foreground hover:bg-elevated/40"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-surface border border-border rounded-2xl h-28 animate-pulse" />
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-surface border border-border rounded-2xl h-72 animate-pulse" />
            <div className="bg-surface border border-border rounded-2xl h-72 animate-pulse" />
          </div>
        </div>
      ) : (
        <>
          {/* Executive KPI Ribbon (Top 6 Highlight Metric Cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <ExecutiveKpiCard
              icon={Award}
              label="معدل كسب القضايا"
              value={`${metrics.winRate}%`}
              sub={`${metrics.wonCases} رابحة • ${metrics.closedCases} مغلقة`}
              highlight={metrics.winRate >= 70 ? "green" : "neutral"}
            />
            <ExecutiveKpiCard
              icon={Receipt}
              label="إجمالي الفواتير"
              value={money(metrics.totalInvoiced)}
              sub={`محصل: ${money(metrics.totalPaid)} (${metrics.collectionRate}%)`}
              highlight="neutral"
            />
            <ExecutiveKpiCard
              icon={AlertTriangle}
              label="المستحقات المعلقة"
              value={money(metrics.totalOutstanding)}
              sub="فواتير قيد التحصيل"
              highlight={metrics.totalOutstanding > 0 ? "amber" : "green"}
            />
            <ExecutiveKpiCard
              icon={Clock}
              label="ساعات العمل"
              value={`${metrics.totalHours.toFixed(1)} س`}
              sub={`${metrics.billableHours.toFixed(1)} س قابلة للفوترة (${metrics.utilizationRate}%)`}
              highlight="neutral"
            />
            <ExecutiveKpiCard
              icon={TrendingUp}
              label="قيمة الساعات"
              value={money(metrics.billableValue)}
              sub={`معدل: ${money(metrics.avgHourlyRate)}/س`}
              highlight="gold"
            />
            <ExecutiveKpiCard
              icon={CheckSquare}
              label="المهام والآجال"
              value={`${metrics.completedTasks}/${metrics.totalTasks}`}
              sub={`${metrics.upcomingDeadlines7Days} آجال قادمة (7 أيام)`}
              highlight={metrics.upcomingDeadlines7Days > 0 ? "amber" : "neutral"}
            />
          </div>

          {/* SECTION 1: Financial & Collections */}
          {(activeSection === "all" || activeSection === "financial") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gold-soft/20 pb-2">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-gold" />
                  <h2 className="font-display text-xl font-bold text-foreground">التحليل المالي والتدفق النقدي</h2>
                </div>
                <span className="text-xs text-foreground/50">الفترة: {period === "all" ? "الكل" : `${period} يوم`}</span>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Cashflow Bar Chart */}
                <div className="bg-surface border border-gold-soft/30 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm text-foreground">مقارنة المبالغ المحصلة والمعلقة والمصروفات</h3>
                    <span className="text-xs text-gold font-medium">معدل التحصيل: {metrics.collectionRate}%</span>
                  </div>
                  <div style={{ width: "100%", height: 260 }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={[
                          { name: "المحصل", value: metrics.totalPaid, fill: "#10b981" },
                          { name: "المعلق", value: metrics.totalOutstanding, fill: "#f59e0b" },
                          { name: "قيمة الساعات", value: Math.round(metrics.billableValue), fill: "#c9a13b" },
                          { name: "المصروفات", value: metrics.totalExpenses, fill: "#ef4444" },
                        ]}
                        margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                        <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} />
                        <YAxis stroke="#888" fontSize={11} tickLine={false} />
                        <Tooltip
                          formatter={(v: any) => [`${Math.round(v).toLocaleString("ar-EG")} ج.م`, "المبلغ"]}
                          contentStyle={{ background: "#111827", borderColor: "#374151", borderRadius: "8px", fontSize: "12px" }}
                        />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Financial Summary & Breakdown Cards */}
                <div className="bg-surface border border-gold-soft/30 rounded-2xl p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-foreground mb-4">المؤشرات المالية والمصروفات المستردة</h3>

                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between text-xs p-3 bg-elevated/60 rounded-xl border border-gold-soft/10">
                        <span className="text-foreground/70">إجمالي الفواتير الصادرة</span>
                        <span className="font-bold font-mono text-sm text-foreground">{money(metrics.totalInvoiced)}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                        <span className="text-emerald-400 font-medium">المبالغ المسددة والمحصلة فعلياً</span>
                        <span className="font-bold font-mono text-sm text-emerald-400">{money(metrics.totalPaid)}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                        <span className="text-amber-400 font-medium">المستحقات المتبقية غير المحصلة</span>
                        <span className="font-bold font-mono text-sm text-amber-400">{money(metrics.totalOutstanding)}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs p-3 bg-elevated/60 rounded-xl border border-gold-soft/10">
                        <span className="text-foreground/70">المصروفات المستردة من الموكلين</span>
                        <span className="font-bold font-mono text-sm text-green-400">{money(metrics.reimbursedExpenses)}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs p-3 bg-elevated/60 rounded-xl border border-gold-soft/10">
                        <span className="text-foreground/70">مصروفات معلقة قابلة للاسترداد</span>
                        <span className="font-bold font-mono text-sm text-gold">{money(metrics.reimbursableExpenses)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gold-soft/20 flex items-center justify-between text-xs text-foreground/50">
                    <span>نسبة تحصيل الأتعاب</span>
                    <div className="flex items-center gap-2">
                      <div className="w-28 h-2 bg-elevated rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, metrics.collectionRate)}%` }} />
                      </div>
                      <span className="font-bold font-mono text-emerald-400">{metrics.collectionRate}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: Case Portfolio & Litigation Stages */}
          {(activeSection === "all" || activeSection === "cases") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gold-soft/20 pb-2">
                <div className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-gold" />
                  <h2 className="font-display text-xl font-bold text-foreground">محفظة القضايا ومراحل التقاضي</h2>
                </div>
                <span className="text-xs text-foreground/50">إجمالي القضايا: {metrics.totalCases}</span>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Donut Chart by Case Status */}
                <div className="bg-surface border border-gold-soft/30 rounded-2xl p-5 shadow-sm">
                  <h3 className="font-bold text-sm text-foreground mb-3">توزيع القضايا حسب الحالة القضائية</h3>
                  {metrics.statusChartData.length === 0 ? (
                    <div className="h-56 flex items-center justify-center text-xs text-foreground/40">لا توجد قضايا مسجلة</div>
                  ) : (
                    <div style={{ width: "100%", height: 260 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={metrics.statusChartData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={4}
                            label={(entry) => `${entry.name} (${entry.value})`}
                          >
                            {metrics.statusChartData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: "#111827", borderColor: "#374151", borderRadius: "8px", fontSize: "12px" }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Litigation Stages Progress Bars */}
                <div className="bg-surface border border-gold-soft/30 rounded-2xl p-5">
                  <h3 className="font-bold text-sm text-foreground mb-4">القضايا حسب مراحل التقاضي</h3>
                  {Object.keys(metrics.byStageMap).length === 0 ? (
                    <div className="h-56 flex items-center justify-center text-xs text-foreground/40">لا توجد مراحل مسجلة حالياً</div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(metrics.byStageMap).map(([stage, count], idx) => {
                        const pct = metrics.totalCases > 0 ? Math.round((count / metrics.totalCases) * 100) : 0;
                        const label = STAGE_LABELS[stage] || stage;
                        const color = CHART_COLORS[idx % CHART_COLORS.length];
                        return (
                          <div key={stage} className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-foreground">{label}</span>
                              <span className="text-foreground/70 font-mono">{count} قضية ({pct}%)</span>
                            </div>
                            <div className="h-2.5 bg-elevated rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Distribution by Courts Summary */}
                  {Object.keys(metrics.byCourtMap).length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gold-soft/20">
                      <div className="text-xs font-semibold text-foreground/70 mb-2">أبرز المحاكم المتداولة:</div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(metrics.byCourtMap).slice(0, 6).map(([court, c]) => (
                          <span key={court} className="text-[11px] bg-elevated border border-gold-soft/20 px-2.5 py-1 rounded-lg text-foreground/80">
                            {court}: <b className="text-gold font-mono">{c}</b>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: Time Tracking & Productivity */}
          {(activeSection === "all" || activeSection === "productivity") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gold-soft/20 pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-gold" />
                  <h2 className="font-display text-xl font-bold text-foreground">إنتاجية وساعات العمل المهني</h2>
                </div>
                <span className="text-xs text-foreground/50">إجمالي الساعات: {metrics.totalHours.toFixed(1)} س</span>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-surface border border-gold-soft/30 rounded-2xl p-5 space-y-2">
                  <div className="text-xs text-foreground/60 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gold" /> نسبة استغلال الساعات (Utilization)
                  </div>
                  <div className="font-display text-3xl font-bold text-gold font-mono">{metrics.utilizationRate}%</div>
                  <p className="text-xs text-foreground/50">
                    من إجمالي ساعات العمل تم تسجيلها كساعات قابلة للفوترة.
                  </p>
                  <div className="h-2 bg-elevated rounded-full overflow-hidden mt-3">
                    <div className="h-full bg-gold rounded-full" style={{ width: `${metrics.utilizationRate}%` }} />
                  </div>
                </div>

                <div className="bg-surface border border-gold-soft/30 rounded-2xl p-5 space-y-2">
                  <div className="text-xs text-foreground/60 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-400" /> متوسط العائد لكل ساعة عمل
                  </div>
                  <div className="font-display text-3xl font-bold text-emerald-400 font-mono">
                    {metrics.avgHourlyRate ? money(metrics.avgHourlyRate) : "—"}
                  </div>
                  <p className="text-xs text-foreground/50">
                    متوسط القيمة المولدة لكل ساعة عمل قابلة للفوترة تم تسجيلها.
                  </p>
                </div>

                <div className="bg-surface border border-gold-soft/30 rounded-2xl p-5 space-y-2">
                  <div className="text-xs text-foreground/60 flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-400" /> محفظة الموكلين النشطة
                  </div>
                  <div className="font-display text-3xl font-bold text-blue-400 font-mono">{metrics.uniqueClientsCount}</div>
                  <p className="text-xs text-foreground/50">
                    عدد الموكلين الذين لديهم قضايا مسجلة في ملفك خلال هذه الفترة.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: Deadlines & Tasks Health */}
          {(activeSection === "all" || activeSection === "deadlines_tasks") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gold-soft/20 pb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-gold" />
                  <h2 className="font-display text-xl font-bold text-foreground">مؤشرات الآجال القانونية والمهام</h2>
                </div>
                <span className="text-xs text-foreground/50">المهام: {metrics.completedTasks}/{metrics.totalTasks}</span>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Deadlines Box */}
                <div className="bg-surface border border-gold-soft/30 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-400" /> الآجال القضائية والجلسات
                    </h3>
                    {metrics.upcomingDeadlines7Days > 0 ? (
                      <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-sans">
                        ⚠️ {metrics.upcomingDeadlines7Days} آجال قادمة خلال 7 أيام
                      </span>
                    ) : (
                      <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/30 px-2.5 py-0.5 rounded-full">
                        ✓ لا توجد آجال طارئة هذا الأسبوع
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-elevated/70 p-3 rounded-xl border border-gold-soft/10">
                      <div className="text-xs text-foreground/60 mb-1">إجمالي الآجال المسجلة</div>
                      <div className="font-display text-2xl font-bold text-foreground font-mono">{metrics.totalDeadlines}</div>
                    </div>
                    <div className="bg-elevated/70 p-3 rounded-xl border border-gold-soft/10">
                      <div className="text-xs text-foreground/60 mb-1">آجال حرجة قادمة</div>
                      <div className="font-display text-2xl font-bold text-amber-400 font-mono">{metrics.upcomingDeadlines7Days}</div>
                    </div>
                  </div>

                  <p className="text-xs text-foreground/50 leading-relaxed">
                    متابعة دورية للآجال القانونية وتواريخ الجلسات تضمن حماية حقوق الموكلين وعدم فوات مواعيد الطعن أو تقديم المستندات.
                  </p>
                </div>

                {/* Tasks Health Box */}
                <div className="bg-surface border border-gold-soft/30 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-gold" /> مؤشر إنجاز المهام المكتبية
                    </h3>
                    <span className="text-xs text-gold font-mono font-bold">{metrics.taskCompletionRate}% إنجاز</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground/70">المهام المكتملة</span>
                      <span className="font-mono text-green-400 font-bold">{metrics.completedTasks} من {metrics.totalTasks}</span>
                    </div>
                    <div className="h-2.5 bg-elevated rounded-full overflow-hidden">
                      <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${metrics.taskCompletionRate}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center pt-2">
                    <div className="bg-green-500/10 p-3 rounded-xl border border-green-500/20">
                      <div className="text-xs text-green-400 mb-1">مهام منجزة ✓</div>
                      <div className="font-display text-2xl font-bold text-green-400 font-mono">{metrics.completedTasks}</div>
                    </div>
                    <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                      <div className="text-xs text-amber-400 mb-1">مهام قيد التنفيذ ⏳</div>
                      <div className="font-display text-2xl font-bold text-amber-400 font-mono">
                        {Math.max(0, metrics.totalTasks - metrics.completedTasks)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: Comprehensive Case Performance Roster */}
          {(activeSection === "all" || activeSection === "roster") && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold-soft/20 pb-2">
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-5 w-5 text-gold" />
                  <h2 className="font-display text-xl font-bold text-foreground">سجل أداء القضايا والمحاكم</h2>
                </div>
                <div className="text-xs text-foreground/50">
                  عرض {filteredCases.length} من أصل {rawCases.length} قضية
                </div>
              </div>

              {/* Search and Filters Bar */}
              <div className="flex flex-wrap gap-3 items-center justify-between print:hidden">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
                  <input
                    type="text"
                    placeholder="ابحث باسم القضية، رقمها، أو المحكمة..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-elevated border border-gold-soft/30 focus:border-gold rounded-xl pr-9 pl-4 py-2 text-xs text-foreground placeholder:text-foreground/40 outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-foreground/50" />
                  <select
                    value={caseFilterStatus}
                    onChange={(e) => setCaseFilterStatus(e.target.value)}
                    style={{ colorScheme: "dark" }}
                    className="bg-elevated border border-gold-soft/30 focus:border-gold text-foreground text-xs rounded-xl px-3 py-2 outline-none cursor-pointer"
                  >
                    <option value="all">كافة الحالات</option>
                    <option value="active">نشطة</option>
                    <option value="open">مفتوحة</option>
                    <option value="won">كسبت (رابحة)</option>
                    <option value="closed">مغلقة</option>
                    <option value="lost">خسرت</option>
                  </select>
                </div>
              </div>

              {/* Case Table */}
              <div className="bg-surface border border-gold-soft/30 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-elevated/70 text-foreground/70 border-b border-gold-soft/20 font-semibold">
                      <tr>
                        <th className="py-3 px-4">رقم القضية والعنوان</th>
                        <th className="py-3 px-4">المحكمة</th>
                        <th className="py-3 px-4">المرحلة القضائية</th>
                        <th className="py-3 px-4">الأتعاب والمسدد</th>
                        <th className="py-3 px-4">الجلسة القادمة</th>
                        <th className="py-3 px-4">الحالة</th>
                        <th className="py-3 px-4 text-left print:hidden">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gold-soft/10">
                      {filteredCases.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-foreground/40">
                            لا توجد قضايا مطابقة لمعايير البحث
                          </td>
                        </tr>
                      ) : (
                        filteredCases.map((c) => {
                          const agreed = Number(c.fee_agreed || 0);
                          const paid = Number(c.fee_paid || 0);
                          const feePct = agreed > 0 ? Math.round((paid / agreed) * 100) : 0;
                          return (
                            <tr key={c.id} className="hover:bg-elevated/40 transition">
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-foreground">{c.title || "بدون عنوان"}</div>
                                <div className="text-[11px] text-foreground/50 font-mono mt-0.5">
                                  رقم: {c.case_number || "—"}
                                </div>
                              </td>

                              <td className="py-3.5 px-4 text-foreground/80">
                                {c.court_name || "غير محددة"}
                              </td>

                              <td className="py-3.5 px-4">
                                <span className="bg-elevated px-2.5 py-1 rounded-md text-[11px] text-foreground/70 border border-gold-soft/20">
                                  {STAGE_LABELS[c.stage] || c.stage || "—"}
                                </span>
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="font-mono font-medium text-foreground">
                                  {money(paid)} <span className="text-foreground/40 text-[10px]">من {money(agreed)}</span>
                                </div>
                                <div className="w-20 h-1.5 bg-elevated rounded-full overflow-hidden mt-1">
                                  <div className="h-full bg-gold rounded-full" style={{ width: `${Math.min(100, feePct)}%` }} />
                                </div>
                              </td>

                              <td className="py-3.5 px-4 text-foreground/70 font-mono text-[11px]">
                                {c.next_hearing_date ? (
                                  <span className="text-amber-400 font-medium">
                                    {new Date(c.next_hearing_date).toLocaleDateString("ar-EG")}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-sans font-medium ${
                                    c.status === "won"
                                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                      : c.status === "active" || c.status === "open"
                                      ? "bg-gold/10 text-gold border border-gold/30"
                                      : c.status === "lost"
                                      ? "bg-red-500/10 text-red-400 border border-red-500/30"
                                      : "bg-elevated text-foreground/60 border border-border"
                                  }`}
                                >
                                  {STATUS_LABELS[c.status] || c.status}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 text-left print:hidden">
                                <a
                                  href={`/dashboard/lawyer/cases/${c.id}`}
                                  className="inline-flex items-center gap-1 text-[11px] text-gold hover:underline border border-gold/30 hover:border-gold px-2.5 py-1 rounded-lg bg-gold/5 transition"
                                >
                                  فتح القضية <ArrowUpRight className="h-3 w-3" />
                                </a>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ExecutiveKpiCard({
  icon: Icon,
  label,
  value,
  sub,
  highlight = "neutral",
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  highlight?: "gold" | "green" | "amber" | "neutral";
}) {
  const borderClass =
    highlight === "amber"
      ? "border-amber-500/40 bg-amber-500/5"
      : highlight === "green"
      ? "border-emerald-500/40 bg-emerald-500/5"
      : highlight === "gold"
      ? "border-gold/40 bg-gold/5"
      : "border-gold-soft/30 bg-surface";

  const textClass =
    highlight === "amber"
      ? "text-amber-400"
      : highlight === "green"
      ? "text-emerald-400"
      : highlight === "gold"
      ? "text-gradient-gold"
      : "text-foreground";

  return (
    <div className={`border rounded-2xl p-4 transition-all hover:scale-[1.01] ${borderClass}`}>
      <div className="flex items-center gap-2 text-xs text-foreground/60 mb-2">
        <Icon className="h-4 w-4 text-gold shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className={`font-display text-xl sm:text-2xl font-bold truncate ${textClass}`}>{value}</div>
      {sub && <div className="text-[10px] text-foreground/50 mt-1 truncate">{sub}</div>}
    </div>
  );
}
