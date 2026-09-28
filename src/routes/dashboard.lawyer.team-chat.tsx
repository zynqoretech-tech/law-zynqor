import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { askTeamAi } from "@/lib/team-chat.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, Download, Loader2, Paperclip, Send, Users, X } from "lucide-react";

export const Route = createFileRoute("/dashboard/lawyer/team-chat")({
  head: () => ({
    meta: [
      { title: "محادثات الفريق — الوكيل" },
      { name: "description", content: "محادثة جماعية داخلية لأعضاء مكتب المحاماة مع مساعد ذكي للمهام والقضايا." },
      { property: "og:title", content: "محادثات الفريق — الوكيل" },
      { property: "og:description", content: "محادثة جماعية داخلية لأعضاء مكتب المحاماة." },
    ],
  }),
  component: TeamChatPage,
});

const BUCKET = "team-chat";
const AI_TRIGGERS = ["@ai", "@الوكيل", "@الذكاء"];

type Msg = {
  id: string;
  office_id: string;
  sender_id: string;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  is_ai: boolean;
  created_at: string;
};

const SELECT =
  "id, office_id, sender_id, body, attachment_url, attachment_name, attachment_type, attachment_size, is_ai, created_at";

function fmtSize(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, new Date())) return "اليوم";
  if (same(d, new Date(Date.now() - 86400000))) return "أمس";
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

function Attachment({ msg }: { msg: Msg }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = (msg.attachment_type ?? "").startsWith("image/");

  useEffect(() => {
    let alive = true;
    if (!msg.attachment_url) return;
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(msg.attachment_url, 60 * 60)
      .then(({ data }) => {
        if (alive) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      alive = false;
    };
  }, [msg.attachment_url]);

  if (!msg.attachment_url) return null;

  if (isImage && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block mt-2">
        <img src={url} alt={msg.attachment_name ?? "مرفق"} className="rounded-lg max-h-64 object-cover" />
      </a>
    );
  }

  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex items-center gap-2 bg-surface/70 border border-border rounded-lg px-3 py-2 text-xs hover:border-gold/50 transition"
    >
      <Download className="h-4 w-4 text-gold shrink-0" />
      <span className="flex-1 truncate">{msg.attachment_name ?? "ملف"}</span>
      <span className="text-foreground/50">{fmtSize(msg.attachment_size)}</span>
    </a>
  );
}

