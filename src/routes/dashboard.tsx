import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import {
  LayoutDashboard, Scale, Users, CalendarDays, FileText,
  Receipt, Bot, UserCog, LogOut, Menu, X, Bell, Plus, Search, Settings, MessageCircle,
  CheckSquare, Timer, Clock, Wallet, BookOpen, BarChart3, FileSignature, UsersRound, MessagesSquare,
  ShieldCheck, FolderArchive, Activity, CreditCard, ListChecks, ScrollText, Sparkles,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/alwakeel-logo.jpeg";
import { SUPPORT_WHATSAPP, SUPPORT_EMAIL, supportContactUrl, supportIsWhatsapp } from "@/lib/support";
import { CommandPalette } from "@/components/CommandPalette";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard/lawyer": "لوحة التحكم",
  "/dashboard/lawyer/": "لوحة التحكم",
  "/dashboard/lawyer/cases": "القضايا",
  "/dashboard/lawyer/cases/": "القضايا",
  "/dashboard/lawyer/cases/new": "قضية جديدة",
  "/dashboard/lawyer/clients": "الموكلون",
  "/dashboard/lawyer/calendar": "التقويم",
  "/dashboard/lawyer/billing": "الأتعاب",
  "/dashboard/lawyer/tasks": "المهام",
  "/dashboard/lawyer/deadlines": "الآجال القانونية",
  "/dashboard/lawyer/time-tracking": "تتبع الوقت",
  "/dashboard/lawyer/expenses": "المصروفات",
  "/dashboard/lawyer/archive": "الأرشيف",
  "/dashboard/lawyer/templates": "قوالب العقود",
  "/dashboard/lawyer/research": "البحث القانوني",
  "/dashboard/lawyer/reports": "التقارير",
  "/dashboard/lawyer/ai": "مساعد AI",
  "/dashboard/lawyer/team": "إدارة الفريق",
  "/dashboard/lawyer/notifications": "الإشعارات",
  "/dashboard/lawyer/engagements": "طلبات التوكيل",
  "/dashboard/lawyer/messages": "المحادثات",
  "/dashboard/lawyer/consultations": "الاستشارات",
  "/dashboard/client/engagements": "طلبات التوكيل",
  "/dashboard/client/messages": "المحادثات",
  "/dashboard/client/notifications": "الإشعارات",
  "/dashboard/lawyer/profile": "ملفي العام",

  "/dashboard/client": "الرئيسية",
  "/dashboard/client/": "الرئيسية",
  "/dashboard/client/plans": "باقات الخدمات",
  "/dashboard/client/plans/": "باقات الخدمات",
  "/dashboard/client/my-plans": "اشتراكاتي",
  "/dashboard/client/my-cases": "قضاياي",
  "/dashboard/client/consultations": "استشاراتي",
  "/dashboard/client/documents": "مستنداتي",
  "/dashboard/client/invoices": "فواتيري",
  "/dashboard/client/ai": "اسأل AI",
  "/dashboard/settings": "الإعدادات",
  "/dashboard/admin": "نظرة عامة",
  "/dashboard/admin/users": "إدارة المستخدمين",
  "/dashboard/admin/lawyers": "المحامون والمكاتب",
  "/dashboard/admin/clients": "إدارة العملاء",
  "/dashboard/admin/subscriptions": "الاشتراكات والمدفوعات",
  "/dashboard/admin/operations": "العمليات القانونية",
  "/dashboard/admin/invoices": "إدارة الفواتير",
  "/dashboard/admin/moderation": "التوثيق والمراجعات",
  "/dashboard/admin/notifications": "إشعارات الإدارة",
  "/dashboard/admin/audit": "سجل الإدارة",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Match prefixes for dynamic routes like /dashboard/lawyer/cases/:id
  const matches = Object.keys(PAGE_TITLES)
    .filter((k) => pathname.startsWith(k + "/"))
    .sort((a, b) => b.length - a.length);
  return matches[0] ? PAGE_TITLES[matches[0]] : "لوحة التحكم";
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "لوحة التحكم — الوكيل" }] }),
  component: DashboardLayout,
});

