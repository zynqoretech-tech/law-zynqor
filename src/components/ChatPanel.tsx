import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, CheckCheck, ChevronDown, Clock3, Download, FolderPlus, Loader2, Paperclip, Send, X } from "lucide-react";

const BUCKET = "chat-files";

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  _pending?: boolean;
};

const SELECT =
  "id, conversation_id, sender_id, body, attachment_url, attachment_name, attachment_type, attachment_size, delivered_at, read_at, created_at";

function fmtSize(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(Date.now() - 86400000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "اليوم";
  if (same(d, yest)) return "أمس";
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
}

/** WhatsApp-style delivery ticks for my own messages. */
function Ticks({ m }: { m: ChatMessage }) {
  if (m._pending) return <Clock3 className="h-3 w-3 text-foreground/40" />;
  if (m.read_at) return <CheckCheck className="h-3.5 w-3.5 text-sky-400" />;
  if (m.delivered_at) return <CheckCheck className="h-3.5 w-3.5 text-foreground/45" />;
  return <Check className="h-3.5 w-3.5 text-foreground/45" />;
}

export function ChatPanel({
  conversationId,
  meId,
  peerName,
  peerAvatar,
  canForward = false,
}: {
  conversationId: string;
  meId: string;
  peerName: string;
  peerAvatar?: string | null;
  /** Lawyers can forward attachments into a case / the archive. */
  canForward?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [forwarding, setForwarding] = useState<ChatMessage | null>(null);
  const [peerOnline, setPeerOnline] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingSentAt = useRef(0);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    endRef.current?.scrollIntoView({ behavior });
    setNewCount(0);
  }, []);

  const upsert = useCallback((m: ChatMessage) => {
    setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev.map((p) => (p.id === m.id ? { ...p, ...m } : p)) : [...prev, m]));
  }, []);

  // Load + realtime
  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessages([]);
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select(SELECT)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (!active) return;
      setMessages((data as unknown as ChatMessage[]) ?? []);
      setLoading(false);
    })();

    let typingTimer: ReturnType<typeof setTimeout> | undefined;

    const channel = supabase
      .channel(`chat:${conversationId}`, { config: { presence: { key: meId } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          upsert(m);
          if (m.sender_id !== meId) setPeerTyping(false);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => upsert(payload.new as ChatMessage),
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if ((payload as { from?: string })?.from === meId) return;
        setPeerTyping(true);
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => setPeerTyping(false), 3000);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>;
        setPeerOnline(Object.keys(state).some((k) => k !== meId));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") channel.track({ at: Date.now() });
      });

    chanRef.current = channel;

    return () => {
      active = false;
      clearTimeout(typingTimer);
      chanRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [conversationId, meId, upsert]);

  function notifyTyping() {
    const now = Date.now();
    if (now - typingSentAt.current < 1200) return;
    typingSentAt.current = now;
    chanRef.current?.send({ type: "broadcast", event: "typing", payload: { from: meId } });
  }

  // Mark peer messages delivered + read while the panel is open
  useEffect(() => {
    const incoming = messages.filter((m) => m.sender_id !== meId && !m.read_at && !m._pending);
    if (incoming.length === 0) return;
    const ids = incoming.map((m) => m.id);
    const now = new Date().toISOString();
    supabase
      .from("messages")
      .update({ read_at: now, delivered_at: now })
      .in("id", ids)
      .then(() => {
        setMessages((prev) => prev.map((m) => (ids.includes(m.id) ? { ...m, read_at: now, delivered_at: now } : m)));
      });
  }, [messages, meId]);

  // Signed URLs for attachments
  useEffect(() => {
    const missing = messages.filter((m) => m.attachment_url && !urls[m.attachment_url]);
    if (missing.length === 0) return;
    (async () => {
      const next: Record<string, string> = {};
      for (const m of missing) {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(m.attachment_url!, 60 * 60);
        if (data?.signedUrl) next[m.attachment_url!] = data.signedUrl;
      }
      if (Object.keys(next).length) setUrls((u) => ({ ...u, ...next }));
    })();
  }, [messages, urls]);

  // Auto-scroll only when the user is already at the bottom; otherwise badge the new messages.
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (atBottom || last.sender_id === meId) scrollToBottom(loading ? "auto" : "smooth");
    else setNewCount((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  useEffect(() => {
    if (peerTyping && atBottom) scrollToBottom();
  }, [peerTyping, atBottom, scrollToBottom]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAtBottom(near);
    if (near) setNewCount(0);
  }

  async function insertMessage(payload: {
    body: string;
    attachment_url?: string | null;
    attachment_name?: string | null;
    attachment_type?: string | null;
    attachment_size?: number | null;
  }) {
    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: meId,
        body: payload.body,
        attachment_url: payload.attachment_url ?? null,
        attachment_name: payload.attachment_name ?? null,
        attachment_type: payload.attachment_type ?? null,
        attachment_size: payload.attachment_size ?? null,
      } as never)
      .select(SELECT)
      .single();
    if (error) throw error;
    upsert(data as unknown as ChatMessage);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    if (taRef.current) taRef.current.style.height = "auto";
    try {
      await insertMessage({ body });
    } catch (err) {
      setText(body);
      toast.error((err as Error).message);
    }
    setSending(false);
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("أقصى حجم للملف 20 ميجابايت");
      return;
    }
    setUploading(true);
    try {
      const safe = file.name.replace(/[^\w.\-\u0600-\u06FF]+/g, "_");
      const path = `${conversationId}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      await insertMessage({
        body: "",
        attachment_url: path,
        attachment_name: file.name,
        attachment_type: file.type,
        attachment_size: file.size,
      });
    } catch (err) {
      toast.error((err as Error).message);
    }
    setUploading(false);
  }

  const grouped = useMemo(() => {
    const out: Array<{ day: string; items: ChatMessage[] }> = [];
    for (const m of messages) {
      const label = dayLabel(m.created_at);
      const last = out[out.length - 1];
      if (last && last.day === label) last.items.push(m);
      else out.push({ day: label, items: [m] });
    }
    return out;
  }, [messages]);

  return (
    <div className="flex flex-col h-[70vh] bg-surface/60 border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface">
        {peerAvatar ? (
          <img src={peerAvatar} alt={peerName} className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-gold-gradient flex items-center justify-center text-primary-foreground font-bold">
            {peerName[0] ?? "؟"}
          </div>
        )}
        <div className="min-w-0">
          <div className="font-semibold truncate">{peerName}</div>
          <div className="text-[11px] h-4 text-foreground/50">
            {peerTyping ? (
              <span className="text-gold inline-flex items-center gap-1">
                يكتب الآن
                <span className="inline-flex gap-0.5">
                  <span className="h-1 w-1 rounded-full bg-gold animate-bounce [animation-delay:-0.2s]" />
                  <span className="h-1 w-1 rounded-full bg-gold animate-bounce [animation-delay:-0.1s]" />
                  <span className="h-1 w-1 rounded-full bg-gold animate-bounce" />
                </span>
              </span>
            ) : peerOnline ? (
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> متصل الآن
              </span>
            ) : (
              "غير متصل"
            )}
          </div>
        </div>
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto p-4 space-y-2 islamic-pattern">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>
        ) : messages.length === 0 ? (
          <div className="text-center text-foreground/50 text-sm py-10">ابدأ المحادثة الآن</div>
        ) : (
          grouped.map((g) => (
            <div key={g.day} className="space-y-2">
              <div className="flex justify-center">
                <span className="text-[10px] bg-surface border border-border rounded-full px-3 py-1 text-foreground/50">{g.day}</span>
              </div>
              {g.items.map((m) => {
                const mine = m.sender_id === meId;
                const signed = m.attachment_url ? urls[m.attachment_url] : undefined;
                const isImage = (m.attachment_type ?? "").startsWith("image/");
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                        mine
                          ? "bg-gold/15 border border-gold/30 text-foreground rounded-bl-sm"
                          : "bg-surface border border-border text-foreground/90 rounded-br-sm"
                      }`}
                    >
                      {m.attachment_url && (
                        <div className="mb-1.5">
                          {isImage && signed ? (
                            <a href={signed} target="_blank" rel="noreferrer">
                              <img src={signed} alt={m.attachment_name ?? "صورة"} className="rounded-lg max-h-56 object-cover" />
                            </a>
                          ) : (
                            <a
                              href={signed}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 bg-background/60 border border-border rounded-lg px-3 py-2 hover:border-gold/50"
                            >
                              <Download className="h-4 w-4 text-gold shrink-0" />
                              <span className="min-w-0">
                                <span className="block truncate max-w-[180px]">{m.attachment_name ?? "ملف"}</span>
                                <span className="block text-[10px] text-foreground/50">{fmtSize(m.attachment_size)}</span>
                              </span>
                            </a>
                          )}
                          {canForward && (
                            <button
                              onClick={() => setForwarding(m)}
                              className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-gold hover:underline"
                            >
                              <FolderPlus className="h-3 w-3" /> حفظ في الأرشيف / قضية
                            </button>
                          )}
                        </div>
                      )}
                      {m.body}
                      <div className="flex items-center gap-1 justify-end text-[10px] text-foreground/40 mt-1">
                        {new Date(m.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                        {mine && <Ticks m={m} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        {peerTyping && (
          <div className="flex justify-end">
            <div className="bg-surface border border-border rounded-2xl rounded-br-sm px-3 py-2 inline-flex gap-1 items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {(!atBottom || newCount > 0) && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          className="self-center -mt-12 mb-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-surface border border-gold/40 text-gold text-xs px-3 py-1.5 shadow-lg"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          {newCount > 0 ? `${newCount} رسالة جديدة` : "الأحدث"}
        </button>
      )}

      <form onSubmit={send} className="flex items-center gap-2 p-3 border-t border-border bg-surface">
        <input ref={fileRef} type="file" className="hidden" onChange={onPickFile} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="إرفاق ملف أو صورة"
          className="h-10 w-10 rounded-xl border border-border text-foreground/70 hover:text-gold hover:border-gold/50 flex items-center justify-center disabled:opacity-40"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </button>
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            notifyTyping();
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(e as unknown as React.FormEvent);
            }
          }}
          placeholder="اكتب رسالتك… (Enter للإرسال، Shift+Enter لسطر جديد)"
          className="flex-1 resize-none max-h-[140px] px-4 py-2.5 rounded-xl bg-background border border-border outline-none focus:border-gold text-sm leading-relaxed"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="h-10 w-10 rounded-xl bg-gold-gradient text-primary-foreground flex items-center justify-center disabled:opacity-40"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rotate-180" />}
        </button>
      </form>

      {forwarding && (
        <ForwardDialog message={forwarding} lawyerId={meId} onClose={() => setForwarding(null)} />
      )}
    </div>
  );
}

