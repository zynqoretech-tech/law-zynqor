import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { caseTypeLabel } from "@/lib/utils";
import { EmptyState } from "@/components/DashboardShared";

export const Route = createFileRoute("/dashboard/client/my-cases")({
  head: () => ({ meta: [{ title: "قضاياي — الوكيل" }] }),
  component: MyCases,
});

function MyCases() {
  const { userId } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [hearings, setHearings] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const [directRes, mcRes] = await Promise.all([
        supabase
          .from("cases")
          .select("*, lawyer:profiles!lawyer_id(id, full_name)")
          .eq("client_id", userId)
          .is("deleted_at", null)
          .order("updated_at", { ascending: false }),
        supabase.from("manual_clients").select("id").eq("platform_user_id", userId),
      ]);
      const manualIds = (mcRes.data ?? []).map((m: any) => m.id);
      const manualRes = manualIds.length
        ? await supabase
            .from("cases")
            .select("*, lawyer:profiles!lawyer_id(id, full_name)")
            .in("manual_client_id", manualIds)
            .is("deleted_at", null)
            .order("updated_at", { ascending: false })
        : { data: [] as any[] };
      const seen = new Set<string>();
      const merged: any[] = [];
      for (const c of [...(directRes.data ?? []), ...(manualRes.data ?? [])]) {
        if (!seen.has(c.id)) { seen.add(c.id); merged.push(c); }
      }
      merged.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setCases(merged);

      if (merged.length) {
        const { data: hs } = await supabase
          .from("hearings")
          .select("id, case_id, hearing_date, court, result, decision, notes")
          .in("case_id", merged.map((c) => c.id))
          .order("hearing_date", { ascending: false });
        const grouped: Record<string, any[]> = {};
        for (const h of hs ?? []) {
          if (!h.case_id) continue;
          (grouped[h.case_id] ||= []).push(h);
        }
        setHearings(grouped);
      }
      setLoading(false);
    })();
  }, [userId]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-gradient-gold font-bold">قضاياي</h1>
      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-5 animate-pulse space-y-3">
              <div className="flex justify-between">
                <div className="h-3 w-20 bg-elevated rounded" />
                <div className="h-5 w-16 bg-elevated rounded-full" />
              </div>
              <div className="h-5 bg-elevated rounded w-3/4" />
              <div className="space-y-2">
                <div className="h-3 bg-elevated rounded w-2/3" />
                <div className="h-3 bg-elevated rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : cases.length === 0 ? (
        <EmptyState icon="⚖️" title="لا توجد قضايا" desc="عند تسجيل قضية مع محامٍ ستظهر هنا" cta="ابحث عن محامٍ" ctaHref="/marketplace" />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {cases.map((c) => {
            const caseHearings = hearings[c.id] ?? [];
            return (
              <div key={c.id} className="bg-surface border border-border rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs text-foreground/50">رقم: {c.case_number ?? "—"}</div>
                  <StatusBadge status={c.status} />
                </div>
                <div className="font-semibold text-foreground">{c.title}</div>
                <div className="text-xs text-foreground/60">{caseTypeLabel(c.type)}</div>
                {c.court && <div className="text-xs text-foreground/60">المحكمة: {c.court}</div>}
                {c.next_hearing && (
                  <div className="text-xs text-gold/70 flex items-center gap-1">
                    📅 الجلسة القادمة: {new Date(c.next_hearing).toLocaleDateString("ar-EG")}
                  </div>
                )}
                {caseHearings.length > 0 && (
                  <details className="pt-2 border-t border-border">
                    <summary className="text-xs text-gold cursor-pointer hover:underline">
                      📜 سجل الجلسات ({caseHearings.length})
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {caseHearings.map((h) => (
                        <li key={h.id} className="text-xs bg-elevated/40 rounded-lg p-2 space-y-1">
                          <div className="flex justify-between text-foreground/80">
                            <span>{new Date(h.hearing_date).toLocaleDateString("ar-EG")}</span>
                            {h.court && <span className="text-foreground/60">{h.court}</span>}
                          </div>
                          {h.result && <div className="text-foreground/70">النتيجة: {h.result}</div>}
                          {h.decision && <div className="text-foreground/70">القرار: {h.decision}</div>}
                          {h.notes && <div className="text-foreground/50">{h.notes}</div>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {c.lawyer?.id && (
                  <div className="pt-2 border-t border-border">
                    <Link
                      to="/lawyers/$id"
                      params={{ id: c.lawyer.id }}
                      className="text-xs text-gold hover:underline flex items-center gap-1">
                      👨‍⚖️ محاميك: {c.lawyer.full_name ?? "—"} ←
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
