import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ChatPanel } from "@/components/ChatPanel";
import { ArrowRight, Loader2, MessagesSquare, Search } from "lucide-react";

type Conv = {
  id: string;
  lawyer_id: string;
  client_id: string;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
};

function timeLabel(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString())
    return d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

export function MessagesView({ role }: { role: "lawyer" | "client" }) {
  const { userId } = useAuth();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [peers, setPeers] = useState<Record<string, { full_name: string; avatar_url: string | null }>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [mobileChat, setMobileChat] = useState(false);

  const loadUnread = useCallback(async (ids: string[], me: string) => {
    if (ids.length === 0) return;
    const { data } = await supabase
      .from("messages")
      .select("conversation_id, sender_id, read_at")
      .in("conversation_id", ids)
      .is("read_at", null);
    const counts: Record<string, number> = {};
    for (const m of (data as any[]) ?? []) {
      if (m.sender_id === me) continue;
      counts[m.conversation_id] = (counts[m.conversation_id] ?? 0) + 1;
    }
    setUnread(counts);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      setLoading(true);
      const col = role === "lawyer" ? "lawyer_id" : "client_id";
      const { data } = await supabase
        .from("conversations")
        .select("id, lawyer_id, client_id, last_message, last_message_at, created_at")
        .eq(col, userId)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      const list = (data as Conv[]) ?? [];
      const peerIds = list.map((c) => (role === "lawyer" ? c.client_id : c.lawyer_id));
      const map: Record<string, { full_name: string; avatar_url: string | null }> = {};
      if (peerIds.length > 0) {
        const { data: pdata } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", peerIds);
        for (const p of pdata ?? []) map[(p as any).id] = { full_name: (p as any).full_name, avatar_url: (p as any).avatar_url };
      }
      if (!active) return;
      setConvs(list);
      setPeers(map);
      setActiveId((prev) => prev ?? list[0]?.id ?? null);
      setLoading(false);
      loadUnread(list.map((c) => c.id), userId);
    })();
    return () => { active = false; };
  }, [userId, role, loadUnread]);

  // Live conversation list: last message preview, ordering and unread badges.
  useEffect(() => {
    if (!userId) return;
    const col = role === "lawyer" ? "lawyer_id" : "client_id";
    const channel = supabase
      .channel(`convs:${role}:${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `${col}=eq.${userId}` },
        (payload) => {
          const c = payload.new as Conv;
          setConvs((prev) => {
            const next = prev.map((p) => (p.id === c.id ? { ...p, ...c } : p));
            return next.sort(
              (a, b) => new Date(b.last_message_at ?? b.created_at).getTime() - new Date(a.last_message_at ?? a.created_at).getTime(),
            );
          });
          setActiveId((cur) => {
            if (cur !== c.id) setUnread((u) => ({ ...u, [c.id]: (u[c.id] ?? 0) + 1 }));
            return cur;
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, role]);

  // Opening a conversation clears its badge (ChatPanel marks the rows read).
  useEffect(() => {
    if (!activeId) return;
    setUnread((u) => (u[activeId] ? { ...u, [activeId]: 0 } : u));
  }, [activeId]);

  const peerOf = useCallback(
    (c: Conv) => peers[role === "lawyer" ? c.client_id : c.lawyer_id],
    [peers, role],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return convs;
    return convs.filter((c) => {
      const p = peerOf(c);
      return (
        (p?.full_name ?? "").toLowerCase().includes(term) ||
        (c.last_message ?? "").toLowerCase().includes(term)
      );
    });
  }, [convs, q, peerOf]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;

  const active = convs.find((c) => c.id === activeId) ?? null;
  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        {mobileChat && (
          <button onClick={() => setMobileChat(false)} className="md:hidden text-foreground/70 hover:text-gold" aria-label="رجوع">
            <ArrowRight className="h-5 w-5" />
          </button>
        )}
        <h1 className="font-display text-3xl text-gradient-gold">المحادثات</h1>
        {totalUnread > 0 && (
          <span className="text-[11px] font-bold rounded-full bg-gold text-primary-foreground px-2 py-0.5">
            {totalUnread}
          </span>
        )}
      </div>

      {convs.length === 0 ? (
        <div className="bg-surface/60 border border-border rounded-2xl p-12 text-center text-foreground/60">
          <MessagesSquare className="h-10 w-10 mx-auto mb-3 text-gold/60" />
          لا توجد محادثات بعد — تبدأ المحادثة تلقائياً فور قبول طلب توكيل أو استشارة.
        </div>
      ) : (
        <div className="grid md:grid-cols-[300px_1fr] gap-4">
          <div className={`${mobileChat ? "hidden md:flex" : "flex"} flex-col bg-surface/60 border border-border rounded-2xl overflow-hidden`}>
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="h-4 w-4 absolute top-1/2 -translate-y-1/2 right-3 text-foreground/40" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ابحث في المحادثات…"
                  className="w-full pr-9 pl-3 py-2 rounded-xl bg-background border border-border text-sm outline-none focus:border-gold"
                />
              </div>
            </div>
            <div className="divide-y divide-border max-h-[62vh] overflow-y-auto">
              {filtered.length === 0 && (
                <div className="p-6 text-center text-sm text-foreground/50">لا توجد نتائج</div>
              )}
              {filtered.map((c) => {
                const p = peerOf(c);
                const n = unread[c.id] ?? 0;
                return (
                  <button
                    key={c.id}
                    onClick={() => { setActiveId(c.id); setMobileChat(true); }}
                    className={`w-full text-right px-4 py-3 flex items-center gap-3 transition ${
                      c.id === activeId ? "bg-gold/10" : "hover:bg-surface"
                    }`}
                  >
                    {p?.avatar_url ? (
                      <img src={p.avatar_url} alt={p.full_name} className="h-10 w-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="h-10 w-10 shrink-0 rounded-full bg-gold-gradient flex items-center justify-center text-primary-foreground font-bold">
                        {(p?.full_name ?? "؟")[0]}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate flex-1">{p?.full_name ?? "مستخدم"}</span>
                        <span className="text-[10px] text-foreground/40 shrink-0">{timeLabel(c.last_message_at)}</span>
                      </div>
                      <div className={`text-xs truncate ${n > 0 ? "text-foreground/80" : "text-foreground/50"}`}>
                        {c.last_message ?? "بدون رسائل"}
                      </div>
                    </div>
                    {n > 0 && (
                      <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-gold text-primary-foreground text-[11px] font-bold flex items-center justify-center">
                        {n > 99 ? "99+" : n}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {active && userId && (
            <div className={`${mobileChat ? "block" : "hidden md:block"}`}>
              <ChatPanel
                key={active.id}
                conversationId={active.id}
                meId={userId}
                peerName={peerOf(active)?.full_name ?? "مستخدم"}
                peerAvatar={peerOf(active)?.avatar_url}
                canForward={role === "lawyer"}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