/** Copies a chat attachment into the lawyer's archive, optionally linked to a case. */
function ForwardDialog({
  message,
  lawyerId,
  onClose,
}: {
  message: ChatMessage;
  lawyerId: string;
  onClose: () => void;
}) {
  const [cases, setCases] = useState<Array<{ id: string; title: string }>>([]);
  const [caseId, setCaseId] = useState("");
  const [name, setName] = useState(message.attachment_name ?? "مرفق محادثة");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("cases")
      .select("id, title")
      .eq("lawyer_id", lawyerId)
      .is("deleted_at", null)
      .then(({ data }) => setCases((data as any[]) ?? []));
  }, [lawyerId]);

  async function save() {
    if (!message.attachment_url) return;
    setBusy(true);
    try {
      const { data: file, error: dlErr } = await supabase.storage.from(BUCKET).download(message.attachment_url);
      if (dlErr || !file) throw dlErr ?? new Error("تعذّر تحميل الملف");
      const path = `${lawyerId}/${Date.now()}_${(message.attachment_name ?? "file").replace(/[^\w.\-\u0600-\u06FF]+/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("archive")
        .upload(path, file, { contentType: message.attachment_type ?? undefined });
      if (upErr) throw upErr;
      const { error } = await supabase.from("archive_files").insert({
        lawyer_id: lawyerId,
        name,
        description: "مُحوَّل من المحادثات",
        storage_path: path,
        mime_type: message.attachment_type,
        size_bytes: message.attachment_size,
        case_id: caseId || null,
      } as never);
      if (error) throw error;
      toast.success("تم حفظ الملف في الأرشيف");
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 w-full max-w-sm space-y-4 relative">
        <button onClick={onClose} className="absolute top-3 left-3 text-foreground/50 hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <h3 className="font-display text-xl text-gradient-gold">حفظ المرفق</h3>
        <div>
          <label className="block text-sm text-foreground/80 mb-1.5">اسم الملف</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-elevated border border-gold-soft/40 focus:border-gold rounded-lg px-3 py-2 text-sm outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-foreground/80 mb-1.5">ربط بقضية (اختياري)</label>
          <select
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            className="w-full bg-elevated border border-gold-soft/40 focus:border-gold rounded-lg px-3 py-2 text-sm outline-none"
          >
            <option value="">بدون قضية — الأرشيف العام</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="w-full bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-xl shadow-gold disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} حفظ
        </button>
      </div>
    </div>
  );
}
