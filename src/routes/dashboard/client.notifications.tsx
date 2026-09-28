import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Check, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/client/notifications")({
  head: () => ({
    meta: [
      { title: "الإشعارات — الوكيل" },
      { name: "description", content: "تابع كل تحديثات قضاياك واستشاراتك وفواتيرك في مكان واحد." },
      { property: "og:title", content: "الإشعارات — الوكيل" },
      { property: "og:description", content: "تابع تحديثات قضاياك واستشاراتك." },
    ],
  }),
  component: ClientNotifications,
});

type Notif = {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  is_read: boolean;
  created_at: string;
};

function ClientNotifications() {
  const { userId } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  async function reload() {
    if (!userId) return;
    setLoading(true);
    let q = supabase
      .from("notifications")
      .select("id, title, body, type, is_read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (filter === "unread") q = q.eq("is_read", false);
    const { data } = await q;
    setItems((data as unknown as Notif[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { reload(); }, [userId, filter]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`client-notifs-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => setItems((prev) => [payload.new as Notif, ...prev]),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  async function markAll() {
    if (!userId) return;
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تحديد الكل كمقروء");
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
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-3xl text-gradient-gold">الإشعارات</h1>
        <button onClick={markAll} className="text-sm border border-border rounded-lg px-3 py-2 hover:border-gold/50 inline-flex items-center gap-1.5">
          <Check className="h-4 w-4" /> تحديد الكل كمقروء
        </button>
      </div>

      <div className="flex gap-2">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm border transition ${
              filter === f ? "bg-gold/15 border-gold/50 text-gold" : "bg-surface border-border text-foreground/70"
            }`}
          >
            {f === "all" ? "الكل" : "غير المقروءة"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-gold" /></div>
      ) : items.length === 0 ? (
        <div className="bg-surface/60 border border-border rounded-2xl p-12 text-center text-foreground/60">
          <Bell className="h-10 w-10 mx-auto mb-3 text-gold/60" />
          لا توجد إشعارات بعد.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border p-4 flex items-start gap-3 ${
                n.is_read ? "bg-surface border-border" : "bg-gold/5 border-gold/30"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm">{n.title}</div>
                {n.body && <div className="text-sm text-foreground/70 mt-1">{n.body}</div>}
                <div className="text-[11px] text-foreground/40 mt-1.5">
                  {new Date(n.created_at).toLocaleString("ar-EG")}
                </div>
              </div>
              <button onClick={() => toggleRead(n)} title="تبديل حالة القراءة" className="text-foreground/50 hover:text-gold">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={() => remove(n.id)} title="حذف" className="text-foreground/50 hover:text-red-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
