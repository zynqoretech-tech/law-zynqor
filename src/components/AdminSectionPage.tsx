import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Ban, Bell, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, FileCheck2, FileText, Gavel, Loader2, RefreshCw, RotateCcw, Search, ShieldCheck, Star, Trash2, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAdminData, setAdminAccountState, deleteAdminAccount, updateAdminPlan, moderateAdminItem, sendAdminNotification } from "@/lib/admin.functions";

type AdminSection = "overview" | "users" | "lawyers" | "clients" | "subscriptions" | "operations" | "invoices" | "moderation" | "notifications" | "audit";
type AdminResult = { section: AdminSection; rows?: any[]; metrics?: Record<string, number>; total?: number; page?: number };

const TITLES: Record<AdminSection, { title: string; description: string }> = {
  overview: { title: "نظرة عامة", description: "ملخص حي لأهم أرقام ونشاطات المنصة." },
  users: { title: "إدارة المستخدمين", description: "البحث في جميع الحسابات والتحكم في حالتها." },
  lawyers: { title: "المحامون والمكاتب", description: "الملفات المهنية وبيانات التواصل وحالة التوثيق." },
  clients: { title: "العملاء", description: "حسابات العملاء وبيانات التواصل وحالة الحساب." },
  subscriptions: { title: "الاشتراكات والمدفوعات", description: "إدارة الخطط ومواعيد الانتهاء والمزايا." },
  operations: { title: "العمليات القانونية", description: "متابعة القضايا والاستشارات وطلبات التوكيل." },
  invoices: { title: "الفواتير", description: "مراجعة الفواتير وحالات السداد والاستحقاق." },
  moderation: { title: "التوثيق والمراجعات", description: "مراجعة توثيق المحامين وتقييمات العملاء." },
  notifications: { title: "الإشعارات", description: "إرسال إعلانات ومتابعة أحدث الإشعارات." },
  audit: { title: "سجل الإدارة", description: "سجل غير قابل للتعديل لكل العمليات الإدارية الحساسة." },
};

function fmtDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
}
function fmtMoney(value?: number | null) {
  return new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(value ?? 0);
}
function roleLabel(role?: string) { return role === "lawyer" ? "محامٍ" : role === "client" ? "عميل" : role === "admin" ? "مدير" : role ?? "—"; }
function statusLabel(status?: string) {
  const labels: Record<string, string> = { active: "نشط", pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض", paid: "مدفوع", unpaid: "غير مدفوع", completed: "مكتمل", confirmed: "مؤكد", cancelled: "ملغي", failed: "فشل", accepted: "مقبول" };
  return labels[status ?? ""] ?? status ?? "—";
}

export function AdminSectionPage({ section }: { section: AdminSection }) {
  const fetchData = useServerFn(getAdminData);
  const setAccountState = useServerFn(setAdminAccountState);
  const deleteAccount = useServerFn(deleteAdminAccount);
  const savePlan = useServerFn(updateAdminPlan);
  const moderate = useServerFn(moderateAdminItem);
  const broadcast = useServerFn(sendAdminNotification);
  const [data, setData] = useState<AdminResult | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [target, setTarget] = useState<any | null>(null);
  const [dialog, setDialog] = useState<"disable" | "delete" | "plan" | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [plan, setPlan] = useState("free");
  const [expires, setExpires] = useState("");
  const title = TITLES[section];

  async function load() {
    setLoading(true);
    try {
      const result = await fetchData({ data: { section, query, page } });
      setData(result as AdminResult);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تحميل البيانات");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [section, page]);
  useEffect(() => {
    if (!["users", "lawyers", "clients"].includes(section)) return;
    const timer = window.setTimeout(() => { setPage(1); void load(); }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  async function run(id: string, action: () => Promise<unknown>, success: string) {
    setBusy(id);
    try { await action(); toast.success(success); setDialog(null); setTarget(null); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تنفيذ العملية"); }
    finally { setBusy(null); }
  }

  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? rows.length) / 25));
  const showSearch = ["users", "lawyers", "clients"].includes(section);

  return (
    <section className="space-y-5" dir="rtl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{title.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{title.description}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} /> تحديث
        </Button>
      </header>

      {showSearch && (
        <div className="relative max-w-xl">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم أو الهاتف أو المدينة..." className="pr-10" />
        </div>
      )}

      {loading && !data ? <LoadingState /> : section === "overview" ? <Overview data={data} /> : section === "notifications" ? (
        <Notifications rows={rows} busy={busy} onSend={(payload) => run("broadcast", () => broadcast({ data: payload }), "تم إرسال الإشعار")} />
      ) : section === "moderation" ? (
        <Moderation rows={rows} busy={busy} onAction={(payload, id, message) => run(id, () => moderate({ data: payload as any }), message)} />
      ) : section === "audit" ? <AuditRows rows={rows} /> : section === "operations" ? <OperationRows rows={rows} /> : section === "invoices" ? <InvoiceRows rows={rows} /> : section === "subscriptions" ? (
        <SubscriptionRows rows={rows} onEdit={(row) => { setTarget(row); setPlan(row.plan ?? "free"); setExpires(row.plan_expires_at?.slice(0, 10) ?? ""); setDialog("plan"); }} />
      ) : <UserRows section={section} rows={rows} onDisable={(row) => { setTarget(row); setReason(""); setDialog("disable"); }} onDelete={(row) => { setTarget(row); setConfirmation(""); setDialog("delete"); }} />}

      {!loading && rows.length === 0 && section !== "overview" && section !== "notifications" && <EmptyState />}
      {(data?.total ?? 0) > 25 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}

      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) { setDialog(null); setTarget(null); } }}>
        <DialogContent dir="rtl" className="border-border bg-background text-right sm:max-w-md">
          {dialog === "disable" && target && <>
            <DialogHeader className="text-right"><DialogTitle>{target.is_disabled ? "استعادة الحساب" : "تعطيل الحساب"}</DialogTitle><DialogDescription>{target.is_disabled ? "سيتمكن المستخدم من تسجيل الدخول مجدداً." : "سيتم إيقاف دخول المستخدم مع الاحتفاظ بكل بياناته."}</DialogDescription></DialogHeader>
            {!target.is_disabled && <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="سبب التعطيل (اختياري)" />}
            <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setDialog(null)}>إلغاء</Button><Button variant={target.is_disabled ? "default" : "destructive"} disabled={busy === target.id} onClick={() => run(target.id, () => setAccountState({ data: { userId: target.id, disabled: !target.is_disabled, reason } }), target.is_disabled ? "تمت استعادة الحساب" : "تم تعطيل الحساب")}>{busy === target.id && <Loader2 className="animate-spin" />}{target.is_disabled ? "استعادة" : "تعطيل"}</Button></DialogFooter>
          </>}
          {dialog === "delete" && target && <>
            <DialogHeader className="text-right"><DialogTitle className="text-destructive">حذف الحساب نهائياً</DialogTitle><DialogDescription>هذا الإجراء لا يمكن التراجع عنه. اكتب «حذف نهائي» للمتابعة.</DialogDescription></DialogHeader>
            <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="حذف نهائي" />
            <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setDialog(null)}>إلغاء</Button><Button variant="destructive" disabled={confirmation !== "حذف نهائي" || busy === target.id} onClick={() => run(target.id, () => deleteAccount({ data: { userId: target.id, confirmation: "حذف نهائي" } }), "تم حذف الحساب")}>{busy === target.id && <Loader2 className="animate-spin" />}حذف نهائي</Button></DialogFooter>
          </>}
          {dialog === "plan" && target && <>
            <DialogHeader className="text-right"><DialogTitle>تعديل اشتراك {target.full_name}</DialogTitle><DialogDescription>اختر الخطة وتاريخ الانتهاء، أو اترك التاريخ فارغاً للاشتراك المفتوح.</DialogDescription></DialogHeader>
            <select value={plan} onChange={(event) => setPlan(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="free">Free</option><option value="basic">Basic</option><option value="pro">Pro</option><option value="office">Office</option></select>
            <Input type="date" value={expires} onChange={(event) => setExpires(event.target.value)} />
            <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setDialog(null)}>إلغاء</Button><Button disabled={busy === target.id} onClick={() => run(target.id, () => savePlan({ data: { userId: target.id, plan: plan as any, expiresAt: expires ? new Date(`${expires}T23:59:59`).toISOString() : null } }), "تم تحديث الاشتراك")}>{busy === target.id && <Loader2 className="animate-spin" />}حفظ</Button></DialogFooter>
          </>}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function LoadingState() { return <div className="flex min-h-56 items-center justify-center text-muted-foreground"><Loader2 className="ml-2 h-5 w-5 animate-spin" /> جاري التحميل...</div>; }
function EmptyState() { return <div className="border-y border-border py-14 text-center"><FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">لا توجد بيانات مطابقة.</p></div>; }

function Overview({ data }: { data: AdminResult | null }) {
  const metrics = data?.metrics ?? {};
  const cards = [
    ["المستخدمون", metrics.users, Users], ["المحامون", metrics.lawyers, ShieldCheck], ["العملاء", metrics.clients, UserRound],
    ["القضايا", metrics.cases, Gavel], ["الاستشارات", metrics.consultations, FileCheck2], ["طلبات توثيق", metrics.pendingVerifications, AlertTriangle],
  ] as const;
  return <div className="space-y-6"><div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{cards.map(([label, value, Icon]) => <article key={label} className="border-y border-border px-1 py-5"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{label}</span><Icon className="h-5 w-5 text-primary" /></div><div className="mt-2 text-3xl font-bold text-foreground">{value ?? 0}</div></article>)}</div><div><h2 className="mb-3 text-lg font-semibold">أحدث الحركة المالية</h2><div className="divide-y divide-border border-y border-border">{(data?.rows ?? []).map((row) => <div key={`${row.kind}-${row.id}`} className="flex items-center justify-between gap-3 py-3 text-sm"><div><div className="font-medium">{row.kind === "payment" ? "دفعة" : `فاتورة ${row.invoice_number ?? ""}`}</div><div className="text-xs text-muted-foreground">{fmtDate(row.created_at)}</div></div><div className="text-left"><div className="font-semibold text-primary">{fmtMoney(row.kind === "payment" ? row.amount : row.total_amount)}</div><Badge variant="outline">{statusLabel(row.status)}</Badge></div></div>)}</div></div></div>;
}

function UserRows({ rows, section, onDisable, onDelete }: { rows: any[]; section: AdminSection; onDisable: (row: any) => void; onDelete: (row: any) => void }) {
  return <div className="divide-y divide-border border-y border-border">{rows.map((row) => <article key={row.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1.4fr)_1fr_auto] md:items-center"><div className="flex items-center gap-3 min-w-0"><div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted font-bold text-primary">{row.avatar_url ? <img src={row.avatar_url} alt="" className="h-full w-full object-cover" /> : row.full_name?.[0]}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-semibold">{row.full_name}</h2>{row.is_disabled && <Badge variant="destructive">معطل</Badge>}{row.extra?.verified && <Badge variant="outline" className="text-primary">موثق</Badge>}</div><p className="truncate text-xs text-muted-foreground" dir="ltr">{row.email ?? "—"}</p><p className="text-xs text-muted-foreground" dir="ltr">{row.phone ?? "—"}</p></div></div><div className="text-sm"><div>{section === "lawyers" ? row.extra?.firm_name || "محامٍ مستقل" : roleLabel(row.role)} · <span className="text-primary">{row.plan ?? "free"}</span></div><div className="text-xs text-muted-foreground">{row.location ?? "لا يوجد موقع"} · انضم {fmtDate(row.created_at)}</div>{row.extra?.consultation_price != null && <div className="text-xs text-muted-foreground">الاستشارة: {fmtMoney(row.extra.consultation_price)}</div>}</div><div className="flex flex-wrap gap-2 md:justify-end"><Button variant="outline" size="sm" onClick={() => onDisable(row)}>{row.is_disabled ? <RotateCcw /> : <Ban />}{row.is_disabled ? "استعادة" : "تعطيل"}</Button><Button variant="ghost" size="icon" title="حذف نهائي" className="text-destructive hover:text-destructive" onClick={() => onDelete(row)}><Trash2 /></Button></div></article>)}</div>;
}

function SubscriptionRows({ rows, onEdit }: { rows: any[]; onEdit: (row: any) => void }) { return <div className="divide-y divide-border border-y border-border">{rows.map((row) => <div key={row.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><div className="font-semibold">{row.full_name}</div><div className="text-xs text-muted-foreground">{roleLabel(row.role)} · {row.subscription?.status ? statusLabel(row.subscription.status) : "بدون سجل دفع"}</div></div><div className="text-sm"><span className="font-semibold text-primary">{row.plan ?? "free"}</span><div className="text-xs text-muted-foreground">ينتهي: {fmtDate(row.plan_expires_at)}</div></div><Button variant="outline" size="sm" onClick={() => onEdit(row)}>تعديل الخطة</Button></div>)}</div>; }

function OperationRows({ rows }: { rows: any[] }) { return <div className="divide-y divide-border border-y border-border">{rows.map((row) => <div key={`${row.kind}-${row.id}`} className="grid gap-2 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"><Badge variant="outline">{row.kind === "case" ? "قضية" : row.kind === "consultation" ? "استشارة" : "طلب توكيل"}</Badge><div><div className="font-medium">{row.title ?? row.subject ?? row.type ?? "بدون عنوان"}</div><div className="text-xs text-muted-foreground">{row.case_number ?? row.id.slice(0, 8)} · {fmtDate(row.created_at ?? row.scheduled_at)}</div></div><Badge>{statusLabel(row.status)}</Badge></div>)}</div>; }
function InvoiceRows({ rows }: { rows: any[] }) { return <div className="divide-y divide-border border-y border-border">{rows.map((row) => <div key={row.id} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><div className="font-semibold">فاتورة {row.invoice_number}</div><div className="text-xs text-muted-foreground">الاستحقاق: {fmtDate(row.due_date)}</div></div><div><div className="font-semibold text-primary">{fmtMoney(row.total_amount)}</div><div className="text-xs text-muted-foreground">المدفوع {fmtMoney(row.paid_amount)}</div></div><Badge variant="outline">{statusLabel(row.status)}</Badge></div>)}</div>; }

function Moderation({ rows, busy, onAction }: { rows: any[]; busy: string | null; onAction: (payload: any, id: string, message: string) => void }) { return <div className="divide-y divide-border border-y border-border">{rows.map((row) => <article key={`${row.kind}-${row.id}`} className="py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><Badge variant="outline">{row.kind === "verification" ? "توثيق محامٍ" : "مراجعة"}</Badge>{row.kind === "verification" ? <><div className="mt-2 font-medium">رقم القيد: {row.bar_number ?? "—"}</div><div className="text-xs text-muted-foreground">{fmtDate(row.created_at)} · {statusLabel(row.status)}</div></> : <><div className="mt-2 flex items-center gap-1 text-primary"><Star className="h-4 w-4 fill-current" /> {row.rating}/5</div><p className="mt-1 text-sm text-muted-foreground">{row.review ?? "بدون تعليق"}</p></>}</div><div className="flex gap-2">{row.kind === "verification" && row.status === "pending" ? <><Button size="sm" disabled={busy === row.id} onClick={() => onAction({ kind: "verification", lawyerId: row.lawyer_id, approved: true }, row.id, "تم توثيق المحامي")}><CheckCircle2 /> موافقة</Button><Button variant="destructive" size="sm" disabled={busy === row.id} onClick={() => onAction({ kind: "verification", lawyerId: row.lawyer_id, approved: false }, row.id, "تم رفض الطلب")}>رفض</Button></> : row.kind === "review" && <Button variant="outline" size="sm" disabled={busy === row.id} onClick={() => onAction({ kind: "review", id: row.id, visible: !row.is_visible }, row.id, row.is_visible ? "تم إخفاء المراجعة" : "تم إظهار المراجعة")}>{row.is_visible ? "إخفاء" : "إظهار"}</Button>}</div></div></article>)}</div>; }

function Notifications({ rows, busy, onSend }: { rows: any[]; busy: string | null; onSend: (payload: { audience: "all" | "lawyers" | "clients"; title: string; body: string }) => void }) {
  const [audience, setAudience] = useState<"all" | "lawyers" | "clients">("all"); const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  return <div className="grid gap-8 lg:grid-cols-[minmax(280px,0.7fr)_1.3fr]"><form className="space-y-3 border-y border-border py-5" onSubmit={(event) => { event.preventDefault(); onSend({ audience, title, body }); }}><div className="flex items-center gap-2 font-semibold"><Bell className="text-primary" /> إشعار جديد</div><select value={audience} onChange={(event) => setAudience(event.target.value as any)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="all">كل المستخدمين</option><option value="lawyers">المحامون فقط</option><option value="clients">العملاء فقط</option></select><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="عنوان الإشعار" required minLength={3} /><Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="نص الإشعار" required minLength={3} rows={5} /><Button type="submit" disabled={busy === "broadcast" || title.trim().length < 3 || body.trim().length < 3}>{busy === "broadcast" && <Loader2 className="animate-spin" />}إرسال</Button></form><div><h2 className="mb-3 font-semibold">أحدث الإشعارات</h2><div className="divide-y divide-border border-y border-border">{rows.map((row) => <div key={row.id} className="py-3"><div className="flex items-center justify-between gap-3"><span className="font-medium">{row.title}</span><span className="text-xs text-muted-foreground">{fmtDate(row.created_at)}</span></div><p className="mt-1 text-sm text-muted-foreground">{row.body}</p></div>)}</div></div></div>;
}
function AuditRows({ rows }: { rows: any[] }) { return <div className="divide-y divide-border border-y border-border">{rows.map((row) => <div key={row.id} className="grid gap-2 py-4 md:grid-cols-[1fr_1fr_auto]"><div><div className="font-mono text-sm text-primary">{row.action}</div><div className="text-xs text-muted-foreground">{row.table_name} · {row.record_id?.slice(0, 8) ?? "عام"}</div></div><div className="truncate text-xs text-muted-foreground">بواسطة {row.user_id?.slice(0, 8) ?? "النظام"}</div><div className="text-xs text-muted-foreground">{fmtDate(row.created_at)}</div></div>)}</div>; }
function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) { return <div className="flex items-center justify-center gap-3"><Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onChange(page - 1)} title="السابق"><ChevronRight /></Button><span className="text-sm text-muted-foreground">{page} من {totalPages}</span><Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => onChange(page + 1)} title="التالي"><ChevronLeft /></Button></div>; }