const LAWYER_NAV = [
  { to: "/dashboard/lawyer", icon: LayoutDashboard, label: "لوحة التحكم" },
  { to: "/dashboard/lawyer/cases", icon: Scale, label: "القضايا" },
  { to: "/dashboard/lawyer/tasks", icon: CheckSquare, label: "المهام" },
  { to: "/dashboard/lawyer/deadlines", icon: Clock, label: "الآجال" },
  { to: "/dashboard/lawyer/time-tracking", icon: Timer, label: "تتبع الوقت" },
  { to: "/dashboard/lawyer/expenses", icon: Wallet, label: "المصروفات" },
  { to: "/dashboard/lawyer/archive", icon: FolderArchive, label: "الأرشيف" },
  { to: "/dashboard/lawyer/clients", icon: Users, label: "الموكلون" },
  { to: "/dashboard/lawyer/engagements", icon: UsersRound, label: "طلبات التوكيل" },
  { to: "/dashboard/lawyer/consultations", icon: MessageCircle, label: "الاستشارات" },
  { to: "/dashboard/lawyer/messages", icon: MessagesSquare, label: "المحادثات" },
  { to: "/dashboard/lawyer/calendar", icon: CalendarDays, label: "التقويم" },
  { to: "/dashboard/lawyer/billing", icon: Receipt, label: "الأتعاب" },
  { to: "/dashboard/lawyer/templates", icon: FileSignature, label: "قوالب العقود" },
  { to: "/dashboard/lawyer/research", icon: BookOpen, label: "البحث القانوني" },
  { to: "/dashboard/lawyer/reports", icon: BarChart3, label: "التقارير" },
  { to: "/dashboard/lawyer/ai", icon: Bot, label: "مساعد AI" },
  { to: "/dashboard/lawyer/notifications", icon: Bell, label: "الإشعارات" },
  { to: "/dashboard/lawyer/team", icon: UsersRound, label: "إدارة الفريق" },
  { to: "/dashboard/lawyer/profile", icon: UserCog, label: "ملفي العام" },
] as const;


const CLIENT_NAV = [
  { to: "/dashboard/client", icon: LayoutDashboard, label: "الرئيسية" },
  { to: "/dashboard/client/plans", icon: Sparkles, label: "باقات الخدمات" },
  { to: "/dashboard/client/my-plans", icon: CreditCard, label: "اشتراكاتي" },
  { to: "/dashboard/client/my-cases", icon: Scale, label: "قضاياي" },
  { to: "/marketplace", icon: Search, label: "ابحث عن محامٍ" },
  { to: "/dashboard/client/consultations", icon: CalendarDays, label: "استشاراتي" },
  { to: "/dashboard/client/invoices", icon: Receipt, label: "فواتيري" },
  { to: "/dashboard/client/engagements", icon: UsersRound, label: "طلبات التوكيل" },
  { to: "/dashboard/client/messages", icon: MessagesSquare, label: "المحادثات" },
  { to: "/dashboard/client/notifications", icon: Bell, label: "الإشعارات" },
  { to: "/dashboard/client/documents", icon: FileText, label: "مستنداتي" },
  { to: "/dashboard/client/ai", icon: Bot, label: "اسأل AI" },
] as const;

const ADMIN_NAV = [
  { to: "/dashboard/admin", icon: LayoutDashboard, label: "نظرة عامة" },
  { to: "/dashboard/admin/users", icon: Users, label: "المستخدمون" },
  { to: "/dashboard/admin/lawyers", icon: ShieldCheck, label: "المحامون والمكاتب" },
  { to: "/dashboard/admin/clients", icon: UserCog, label: "العملاء" },
  { to: "/dashboard/admin/subscriptions", icon: CreditCard, label: "الاشتراكات" },
  { to: "/dashboard/admin/operations", icon: Activity, label: "العمليات القانونية" },
  { to: "/dashboard/admin/invoices", icon: Receipt, label: "الفواتير" },
  { to: "/dashboard/admin/moderation", icon: ListChecks, label: "التوثيق والمراجعات" },
  { to: "/dashboard/admin/notifications", icon: Bell, label: "الإشعارات" },
  { to: "/dashboard/admin/audit", icon: ScrollText, label: "سجل الإدارة" },
] as const;

class DashErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="font-display text-xl text-foreground mb-2">حدث خطأ في تحميل الصفحة</h2>
          <p className="text-sm text-foreground/60 mb-6 max-w-sm">
            {this.state.error?.message ?? "خطأ غير متوقع"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="bg-gold-gradient text-primary-foreground font-semibold px-6 py-2.5 rounded-xl shadow-gold">
            حاول مجدداً
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function DashboardLayout() {
  const { loading, isAuthed, profile } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const routerStatus = useRouterState({ select: (s) => s.status });
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile) return;
    supabase.from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_read", false)
      .then(({ count }) => setUnread(count ?? 0));
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel(`notifications-${profile.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` },
        (payload) => {
          const newNotif = payload.new as any;
          setUnread((prev) => prev + 1);
          setNotifications((prev) => [newNotif, ...prev].slice(0, 15));
          import("sonner").then(({ toast }) => {
            toast.info(newNotif.title, { description: newNotif.body, duration: 5000 });
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function loadNotifications() {
    if (!profile) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(15);
    setNotifications(data ?? []);
  }

  useEffect(() => {
    if (loading) return;
    if (!isAuthed) {
      const safeReturn = pathname && !pathname.startsWith("/auth") && pathname !== "/dashboard" ? pathname : undefined;
      navigate({ to: "/auth", search: { returnUrl: safeReturn, invite: undefined, type: undefined } });
      return;
    }
    if (pathname === "/dashboard" && profile) {
      const to = profile.role === "admin"
        ? "/dashboard/admin"
        : profile.role === "lawyer" ? "/dashboard/lawyer" : "/dashboard/client";
      navigate({ to, replace: true });
      return;
    }
    if (pathname.startsWith("/dashboard/admin") && profile?.role !== "admin") {
      navigate({ to: profile?.role === "lawyer" ? "/dashboard/lawyer" : "/dashboard/client", replace: true });
      return;
    }
    if (pathname.startsWith("/dashboard/lawyer") && profile?.role === "client") {
      navigate({ to: "/dashboard/client", replace: true });
      return;
    }
    if (pathname.startsWith("/dashboard/client") && profile?.role === "lawyer") {
      navigate({ to: "/dashboard/lawyer", replace: true });
      return;
    }
  }, [loading, isAuthed, profile, navigate, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          <p className="text-foreground/60 text-sm">جاري التحميل...</p>
        </div>
      </div>
    );
  }
  if (!isAuthed) return null;

  // Profile guard: if signed in but profile row is missing, show inline completion form
  if (isAuthed && profile === null) {
    return <CompleteProfileGate />;
  }

  const navItems = profile?.role === "admin" ? ADMIN_NAV : profile?.role === "lawyer" ? LAWYER_NAV : CLIENT_NAV;
  const settingsActive = pathname === "/dashboard/settings";

  return (
    <div className="min-h-screen flex" dir="rtl">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed top-0 right-0 h-full w-72 bg-overlay border-l border-gold-soft/20 z-40
        flex flex-col transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "translate-x-full"}
        lg:translate-x-0 lg:static lg:flex
      `}>
        <div className="px-6 py-5 border-b border-gold-soft/20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="الوكيل" className="h-9 w-9 rounded-lg object-cover ring-1 ring-gold/40" />
            <div>
              <div className="font-display text-lg text-gradient-gold font-bold leading-none">الوكيل</div>
              <div className="text-[9px] tracking-[0.3em] text-gold/60">AL-WAKEEL</div>
            </div>
          </Link>
          <button className="lg:hidden text-foreground/60 hover:text-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-4 border-b border-gold-soft/20">
          <div className="flex items-center gap-3 bg-surface rounded-xl px-3 py-3">
            <div className="h-10 w-10 rounded-lg bg-gold-gradient flex items-center justify-center font-display text-lg font-bold text-primary-foreground shrink-0">
              {profile?.full_name?.[0] ?? "م"}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">{profile?.full_name}</div>
              <div className="text-xs text-gold/80 flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-green-500 rounded-full inline-block" />
                {profile?.role === "lawyer" ? "محامٍ" : profile?.role === "admin" ? "مدير النظام" : "موكّل"} — {profile?.plan ?? "free"}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.to || (item.to !== "/dashboard/admin" && pathname.startsWith(item.to + "/"));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all
                  ${isActive
                    ? "bg-gold/15 text-gold border-r-[3px] border-gold font-semibold"
                    : "text-foreground/70 hover:bg-surface hover:text-foreground"}
                `}
              >
                <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-gold" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-gold-soft/20 space-y-1">
          <div className="mb-2 bg-gold/10 border border-gold/20 rounded-xl px-3 py-2">
            <div className="text-[10px] text-foreground/60">خطتك الحالية</div>
            <div className="text-sm font-semibold text-gold truncate">كل المزايا — مجاناً 🎉</div>
            <div className="text-[10px] text-foreground/60 mt-0.5">فترة تجريبية مفتوحة</div>
          </div>
          <Link to="/dashboard/settings" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${settingsActive ? "bg-gold/15 text-gold border-r-[3px] border-gold font-semibold" : "text-foreground/70 hover:bg-surface hover:text-foreground"}`}>
            <Settings className="h-4 w-4" /> الإعدادات
          </Link>
          <Link to="/marketplace" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground/70 hover:bg-surface hover:text-foreground transition">
            <Search className="h-4 w-4" /> السوق القانوني
          </Link>
          <button
            onClick={async () => { await signOut(); navigate({ to: "/" }); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground/70 hover:bg-destructive/10 hover:text-destructive transition"
          >
            <LogOut className="h-4 w-4" /> تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {routerStatus === "pending" && (
          <div className="fixed top-0 left-0 right-0 z-[70] h-0.5 bg-gold-gradient animate-pulse" />
        )}
        <header className="sticky top-0 z-20 bg-overlay/80 backdrop-blur-md border-b border-gold-soft/20 px-4 py-3 flex items-center justify-between gap-4">
          <button className="lg:hidden p-2 rounded-lg border border-gold-soft/40 text-gold" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 lg:hidden text-center font-display text-sm text-gold truncate px-2">
            {getPageTitle(pathname)}
          </div>
          <div className="hidden lg:flex flex-1" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
              className="hidden sm:inline-flex items-center gap-2 text-xs text-foreground/60 border border-gold-soft/40 hover:border-gold/60 hover:text-gold rounded-lg px-3 py-2 transition"
              title="بحث سريع (Ctrl+K)">
              <Search className="h-3.5 w-3.5" />
              <span>بحث</span>
              <kbd className="text-[10px] border border-border rounded px-1 py-px">⌘K</kbd>
            </button>
            {profile?.role === "lawyer" && (
              <Link to="/dashboard/lawyer/cases/new" className="hidden sm:inline-flex items-center gap-1.5 bg-gold-gradient text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg shadow-gold hover:scale-[1.02] transition">
                <Plus className="h-4 w-4" /> قضية جديدة
              </Link>
            )}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => {
                  setNotifOpen((v) => !v);
                  if (!notifOpen) loadNotifications();
                }}
                className="relative p-2 rounded-lg border border-gold-soft/40 text-foreground/70 hover:text-gold transition">
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-gold text-primary-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute left-0 top-full mt-2 w-80 bg-overlay border border-gold-soft/30 rounded-2xl shadow-gold z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground">الإشعارات</span>
                    {unread > 0 && (
                      <button
                        onClick={async () => {
                          await supabase.from("notifications")
                            .update({ is_read: true })
                            .eq("user_id", profile!.id);
                          setUnread(0);
                          loadNotifications();
                        }}
                        className="text-xs text-gold hover:underline">
                        تحديد الكل كمقروء
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="text-center text-foreground/50 text-sm py-8">لا توجد إشعارات</div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id}
                          className={`px-4 py-3 border-b border-border last:border-0 ${!n.is_read ? "bg-gold/5" : ""}`}>
                          <div className="flex items-start gap-2">
                            <div className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${!n.is_read ? "bg-gold" : "bg-transparent"}`} />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-foreground truncate">{n.title}</div>
                              {n.body && <div className="text-xs text-foreground/60 mt-0.5">{n.body}</div>}
                              <div className="text-xs text-foreground/40 mt-1">
                                {new Date(n.created_at).toLocaleString("ar-EG")}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          <DashErrorBoundary>
            <Outlet />
          </DashErrorBoundary>
        </main>
      </div>

      <a
        href={supportContactUrl()}
        target={supportIsWhatsapp() ? "_blank" : undefined}
        rel="noopener noreferrer"
        className={`fixed bottom-20 lg:bottom-6 left-6 z-50 h-14 w-14 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform ${supportIsWhatsapp() ? "bg-[#25D366]" : "bg-gold-gradient"}`}
        title={supportIsWhatsapp() ? "تواصل عبر واتساب" : `تواصل عبر البريد: ${SUPPORT_EMAIL}`}
      >
        {supportIsWhatsapp() ? (
          <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        ) : (
          <MessageCircle className="h-7 w-7 text-primary-foreground" />
        )}
      </a>

      <CommandPalette />

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-overlay border-t border-gold-soft/20 flex">
        {navItems.slice(0, 4).map((item) => {
          const isActive = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] transition ${isActive ? "text-gold" : "text-foreground/50 hover:text-foreground"}`}
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
        {navItems.length > 4 && (() => {
          const hiddenActive = navItems.slice(4).some(
            (i) => pathname === i.to || pathname.startsWith(i.to + "/"),
          );
          return (
            <button
              onClick={() => setMoreOpen(true)}
              className={`relative flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] transition ${hiddenActive ? "text-gold" : "text-foreground/50 hover:text-foreground"}`}>
              <Menu className="h-5 w-5" />
              <span>المزيد</span>
              {hiddenActive && (
                <span className="absolute top-1.5 right-[calc(50%-12px)] h-1.5 w-1.5 bg-gold rounded-full" />
              )}
            </button>
          );
        })()}
      </nav>

      {moreOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setMoreOpen(false)} />
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-overlay border-t border-gold-soft/40 rounded-t-2xl p-4 pb-8">
            <div className="w-10 h-1 bg-gold/30 rounded-full mx-auto mb-4" />
            <div className="grid grid-cols-3 gap-3">
              {navItems.slice(4).map((item) => {
                const isActive = pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition ${isActive ? "bg-gold/15 border-gold text-gold" : "border-border text-foreground/70 hover:text-gold hover:border-gold/50"}`}>
                    <item.icon className="h-6 w-6" />
                    <span className="text-xs text-center">{item.label}</span>
                  </Link>
                );
              })}
              <Link
                to="/dashboard/settings"
                onClick={() => setMoreOpen(false)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border text-foreground/70 hover:text-gold hover:border-gold/50 transition">
                <Settings className="h-6 w-6" />
                <span className="text-xs">الإعدادات</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CompleteProfileGate() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [role, setRole] = useState<"lawyer" | "client">("client");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !name.trim() || saving) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: name.trim(),
      role,
    });
    if (error) {
      const { toast } = await import("sonner");
      toast.error("تعذر حفظ البيانات: " + error.message);
      setSaving(false);
      return;
    }
    navigate({ to: role === "lawyer" ? "/dashboard/lawyer" : "/dashboard/client", replace: true });
    // soft reload to refresh useAuth state
    setTimeout(() => window.location.reload(), 100);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
      <form onSubmit={submit} className="bg-overlay border border-gold/30 rounded-2xl p-8 max-w-md w-full space-y-5 shadow-gold">
        <div>
          <h1 className="font-display text-2xl text-gradient-gold">أكمل تسجيلك</h1>
          <p className="text-sm text-foreground/60 mt-1">نحتاج بعض المعلومات الأساسية لإكمال ملفك في "الوكيل".</p>
        </div>
        <div>
          <label className="block text-xs text-foreground/70 mb-1.5">الاسم الكامل *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full bg-elevated border border-gold-soft/40 focus:border-gold rounded-lg px-3 py-2.5 text-sm outline-none" />
        </div>
        <div>
          <label className="block text-xs text-foreground/70 mb-1.5">أنت تستخدم المنصة كـ *</label>
          <div className="grid grid-cols-2 gap-2">
            {(["client", "lawyer"] as const).map((r) => (
              <button key={r} type="button" onClick={() => setRole(r)}
                className={`px-4 py-3 rounded-xl border text-sm transition ${role === r ? "bg-gold/15 border-gold text-gold font-semibold" : "border-border text-foreground/60 hover:border-gold/40"}`}>
                {r === "lawyer" ? "محامٍ" : "موكِّل"}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" disabled={!name.trim() || saving} className="w-full bg-gold-gradient text-primary-foreground font-semibold py-3 rounded-xl shadow-gold disabled:opacity-50">
          {saving ? "جاري الحفظ..." : "متابعة"}
        </button>
      </form>
    </div>
  );
}