function TeamChatPage() {
  const { profile, loading: authLoading } = useAuth();
  const runAi = useServerFn(askTeamAi);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const meId = profile?.id ?? null;

  useEffect(() => {
    if (!meId) return;
    let alive = true;
    (async () => {
      const { data, error } = await (
        supabase.rpc as unknown as (fn: string) => Promise<{ data: unknown; error: unknown }>
      )("current_office_id");
      if (!alive) return;
      if (error || !data) {
        setOfficeId(null);
        setLoading(false);
        return;
      }
      setOfficeId(data as string);
    })();
    return () => {
      alive = false;
    };
  }, [meId]);

  const loadNames = useCallback(async (office: string) => {
    const [owner, members] = await Promise.all([
      supabase.from("profiles").select("id, full_name").eq("id", office).maybeSingle(),
      supabase.from("team_members").select("member_profile_id").eq("office_lawyer_id", office).eq("is_active", true),
    ]);
    const ids = (members.data ?? []).map((m) => m.member_profile_id);
    const map: Record<string, string> = {};
    if (owner.data) map[owner.data.id] = owner.data.full_name ?? "صاحب المكتب";
    if (ids.length > 0) {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      for (const p of data ?? []) map[p.id] = p.full_name ?? "عضو الفريق";
    }
    setNames(map);
  }, []);

  useEffect(() => {
    if (!officeId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("team_chat_messages")
        .select(SELECT)
        .eq("office_id", officeId)
        .order("created_at", { ascending: true })
        .limit(300);
      if (!alive) return;
      if (error) toast.error("تعذر تحميل المحادثة");
      setMessages((data as Msg[]) ?? []);
      setLoading(false);
      loadNames(officeId);
    })();

    const channel = supabase
      .channel(`team-chat-${officeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_chat_messages", filter: `office_id=eq.${officeId}` },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [officeId, loadNames]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiThinking]);

  const grouped = useMemo(() => {
    const out: { day: string; items: Msg[] }[] = [];
    for (const m of messages) {
      const d = dayLabel(m.created_at);
      const last = out[out.length - 1];
      if (last && last.day === d) last.items.push(m);
      else out.push({ day: d, items: [m] });
    }
    return out;
  }, [messages]);

  async function send() {
    const text = input.trim();
    if ((!text && !file) || !officeId || !meId || sending) return;
    setSending(true);
    try {
      let attachment: Partial<Msg> = {};
      if (file) {
        setUploadPct(10);
        const path = `${officeId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-\u0600-\u06FF]/g, "_")}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
        if (error) throw new Error(error.message);
        setUploadPct(100);
        attachment = {
          attachment_url: path,
          attachment_name: file.name,
          attachment_type: file.type || "application/octet-stream",
          attachment_size: file.size,
        };
      }

      const { data: inserted, error: insErr } = await supabase
        .from("team_chat_messages")
        .insert({ office_id: officeId, sender_id: meId, body: text, ...attachment })
        .select(SELECT)
        .single();
      if (insErr) throw new Error(insErr.message);

      setMessages((prev) => (prev.some((p) => p.id === inserted.id) ? prev : [...prev, inserted as Msg]));
      setInput("");
      setFile(null);
      setUploadPct(null);
      if (fileRef.current) fileRef.current.value = "";

      const lower = text.toLowerCase();
      if (AI_TRIGGERS.some((t) => lower.includes(t))) {
        setAiThinking(true);
        try {
          const reply = (await runAi({ data: { officeId, question: text } })) as Msg;
          setMessages((prev) => (prev.some((p) => p.id === reply.id) ? prev : [...prev, reply]));
        } catch (e) {
          toast.error((e as Error).message || "تعذر الحصول على رد المساعد");
        } finally {
          setAiThinking(false);
        }
      }
    } catch (e) {
      toast.error((e as Error).message || "تعذر إرسال الرسالة");
      setUploadPct(null);
    } finally {
      setSending(false);
    }
  }

  function mentionAi() {
    setInput((v) => (AI_TRIGGERS.some((t) => v.includes(t)) ? v : `@الوكيل ${v}`.trimEnd() + " ").trimStart());
    taRef.current?.focus();
  }

  if (authLoading || (loading && officeId)) {
    return (
      <div className="flex items-center justify-center py-20 text-foreground/60">
        <Loader2 className="h-5 w-5 animate-spin text-gold" />
      </div>
    );
  }

  if (!officeId) {
    return (
      <div className="bg-surface/60 border border-border rounded-2xl p-8 text-center text-foreground/70">
        <Users className="h-8 w-8 mx-auto mb-3 text-gold" />
        محادثات الفريق متاحة لأعضاء مكاتب المحاماة فقط. أنشئ مكتبك أو اطلب من مدير المكتب إضافتك للفريق.
      </div>
    );
  }

  const memberCount = Object.keys(names).length;

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] bg-surface/50 border border-gold-soft/30 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-elevated/70">
        <div className="h-10 w-10 rounded-full bg-gold/15 border border-gold/40 grid place-items-center">
          <Users className="h-5 w-5 text-gold" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-foreground">محادثات الفريق</div>
          <div className="text-xs text-foreground/55 truncate">
            {memberCount} عضو · اكتب <span className="text-gold">@الوكيل</span> لسؤال المساعد الذكي
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 md:px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-sm text-foreground/50 py-10">
            لا توجد رسائل بعد. ابدأ المحادثة مع فريقك.
          </div>
        )}
        {grouped.map((g) => (
          <div key={g.day} className="space-y-2">
            <div className="flex justify-center">
              <span className="text-[11px] bg-elevated border border-border rounded-full px-3 py-1 text-foreground/50">
                {g.day}
              </span>
            </div>
            {g.items.map((m) => {
              const mine = !m.is_ai && m.sender_id === meId;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-3.5 py-2.5 ${
                      m.is_ai
                        ? "bg-gold/10 border border-gold/30"
                        : mine
                          ? "bg-gold/15 border border-gold/25"
                          : "bg-elevated border border-border"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] mb-1">
                      {m.is_ai ? (
                        <>
                          <Bot className="h-3.5 w-3.5 text-gold" />
                          <span className="text-gold font-medium">الوكيل — المساعد الذكي</span>
                        </>
                      ) : (
                        <span className="text-foreground/55 font-medium">
                          {mine ? "أنت" : (names[m.sender_id] ?? "عضو الفريق")}
                        </span>
                      )}
                    </div>
                    {m.body && (
                      <div className="whitespace-pre-wrap leading-relaxed text-sm text-foreground/90 break-words">
                        {m.body}
                      </div>
                    )}
                    <Attachment msg={m} />
                    <div className="text-[10px] text-foreground/40 mt-1 text-left">{time(m.created_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {aiThinking && (
          <div className="flex justify-end">
            <div className="bg-gold/10 border border-gold/30 rounded-2xl px-4 py-2.5 inline-flex items-center gap-2 text-sm text-foreground/70">
              <Loader2 className="h-4 w-4 animate-spin text-gold" /> الوكيل يراجع بيانات المكتب...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border bg-elevated/70 px-3 py-3 space-y-2">
        {file && (
          <div className="flex items-center gap-2 text-xs bg-surface border border-border rounded-lg px-3 py-2">
            <Paperclip className="h-3.5 w-3.5 text-gold" />
            <span className="flex-1 truncate">{file.name}</span>
            <span className="text-foreground/50">{fmtSize(file.size)}</span>
            {uploadPct !== null && <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />}
            <button onClick={() => setFile(null)} className="text-foreground/50 hover:text-red-400">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="p-3 rounded-xl border border-border text-foreground/70 hover:border-gold/50 hover:text-gold transition"
            title="إرفاق ملف أو صورة"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            onClick={mentionAi}
            className="p-3 rounded-xl border border-gold/40 text-gold hover:bg-gold/10 transition"
            title="اسأل المساعد الذكي"
          >
            <Bot className="h-4 w-4" />
          </button>
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="اكتب رسالة للفريق… استخدم @الوكيل لسؤال المساعد الذكي"
            className="flex-1 resize-none bg-surface border border-border focus:border-gold rounded-xl px-4 py-3 text-sm text-foreground outline-none max-h-32"
          />
          <button
            onClick={send}
            disabled={sending || (!input.trim() && !file)}
            className="bg-gold-gradient text-primary-foreground font-semibold px-4 py-3 rounded-xl inline-flex items-center gap-2 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
