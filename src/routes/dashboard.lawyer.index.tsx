import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashStat, DashCard } from "@/components/DashboardShared";

export const Route = createFileRoute("/dashboard/lawyer/")({
  head: () => ({ meta: [{ title: "لوحة المحامي — الوكيل" }] }),
  component: LawyerDashboard,
});

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "صباح النور";
  if (hour >= 12 && hour < 17) return "مساء الخير";
  if (hour >= 17 && hour < 21) return "مساء النور";
  return "مساء الخير";
}

function LawyerDashboard() {
  const { profile, userId } = useAuth();
  const [stats, setStats] = useState({ cases: 0, hearings: 0, revenue: 0, pending: 0 });
  const [upcomingHearings, setUpcomingHearings] = useState<any[]>([]);
  const [alerts, setAlerts] = useState({ urgentDeadlines: 0, overdueTasks: 0, expiringPOA: 0 });
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const now = new Date();
      const weekEnd = new Date(now.getTime() + 7 * 86400000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data: myCases } = await supabase
        .from("cases")
        .select("id")
        .eq("lawyer_id", userId)
        .is("deleted_at", null);
      const caseIds = (myCases ?? []).map((c) => c.id);

      const [activeCases, weekHearings, monthRevenue, pendingC] = await Promise.all([
        supabase.from("cases").select("id", { count: "exact", head: true }).eq("lawyer_id", userId).eq("status", "active").is("deleted_at", null),
        caseIds.length
          ? supabase.from("hearings").select("id", { count: "exact", head: true })
              .in("case_id", caseIds)
              .gte("hearing_date", now.toISOString())
              .lte("hearing_date", weekEnd.toISOString())
          : Promise.resolve({ count: 0 } as any),
        supabase.from("invoices").select("paid_amount").eq("lawyer_id", userId).gte("created_at", monthStart.toISOString()),
        supabase.from("consultations").select("id", { count: "exact", head: true }).eq("lawyer_id", userId).eq("status", "pending"),
      ]);

      const totalRevenue = (monthRevenue.data ?? []).reduce((s, i: any) => s + Number(i.paid_amount ?? 0), 0);
      setStats({
        cases: activeCases.count ?? 0,
        hearings: weekHearings.count ?? 0,
        revenue: totalRevenue,
        pending: pendingC.count ?? 0,
      });

      if (caseIds.length) {
        const { data: hearingsData } = await supabase
          .from("hearings")
          .select("*, case:cases!case_id(title)")
          .in("case_id", caseIds)
          .gte("hearing_date", now.toISOString())
          .order("hearing_date", { ascending: true })
          .limit(5);
        setUpcomingHearings(hearingsData ?? []);
      }

      try {
        const key = `onboarding_done_${userId}`;
        if (typeof window !== "undefined" && !localStorage.getItem(key) && caseIds.length === 0) {
          setShowOnboarding(true);
        }
      } catch { /* ignore */ }

      // Urgent alerts
      const in7 = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];
      const todayISO = now.toISOString().split("T")[0];
      const [urgentDl, overdueTk, expPOA] = await Promise.all([
        supabase.from("deadlines").select("id", { count: "exact", head: true })
          .eq("lawyer_id", userId).eq("status", "active").lte("due_date", in7),
        supabase.from("tasks").select("id", { count: "exact", head: true })
          .eq("lawyer_id", userId).neq("status", "done").lt("due_date", todayISO),
        supabase.from("cases").select("id", { count: "exact", head: true })
          .eq("lawyer_id", userId).eq("status", "active")
          .not("power_of_attorney_expires", "is", null)
          .lte("power_of_attorney_expires", in7),
      ]);
      setAlerts({
        urgentDeadlines: urgentDl.count ?? 0,
        overdueTasks: overdueTk.count ?? 0,
        expiringPOA: expPOA.count ?? 0,
      });
    })();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`lawyer-consults-${userId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "consultations", filter: `lawyer_id=eq.${userId}` },
        async (payload) => {
          await supabase.from("notifications").insert({
            user_id: userId,
            title: "طلب استشارة جديد 📞",
            body: "لديك طلب استشارة جديد يحتاج موافقتك",
            type: "new_consultation",
            related_id: (payload.new as any).id,
            related_type: "consultation",
          });
          setStats((s) => ({ ...s, pending: s.pending + 1 }));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return (
    <div className="space-y-8">
      {showOnboarding && userId && (
        <OnboardingModal userId={userId} onClose={() => setShowOnboarding(false)} />
      )}
      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-gradient-gold font-bold">
          {getGreeting()}، {profile?.full_name ?? "أستاذنا"} 👋
        </h1>
        <p className="text-foreground/60 mt-1 text-sm">
          خطتك الحالية: <span className="text-gold font-semibold">{profile?.plan ?? "free"}</span>
        </p>
      </div>

      {(alerts.urgentDeadlines + alerts.overdueTasks + alerts.expiringPOA > 0) && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-red-300">
            <AlertTriangle className="h-5 w-5" /> يحتاج انتباهك اليوم
          </div>
          <div className="text-sm text-red-100/80 space-y-1.5 pr-7">
            {alerts.urgentDeadlines > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span>• {alerts.urgentDeadlines} آجال قانونية تنتهي خلال 7 أيام</span>
                <Link to="/dashboard/lawyer/deadlines" className="text-xs text-gold hover:underline shrink-0">عرض الآجال ←</Link>
              </div>
            )}
            {alerts.overdueTasks > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span>• {alerts.overdueTasks} مهام متأخرة</span>
                <Link to="/dashboard/lawyer/tasks" className="text-xs text-gold hover:underline shrink-0">عرض المهام ←</Link>
              </div>
            )}
            {alerts.expiringPOA > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span>• {alerts.expiringPOA} توكيلات تنتهي قريباً</span>
                <Link to="/dashboard/lawyer/cases" className="text-xs text-gold hover:underline shrink-0">عرض القضايا ←</Link>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashStat label="القضايا النشطة" value={stats.cases} icon="⚖️" />
        <DashStat label="جلسات الأسبوع" value={stats.hearings} icon="📅" />
        <DashStat label="أتعاب هذا الشهر" value={`${stats.revenue.toLocaleString()} ج`} icon="💰" />
        <DashStat label="طلبات استشارة" value={stats.pending} icon="📞" />
      </div>

      <div>
        <h2 className="font-display text-xl text-gradient-gold mb-3">إجراءات سريعة</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "قضية جديدة", icon: "⚖️", href: "/dashboard/lawyer/cases/new" as const },
            { label: "فاتورة جديدة", icon: "💰", href: "/dashboard/lawyer/billing" as const },
            { label: "تحليل عقد", icon: "🤖", href: "/dashboard/lawyer/ai" as const },
            { label: "ملفي العام", icon: "👤", href: "/dashboard/lawyer/profile" as const },
          ].map((a) => (
            <Link key={a.href} to={a.href}
              className="bg-surface border border-border hover:border-gold/50 rounded-xl p-4 flex flex-col items-center gap-2 transition hover:bg-gold/5 text-center">
              <span className="text-2xl">{a.icon}</span>
              <span className="text-xs text-foreground/70">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-display text-2xl text-gradient-gold mb-4">إدارة سريعة</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DashCard title="القضايا" href="/dashboard/lawyer/cases" desc="أضف قضية، تابع الجلسات، ودوّن النتائج" />
          <DashCard title="الموكلون" href="/dashboard/lawyer/clients" desc="قاعدة بيانات موكليك وبياناتهم" />
          <DashCard title="التقويم" href="/dashboard/lawyer/calendar" desc="نظرة شهرية على الجلسات والاستشارات" />
          <DashCard title="الفواتير" href="/dashboard/lawyer/billing" desc="أصدر فواتير وتابع المدفوعات" />
          <DashCard title="مساعد AI" href="/dashboard/lawyer/ai" desc="تحليل عقود وصياغة وتلخيص" />
          <DashCard title="ملفي العام" href="/dashboard/lawyer/profile" desc="حدّث ظهورك للموكلين في السوق" />
          <DashCard title="توثيق الحساب" href="/dashboard/lawyer/verification" desc="ارفع كارنيه النقابة والبطاقة للحصول على شارة التوثيق" />

        </div>
      </div>

      {upcomingHearings.length > 0 && (
        <div>
          <h2 className="font-display text-2xl text-gradient-gold mb-4">الجلسات القادمة</h2>
          <div className="space-y-2">
            {upcomingHearings.map((h) => {
              const date = new Date(h.hearing_date);
              const daysLeft = Math.ceil((date.getTime() - Date.now()) / 86400000);
              return (
                <div key={h.id} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
                  <div className="text-center bg-gold/10 rounded-lg px-3 py-2 shrink-0">
                    <div className="text-lg font-bold text-gold">{date.getDate()}</div>
                    <div className="text-xs text-foreground/60">
                      {date.toLocaleDateString("ar-EG", { month: "short" })}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {h.case?.title ?? "قضية"}
                    </div>
                    <div className="text-xs text-foreground/60 mt-0.5">
                      {h.court ?? "المحكمة"} • {date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full shrink-0 ${
                    daysLeft === 0 ? "bg-red-500/15 text-red-400" :
                    daysLeft <= 3 ? "bg-yellow-500/15 text-yellow-400" :
                    "bg-green-500/15 text-green-400"
                  }`}>
                    {daysLeft === 0 ? "اليوم" : daysLeft === 1 ? "غداً" : `بعد ${daysLeft} أيام`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function OnboardingModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: "مرحباً في الوكيل! 👋",
      desc: "مساعدك القانوني الذكي لإدارة قضاياك ومكتبك بسهولة.",
      cta: "أكمل بياناتي",
      to: "/dashboard/lawyer/profile",
    },
    {
      title: "أضف قضيتك الأولى ⚖️",
      desc: "ابدأ بإضافة قضية لتتبع الجلسات والآجال والمستندات في مكان واحد.",
      cta: "إضافة قضية",
      to: "/dashboard/lawyer/cases/new",
    },
    {
      title: "جرّب مساعد AI 🤖",
      desc: "اسأل أي سؤال قانوني، احسب آجال الطعن، وراجع العقود بضغطة زر.",
      cta: "فتح المساعد",
      to: "/dashboard/lawyer/ai",
    },
    {
      title: "استكشف قوالب العقود 📄",
      desc: "ابدأ من قوالب جاهزة أو وَلِّد قالباً جديداً بالذكاء الاصطناعي.",
      cta: "القوالب",
      to: "/dashboard/lawyer/templates",
    },
  ] as const;
  function done() {
    try { localStorage.setItem(`onboarding_done_${userId}`, "1"); } catch { /* ignore */ }
    onClose();
  }
  const s = steps[step];
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-md w-full space-y-4 relative">
        <button onClick={done} className="absolute top-3 left-3 text-foreground/50 hover:text-foreground"><X className="h-5 w-5" /></button>
        <div className="flex items-center gap-1 mb-2">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-gold" : "bg-border"}`} />
          ))}
        </div>
        <div className="text-xs text-gold inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> {step + 1} من {steps.length}</div>
        <h2 className="font-display text-2xl text-gradient-gold font-bold">{s.title}</h2>
        <p className="text-sm text-foreground/70 leading-relaxed">{s.desc}</p>
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => { done(); navigate({ to: s.to }); }}
            className="flex-1 bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-lg shadow-gold"
          >
            {s.cta}
          </button>
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(step + 1)} className="px-4 py-2.5 bg-elevated border border-border rounded-lg text-sm">
              تخطي
            </button>
          ) : (
            <button onClick={done} className="px-4 py-2.5 bg-elevated border border-border rounded-lg text-sm">
              إنهاء
            </button>
          )}
        </div>
        <button onClick={done} className="text-xs text-foreground/50 hover:text-foreground/70 w-full text-center pt-1">
          تخطي الإعداد بأكمله
        </button>
      </div>
    </div>
  );
}
