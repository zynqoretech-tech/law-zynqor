import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Check, Trash2, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/lawyer/notifications")({
  head: () => ({ meta: [{ title: "الإشعارات — الوكيل" }] }),
  component: NotifsPage,
});

type Notif = {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  is_read: boolean;
  created_at: string;
};

const FILTERS = [
  { v: "all", l: "الكل" },
  { v: "unread", l: "غير المقروءة" },
  { v: "read", l: "المقروءة" },
];

function NotifsPage() {
  const { userId } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [busy, setBusy] = useState(false);

  async function reload() {
    if (!userId) return;
    setLoading(true);
    let q = supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
    if (filter === "unread") q = q.eq("is_read", false);
    else if (filter === "read") q = q.eq("is_read", true);
    const { data } = await q;
    setItems((data as unknown as Notif[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { reload(); }, [userId, filter]);

  async function markAll() {
    if (!userId) return;
    setBusy(true);
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تحديد الكل كمقروء");
    reload();
  }

  async function clearRead() {
    if (!userId) return;
    if (!confirm("حذف جميع الإشعارات المقروءة؟")) return;
    setBusy(true);
    const { error } = await supabase.from("notifications").delete().eq("user_id", userId).eq("is_read", true);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    reload();
  }

  async function toggleRead(n: Notif) {
    await supabase.from("notifications").update({ is_read: !n.is_read }).eq("id", n.id);
    setItems((arr) => arr.map((x) => (x.id === n.id ? { ...x, is_read: !x.is_read } : x)));
  }

  async function remove(id: string) {
    await supabase.from("notifications").delete().eq("id", id);
    setItems((arr) => arr.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-gradient-gold font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" /> الإشعارات
          </h1>
          <p className="text-foreground/60 text-sm mt-1">{items.length} إشعار</p>
        </div>
        <div className="flex gap-2">
          <button disabled={busy} onClick={markAll} className="inline-flex items-center gap-1.5 text-sm bg-surface border border-gold/40 text-foreground/80 hover:text-gold px-3 py-2 rounded-lg disabled:opacity-50">
            <Check className="h-4 w-4" /> تحديد الكل كمقروء
          </button>
          <button disabled={busy} onClick={clearRead} className="inline-flex items-center gap-1.5 text-sm bg-destructive/10 border border-destructive/40 text-destructive hover:bg-destructive/20 px-3 py-2 rounded-lg disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> حذف المقروءة
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-gold" />
        {FILTERS.map((f) => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            className={`px-3 py-1.5 rounded-full text-xs border transition ${filter === f.v ? "bg-gold-gradient text-primary-foreground border-transparent" : "bg-surface/60 border-gold-soft/40 text-foreground/70 hover:border-gold/60"}`}>
            {f.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-6xl mb-4">🔔</div>
          <h3 className="font-display text-xl text-foreground mb-2">لا توجد إشعارات</h3>
          <p className="text-foreground/60 text-sm">ستظهر هنا الإشعارات الجديدة عند وصولها</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <div key={n.id} className={`bg-surface border ${n.is_read ? "border-border" : "border-gold/40"} rounded-xl p-4`}>
              <div className="flex items-start gap-3">
                <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${n.is_read ? "bg-foreground/20" : "bg-gold animate-pulse"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">{n.title}</div>
                  {n.body && <div className="text-xs text-foreground/70 mt-1">{n.body}</div>}
                  <div className="text-[11px] text-foreground/40 mt-1">{new Date(n.created_at).toLocaleString("ar-EG")}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={(e) => { e.preventDefault(); toggleRead(n); }}
                    className="text-xs text-foreground/50 hover:text-gold p-1.5 rounded" title={n.is_read ? "تحديد كغير مقروء" : "تحديد كمقروء"}>
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={(e) => { e.preventDefault(); remove(n.id); }}
                    className="text-xs text-foreground/50 hover:text-destructive p-1.5 rounded" title="حذف">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}