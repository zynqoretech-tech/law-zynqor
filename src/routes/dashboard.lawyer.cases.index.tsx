import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Search, Archive, CheckCircle2, Trash2, X as XIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { caseTypeLabel } from "@/lib/utils";
import { EmptyState } from "@/components/DashboardShared";
import { AlertTriangle, Flame } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/lawyer/cases/")({
  head: () => ({ meta: [{ title: "القضايا — الوكيل" }] }),
  component: CasesPage,
});

const STATUSES = [
  { v: "", l: "الكل" },
  { v: "active", l: "جارية" },
  { v: "pending", l: "معلقة" },
  { v: "won", l: "رابحة" },
  { v: "closed", l: "منتهية" },
];

function relativeDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `قبل ${Math.abs(diff)} يوم`;
  if (diff === 0) return "📍 اليوم";
  if (diff === 1) return "⚡ غداً";
  if (diff <= 7) return `بعد ${diff} أيام`;
  return new Date(dateStr).toLocaleDateString("ar-EG", { month: "short", day: "numeric" });
}

const STAGE_LABELS: Record<string, string> = {
  investigation: "تحقيق",
  initial: "ابتدائي",
  first_instance: "ابتدائي",
  appeal: "استئناف",
  cassation: "نقض",
  execution: "تنفيذ",
  settlement: "تسوية",
  closed: "مغلقة",
};

const PRIORITY_LABELS: Record<string, { l: string; cls: string }> = {
  urgent: { l: "عاجل", cls: "bg-red-500/20 text-red-300 border-red-500/40" },
  high: { l: "مرتفع", cls: "bg-orange-500/15 text-orange-300 border-orange-500/40" },
  normal: { l: "عادي", cls: "bg-foreground/5 text-foreground/60 border-border" },
  low: { l: "منخفض", cls: "bg-foreground/5 text-foreground/40 border-border" },
};

function poaStatus(expires: string | null): { label: string; cls: string } | null {
  if (!expires) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(expires); d.setHours(0, 0, 0, 0);
  const left = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (left < 0) return { label: `📜 توكيل منتهٍ منذ ${Math.abs(left)} يوم`, cls: "text-red-400 font-semibold" };
  if (left <= 14) return { label: `📜 التوكيل ينتهي خلال ${left} يوم`, cls: "text-orange-400 font-semibold" };
  return null;
}

const PAGE_SIZE = 20;

