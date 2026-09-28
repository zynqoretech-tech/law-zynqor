import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, X, LogOut, LayoutDashboard, Bell, Settings, UserCog, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import logo from "@/assets/alwakeel-logo.jpeg";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/", label: "الرئيسية" },
  { to: "/marketplace", label: "السوق القانوني" },
  { to: "/ai-assistant", label: "المساعد الذكي" },
  { to: "/pricing", label: "الأسعار" },
  { to: "/about", label: "من نحن" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { isAuthed, profile } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const dashHref = profile?.role === "lawyer" ? "/dashboard/lawyer" : "/dashboard/client";

  useEffect(() => {
    if (!isAuthed || !profile) return;
    supabase.from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_read", false)
      .then(({ count }) => setUnread(count ?? 0));

    const channel = supabase
      .channel(`notif:${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` },
        (payload: any) => {
          setUnread((u) => u + 1);
          setNotifs((prev) => [payload.new, ...prev].slice(0, 5));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthed, profile]);

  async function openBell() {
    if (bellOpen) { setBellOpen(false); return; }
    setBellOpen(true);
    if (!profile) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(5);
    setNotifs(data ?? []);
    if (unread > 0) {
      await supabase.from("notifications")
        .update({ is_read: true })
        .eq("user_id", profile.id)
        .eq("is_read", false);
      setUnread(0);
    }
  }

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-[100] border-b border-gold-soft/40 bg-overlay/70 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <img src={logo} alt="الوكيل" className="h-10 w-10 rounded-lg object-cover ring-1 ring-gold/40" />
          <div className="leading-tight">
            <div className="font-display text-xl sm:text-2xl text-gradient-gold font-bold">الوكيل</div>
            <div className="text-[9px] tracking-[0.3em] text-gold/70">AL-WAKEEL</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-7 text-sm text-foreground/80">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="hover:text-gold transition" activeProps={{ className: "text-gold" }}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          {isAuthed ? (
            <>
              <div className="relative" ref={bellRef}>
                <button
                  onClick={openBell}
                  className="relative p-2 rounded-lg border border-gold-soft/40 text-foreground/70 hover:text-gold hover:border-gold/60 transition">
                  <Bell className="h-5 w-5" />
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-gold text-primary-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
                {bellOpen && (
                  <div className="absolute left-0 top-full mt-2 w-72 bg-overlay border border-gold-soft/30 rounded-2xl shadow-gold z-50 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border">
                      <span className="text-sm font-semibold text-foreground">آخر الإشعارات</span>
                    </div>
                    {notifs.length === 0 ? (
                      <div className="text-center text-foreground/50 text-sm py-6">لا توجد إشعارات</div>
                    ) : (
                      <>
                        {notifs.map((n) => (
                          <div key={n.id} className="px-4 py-3 border-b border-border last:border-0 hover:bg-gold/5">
                            <div className="text-sm text-foreground font-medium">{n.title}</div>
                            {n.body && <div className="text-xs text-foreground/60 mt-0.5">{n.body}</div>}
                            <div className="text-xs text-foreground/40 mt-1">
                              {new Date(n.created_at).toLocaleString("ar-EG")}
                            </div>
                          </div>
                        ))}
                        <div className="px-4 py-2.5 border-t border-border text-center">
                          {profile?.role === "lawyer" ? (
                            <Link to="/dashboard/lawyer/notifications" onClick={() => setBellOpen(false)} className="text-xs text-gold hover:underline">
                              عرض كل الإشعارات ←
                            </Link>
                          ) : (
                            <Link to="/dashboard/client/notifications" onClick={() => setBellOpen(false)} className="text-xs text-gold hover:underline">
                              عرض كل الإشعارات ←
                            </Link>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 bg-gold/10 border border-gold/30 text-gold px-3 py-2 rounded-lg text-sm hover:bg-gold/20 transition">
                  <div className="h-6 w-6 rounded-md bg-gold-gradient flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {profile?.full_name?.[0] ?? "م"}
                  </div>
                  <span className="hidden sm:inline">{profile?.full_name?.split(" ")[0]}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition ${userMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {userMenuOpen && (
                  <div className="absolute left-0 right-auto top-full mt-2 w-56 bg-[#0d1527] border border-gold-soft/60 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-border/40">
                    <div className="px-4 py-2.5 bg-gold/5">
                      <div className="text-xs font-semibold text-gold">{profile?.full_name ?? "المستخدم"}</div>
                      <div className="text-[10px] text-foreground/60">{profile?.role === "lawyer" ? "حساب محامي معتمد" : profile?.role === "admin" ? "حساب إداري" : "حساب موكّل"}</div>
                    </div>
                    <div className="py-1">
                      <Link to={dashHref} onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground/90 hover:text-gold hover:bg-gold/10 transition">
                        <LayoutDashboard className="h-4 w-4 text-gold" /> لوحة التحكم
                      </Link>
                      {profile?.role === "lawyer" && (
                        <Link to="/dashboard/lawyer/profile" onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground/90 hover:text-gold hover:bg-gold/10 transition">
                          <UserCog className="h-4 w-4 text-gold" /> ملفي العام
                        </Link>
                      )}
                      <Link to="/dashboard/settings" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground/90 hover:text-gold hover:bg-gold/10 transition">
                        <Settings className="h-4 w-4 text-gold" /> الإعدادات
                      </Link>
                    </div>
                    <div className="py-1">
                      <button onClick={() => { setUserMenuOpen(false); handleSignOut(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 transition text-right">
                        <LogOut className="h-4 w-4 text-rose-400" /> تسجيل الخروج
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link to="/auth" search={{ returnUrl: undefined, invite: undefined, type: undefined }} className="bg-gold-gradient animate-shimmer text-primary-foreground font-semibold px-5 py-2.5 rounded-lg shadow-gold hover:scale-105 transition-transform">
              ابدأ الآن
            </Link>
          )}
        </div>

        <button className="lg:hidden p-2 rounded-md border border-gold-soft/50 text-gold" onClick={() => setOpen((v) => !v)} aria-label="القائمة">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-gold-soft/40 bg-overlay/95 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-md text-foreground/85 hover:bg-gold/10 hover:text-gold"
              >
                {n.label}
              </Link>
            ))}
            <div className="h-px bg-gold-soft/40 my-2" />
            {isAuthed ? (
              <>
                <Link to={dashHref} onClick={() => setOpen(false)} className="px-3 py-2 rounded-md text-foreground/85 hover:bg-gold/10 hover:text-gold inline-flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" /> لوحتي
                </Link>
                <button onClick={handleSignOut} className="text-right px-3 py-2 rounded-md text-foreground/85 hover:bg-destructive/10 hover:text-destructive inline-flex items-center gap-2">
                  <LogOut className="h-4 w-4" /> تسجيل الخروج
                </button>
              </>
            ) : (
              <Link to="/auth" search={{ returnUrl: undefined, invite: undefined, type: undefined }} onClick={() => setOpen(false)} className="bg-gold-gradient text-primary-foreground font-semibold px-4 py-2.5 rounded-lg text-center">
                ابدأ الآن
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
