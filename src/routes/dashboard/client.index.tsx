import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashStat, DashCard, EmptyState } from "@/components/DashboardShared";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { caseTypeLabel } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/client/")({
  head: () => ({ meta: [{ title: "لوحة الموكّل — الوكيل" }] }),
  component: ClientDashboard,
});

function ClientDashboard() {
  const { profile, userId } = useAuth();
  const [stats, setStats] = useState({ cases: 0, consults: 0, invoices: 0 });
  const [cases, setCases] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [linkedManual, setLinkedManual] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const nowIso = new Date().toISOString();
      const { data: mcs } = await supabase.from("manual_clients").select("id, full_name").eq("platform_user_id", userId);
      const manualIds = (mcs ?? []).map((m: any) => m.id);
      setLinkedManual(mcs ?? []);

      const casesQuery = manualIds.length
        ? supabase.from("cases").select("id, title, status, type, next_hearing, updated_at").or(`client_id.eq.${userId},manual_client_id.in.(${manualIds.join(",")})`).is("deleted_at", null).order("updated_at", { ascending: false }).limit(20)
        : supabase.from("cases").select("id, title, status, type, next_hearing, updated_at").eq("client_id", userId).is("deleted_at", null).order("updated_at", { ascending: false }).limit(20);

      const invQuery = manualIds.length
        ? supabase.from("invoices").select("id", { count: "exact", head: true }).or(`client_id.eq.${userId},manual_client_id.in.(${manualIds.join(",")})`).neq("status", "paid")
        : supabase.from("invoices").select("id", { count: "exact", head: true }).eq("client_id", userId).neq("status", "paid");

      const [cn, inv, list, up] = await Promise.all([
        supabase.from("consultations").select("id", { count: "exact", head: true }).eq("client_id", userId),
        invQuery,
        casesQuery,
        supabase
          .from("consultations")
          .select("id, scheduled_at, status, type, lawyer:profiles!lawyer_id(full_name)")
          .eq("client_id", userId)
          .in("status", ["confirmed", "pending"])
          .gte("scheduled_at", nowIso)
          .order("scheduled_at", { ascending: true })
          .limit(3),
      ]);
      const allCases = (list.data ?? []) as any[];
      setStats({ cases: allCases.length, consults: cn.count ?? 0, invoices: inv.count ?? 0 });
      setCases(allCases.slice(0, 3));
      setUpcoming(up.data ?? []);
    })();
  }, [userId]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-gradient-gold font-bold">
          مرحباً، {profile?.full_name ?? "صديقنا"}
        </h1>
        <p className="text-foreground/60 mt-1 text-sm">رحلتك القانونية تبدأ هنا.</p>
      </div>

      {linkedManual.length > 0 && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 flex items-start gap-3">
          <span className="text-2xl">🎉</span>
          <div>
            <div className="font-display text-lg text-green-300">تم ربط حسابك بنجاح</div>
            <div className="text-sm text-foreground/70 mt-1">
              محاميك ربط حسابك بـ {linkedManual.length} ملف موكّل. ستجد قضاياك وفواتيرك في القوائم الجانبية.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <DashStat label="قضاياي" value={stats.cases} icon="⚖️" />
        <DashStat label="استشاراتي" value={stats.consults} icon="📞" />
        <DashStat label="فواتير معلقة" value={stats.invoices} icon="🧾" />
      </div>

      {upcoming.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl text-gradient-gold">مواعيدي القادمة</h2>
            <Link to="/dashboard/client/consultations" className="text-sm text-gold hover:underline">عرض الكل ←</Link>
          </div>
          <div className="space-y-3">
            {upcoming.map((u) => {
              const rawDate = u.starts_at || u.scheduled_at;
              const d = rawDate ? new Date(typeof rawDate === "string" ? rawDate.replace(" ", "T") : rawDate) : new Date();
              const dateText = isNaN(d.getTime())
                ? "موعد محدد"
                : `${d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" })} • ${d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`;
              const lawyerName = u.lawyer?.name || u.lawyer?.full_name || "الأستاذ أحمد محمود";
              return (
                <Link
                  key={u.id}
                  to="/dashboard/client/consultations"
                  className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between gap-4 hover:border-gold/50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-2xl">📞</div>
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate">
                        مع {lawyerName}
                      </div>
                      <div className="text-xs text-foreground/60 mt-1">
                        {dateText}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={u.status || "confirmed"} />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-gradient-gold">قضاياي الأخيرة</h2>
          <Link to="/dashboard/client/my-cases" className="text-sm text-gold hover:underline">عرض الكل ←</Link>
        </div>
        {cases.length === 0 ? (
          <EmptyState icon="⚖️" title="لم تنشئ أي قضية بعد" desc="ابحث عن محامٍ مناسب وابدأ رحلتك القانونية" cta="ابحث عن محامٍ" ctaHref="/marketplace" />
        ) : (
          <div className="space-y-3">
            {cases.map((c) => (
              <div key={c.id} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">{c.title}</div>
                  <div className="text-xs text-foreground/60 mt-1">{caseTypeLabel(c.type)}</div>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display text-2xl text-gradient-gold mb-4">ابدأ من هنا</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DashCard title="ابحث عن محامٍ" href="/marketplace" desc="تصفّح المحامين حسب التخصص والمدينة" />
          <DashCard title="المساعد الذكي" href="/dashboard/client/ai" desc="اسأل في أي مسألة قانونية" />
          <DashCard title="استشاراتي" href="/dashboard/client/consultations" desc="مواعيدك القادمة والسابقة" />
        </div>
      </div>
    </div>
  );
}