function CasesPage() {
  const { userId } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { setPage(0); }, [debouncedQ, status]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      let query = supabase
        .from("cases")
        .select("*, client_profile:profiles!client_id(full_name, phone), manual_client:manual_clients!manual_client_id(full_name, phone), stage, priority, power_of_attorney_expires", { count: "exact" })
        .eq("lawyer_id", userId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (status) query = query.eq("status", status);
      if (debouncedQ) {
        query = query.or(`title.ilike.%${debouncedQ}%,case_number.ilike.%${debouncedQ}%`);
      }
      const from = page * PAGE_SIZE;
      query = query.range(from, from + PAGE_SIZE - 1);
      const { data, count } = await query;
      setCases(data ?? []);
      setFilteredTotal(count ?? 0);
      setSelected(new Set());
      setLoading(false);
    })();
  }, [userId, status, debouncedQ, reloadKey, page]);

  useEffect(() => {
    if (!userId) return;
    supabase.from("cases").select("id", { count: "exact", head: true })
      .eq("lawyer_id", userId)
      .is("deleted_at", null)
      .then(({ count }) => setTotal(count ?? 0));
  }, [userId, reloadKey]);

  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));

  const isFiltering = debouncedQ.trim() !== "" || status !== "";

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    if (selected.size === cases.length) setSelected(new Set());
    else setSelected(new Set(cases.map((c) => c.id)));
  }
  async function bulk(action: "close" | "archive" | "delete") {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const verb = action === "delete" ? "حذف" : action === "close" ? "إغلاق" : "أرشفة";
    if (!confirm(`هل تريد ${verb} ${ids.length} قضية؟`)) return;
    setBusy(true);
    try {
      let res;
      if (action === "delete") {
        res = await supabase.from("cases").update({ deleted_at: new Date().toISOString() }).in("id", ids);
      } else if (action === "close") {
        res = await supabase.from("cases").update({ status: "closed" }).in("id", ids);
      } else {
        res = await supabase.from("cases").update({ status: "archived" }).in("id", ids);
      }
      if (res.error) throw res.error;
      toast.success(`تم ${verb} ${ids.length} قضية`);
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e.message ?? "حدث خطأ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-gradient-gold font-bold">القضايا</h1>
          <p className="text-foreground/60 text-sm mt-1">{filteredTotal} من {total} قضية</p>
        </div>
        <Link to="/dashboard/lawyer/cases/new" className="inline-flex items-center gap-2 bg-gold-gradient text-primary-foreground font-semibold px-4 py-2.5 rounded-lg shadow-gold hover:scale-[1.02] transition">
          <Plus className="h-4 w-4" /> قضية جديدة
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gold" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث بعنوان أو رقم القضية..."
            className="w-full bg-surface border border-gold-soft/40 rounded-lg pr-10 pl-3 py-2 text-sm focus:border-gold outline-none"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map((s) => (
            <button key={s.v} onClick={() => setStatus(s.v)} className={`px-3 py-1.5 rounded-full text-xs border transition ${status === s.v ? "bg-gold-gradient text-primary-foreground border-transparent" : "bg-surface/60 border-gold-soft/40 text-foreground/70 hover:border-gold/60"}`}>
              {s.l}
            </button>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gold/10 border border-gold/30 rounded-xl px-4 py-3">
          <div className="text-sm text-foreground/80">
            تم اختيار <span className="font-bold text-gold">{selected.size}</span> قضية
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => bulk("close")} className="inline-flex items-center gap-1.5 text-xs bg-surface border border-gold/40 text-foreground/80 hover:text-gold px-3 py-1.5 rounded-lg disabled:opacity-50">
              <CheckCircle2 className="h-3.5 w-3.5" /> إغلاق
            </button>
            <button disabled={busy} onClick={() => bulk("archive")} className="inline-flex items-center gap-1.5 text-xs bg-surface border border-gold/40 text-foreground/80 hover:text-gold px-3 py-1.5 rounded-lg disabled:opacity-50">
              <Archive className="h-3.5 w-3.5" /> أرشفة
            </button>
            <button disabled={busy} onClick={() => bulk("delete")} className="inline-flex items-center gap-1.5 text-xs bg-destructive/10 border border-destructive/40 text-destructive hover:bg-destructive/20 px-3 py-1.5 rounded-lg disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" /> حذف
            </button>
            <button onClick={() => setSelected(new Set())} className="inline-flex items-center gap-1.5 text-xs text-foreground/60 hover:text-foreground px-2 py-1.5">
              <XIcon className="h-3.5 w-3.5" /> إلغاء
            </button>
          </div>
        </div>
      )}

      {cases.length > 0 && (
        <label className="inline-flex items-center gap-2 text-xs text-foreground/60 cursor-pointer select-none">
          <input type="checkbox" checked={selected.size === cases.length && cases.length > 0} onChange={toggleAll} className="accent-gold" />
          تحديد الكل
        </label>
      )}

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-5 animate-pulse h-32" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        isFiltering ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="font-display text-xl text-foreground mb-2">لا توجد قضايا مطابقة</h3>
            <p className="text-foreground/60 text-sm mb-6 max-w-sm">جرّب تغيير كلمة البحث أو الفلتر</p>
            <button
              onClick={() => { setQ(""); setStatus(""); }}
              className="bg-gold-gradient text-primary-foreground font-semibold px-6 py-2.5 rounded-xl shadow-gold hover:scale-[1.02] transition"
            >
              إعادة تعيين البحث
            </button>
          </div>
        ) : (
          <EmptyState icon="⚖️" title="لم تضف أي قضايا بعد" cta="+ قضية جديدة" ctaHref="/dashboard/lawyer/cases/new" />
        )
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {cases.map((c) => (
            <div key={c.id} className={`relative bg-surface border ${selected.has(c.id) ? "border-gold" : "border-border hover:border-gold/50"} rounded-xl p-5 transition`}>
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={(e) => { e.stopPropagation(); toggle(c.id); }}
                onClick={(e) => e.stopPropagation()}
                className="absolute top-3 left-3 accent-gold h-4 w-4 cursor-pointer z-10"
                aria-label="تحديد"
              />
              <Link to="/dashboard/lawyer/cases/$id" params={{ id: c.id }} className="block">
              <div className="flex items-start justify-between gap-3 mb-2 pl-7">
                <div className="text-xs text-foreground/50">رقم: {c.case_number ?? "—"}</div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {(c.priority === "urgent" || c.priority === "high") && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${PRIORITY_LABELS[c.priority]?.cls}`}>
                      <Flame className="h-3 w-3" /> {PRIORITY_LABELS[c.priority]?.l}
                    </span>
                  )}
                  {c.stage && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-gold/30 bg-gold/10 text-gold whitespace-nowrap">
                      {STAGE_LABELS[c.stage] ?? c.stage}
                    </span>
                  )}
                  <StatusBadge status={c.status} />
                </div>
              </div>
              <h3 className="font-display text-lg text-foreground mb-2">{c.title}</h3>
              <div className="text-xs text-foreground/60 space-y-1">
                <div>النوع: {caseTypeLabel(c.type)}</div>
                {c.court && <div>المحكمة: {c.court}</div>}
                {(() => {
                  const name = c.client_profile?.full_name ?? c.manual_client?.full_name ?? null;
                  const external = !c.client_profile && c.manual_client;
                  return <div>{name ? <>الموكل: {name} {external && <span className="text-[10px] bg-gold/10 text-gold/70 px-1 py-0.5 rounded">خارجي</span>}</> : "بدون موكل مرتبط"}</div>;
                })()}
                {c.next_hearing && (() => {
                  const diff = Math.round((new Date(c.next_hearing).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
                  const cls = diff === 0 ? "text-red-400 font-semibold" : diff === 1 ? "text-yellow-400 font-semibold" : "text-foreground/60";
                  return <div className={cls}>📅 الجلسة: {relativeDayLabel(c.next_hearing)}</div>;
                })()}
                {(() => {
                  const p = poaStatus(c.power_of_attorney_expires);
                  return p ? <div className={p.cls}>{p.label}</div> : null;
                })()}
              </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredTotal > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-lg bg-surface border border-gold-soft/40 text-sm text-foreground/80 hover:border-gold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            السابق
          </button>
          <span className="text-sm text-foreground/60 px-3">
            صفحة {page + 1} من {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 rounded-lg bg-surface border border-gold-soft/40 text-sm text-foreground/80 hover:border-gold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
