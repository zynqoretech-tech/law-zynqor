import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Loader2, MessageSquare, Receipt, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { openConversation } from "@/lib/chat";

export const Route = createFileRoute("/dashboard/lawyer/consultations")({
  head: () => ({
    meta: [
      { title: "الاستشارات — الوكيل" },
      { name: "description", content: "إدارة طلبات الاستشارات القانونية ومواعيدها وفواتيرها." },
      { property: "og:title", content: "الاستشارات — الوكيل" },
      { property: "og:description", content: "إدارة طلبات الاستشارات ومواعيدها وفواتيرها." },
    ],
  }),
  component: ConsultationsPage,
});

type Consultation = {
  id: string;
  client_id: string | null;
  type: string;
  scheduled_at: string;
  duration_minutes: number | null;
  price: number;
  status: string | null;
  notes: string | null;
  meeting_link: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "بانتظار الموافقة",
  confirmed: "مؤكدة",
  completed: "منتهية",
  cancelled: "ملغاة",
};

const TABS = [
  { v: "pending", l: "طلبات جديدة" },
  { v: "confirmed", l: "قادمة" },
  { v: "completed", l: "منتهية" },
  { v: "all", l: "الكل" },
];

function ConsultationsPage() {
  const { userId } = useAuth();
  const [items, setItems] = useState<Consultation[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [tab, setTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function reload() {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("consultations")
      .select("id, client_id, type, scheduled_at, duration_minutes, price, status, notes, meeting_link")
      .eq("lawyer_id", userId)
      .order("scheduled_at", { ascending: false });
    const list = (data as unknown as Consultation[]) ?? [];
    setItems(list);
    const ids = [...new Set(list.map((c) => c.client_id).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map: Record<string, string> = {};
      for (const p of (profs as any[]) ?? []) map[p.id] = p.full_name;
      setClients(map);
    }
    setLoading(false);
  }

  useEffect(() => { reload(); }, [userId]);

  const filtered = useMemo(
    () => (tab === "all" ? items : items.filter((c) => (c.status ?? "pending") === tab)),
    [items, tab],
  );

  const stats = useMemo(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    return {
      pending: items.filter((c) => (c.status ?? "pending") === "pending").length,
      upcoming: items.filter((c) => c.status === "confirmed" && new Date(c.scheduled_at).getTime() > Date.now()).length,
      revenue: items
        .filter((c) => c.status === "completed" && new Date(c.scheduled_at).getTime() >= monthStart)
        .reduce((s, c) => s + Number(c.price ?? 0), 0),
    };
  }, [items]);

  async function setStatus(c: Consultation, status: string) {
    setBusy(c.id);
    const { error } = await supabase.from("consultations").update({ status }).eq("id", c.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("تم التحديث");
    if (status === "confirmed" && c.client_id && userId) {
      await openConversation({ lawyerId: userId, clientId: c.client_id, source: "consultation", sourceId: c.id });
    }
    reload();
  }

  async function createInvoice(c: Consultation) {
    if (!userId || !c.client_id) { toast.error("لا يوجد موكل مسجل لهذه الاستشارة"); return; }
    setBusy(c.id);
    const { error } = await supabase.from("invoices").insert({
      invoice_number: `CONS-${Date.now().toString().slice(-8)}`,
      lawyer_id: userId,
      client_id: c.client_id,
      amount: c.price,
      total_amount: c.price,
      status: "unpaid",
      notes: `فاتورة استشارة ${c.type} بتاريخ ${new Date(c.scheduled_at).toLocaleDateString("ar-EG")}`,
    } as never);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إنشاء الفاتورة في قسم الأتعاب");
  }

  async function openChat(c: Consultation) {
    if (!userId || !c.client_id) return;
    const id = await openConversation({ lawyerId: userId, clientId: c.client_id, source: "consultation", sourceId: c.id });
    if (id) window.location.href = "/dashboard/lawyer/messages";
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="font-display text-3xl text-gradient-gold">الاستشارات</h1>
        <p className="text-foreground/60 text-sm mt-1">طلبات الاستشارات، مواعيدها، وفواتيرها في مكان واحد.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-2xl font-bold text-gold">{stats.pending}</div>
          <div className="text-xs text-foreground/60 mt-1">طلبات بانتظارك</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-2xl font-bold text-gold">{stats.upcoming}</div>
          <div className="text-xs text-foreground/60 mt-1">استشارات قادمة</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-2xl font-bold text-gold">{stats.revenue.toLocaleString()} ج</div>
          <div className="text-xs text-foreground/60 mt-1">إيراد الشهر</div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={`px-4 py-2 rounded-lg text-sm border transition ${
              tab === t.v ? "bg-gold/15 border-gold/50 text-gold" : "bg-surface border-border text-foreground/70"
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-gold" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface/60 border border-border rounded-2xl p-12 text-center text-foreground/60">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 text-gold/60" />
          لا توجد استشارات في هذا القسم.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const d = new Date(c.scheduled_at);
            return (
              <div key={c.id} className="bg-surface border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="text-center bg-gold/10 rounded-lg px-3 py-2 shrink-0">
                    <div className="text-lg font-bold text-gold">{d.getDate()}</div>
                    <div className="text-xs text-foreground/60">{d.toLocaleDateString("ar-EG", { month: "short" })}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{clients[c.client_id ?? ""] ?? "موكل"}</div>
                    <div className="text-xs text-foreground/60 mt-0.5">
                      {c.type} • {d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })} •{" "}
                      {c.duration_minutes ?? 30} دقيقة • {Number(c.price ?? 0).toLocaleString()} ج
                    </div>
                    {c.notes && <p className="text-sm text-foreground/70 mt-2 whitespace-pre-wrap">{c.notes}</p>}
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-elevated border border-border text-foreground/70 shrink-0">
                    {STATUS_LABEL[c.status ?? "pending"] ?? c.status}
                  </span>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {(c.status ?? "pending") === "pending" && (
                    <>
                      <button
                        onClick={() => setStatus(c, "confirmed")}
                        disabled={busy === c.id}
                        className="inline-flex items-center gap-1.5 bg-gold-gradient text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" /> قبول
                      </button>
                      <button
                        onClick={() => setStatus(c, "cancelled")}
                        disabled={busy === c.id}
                        className="inline-flex items-center gap-1.5 border border-border text-sm px-4 py-2 rounded-lg text-foreground/70 hover:text-red-300"
                      >
                        <X className="h-4 w-4" /> رفض
                      </button>
                    </>
                  )}
                  {c.status === "confirmed" && (
                    <button
                      onClick={() => setStatus(c, "completed")}
                      disabled={busy === c.id}
                      className="inline-flex items-center gap-1.5 bg-gold-gradient text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" /> إنهاء الاستشارة
                    </button>
                  )}
                  {c.client_id && (
                    <button
                      onClick={() => openChat(c)}
                      className="inline-flex items-center gap-1.5 border border-border text-sm px-4 py-2 rounded-lg text-foreground/70 hover:border-gold/50"
                    >
                      <MessageSquare className="h-4 w-4" /> محادثة
                    </button>
                  )}
                  <button
                    onClick={() => createInvoice(c)}
                    disabled={busy === c.id}
                    className="inline-flex items-center gap-1.5 border border-border text-sm px-4 py-2 rounded-lg text-foreground/70 hover:border-gold/50 disabled:opacity-50"
                  >
                    <Receipt className="h-4 w-4" /> إصدار فاتورة
                  </button>
                  <Link
                    to="/dashboard/lawyer/consultations/$id"
                    params={{ id: String(c.id) }}
                    className="inline-flex items-center gap-1.5 border border-gold/40 text-gold text-sm px-4 py-2 rounded-lg hover:bg-gold/10"
                  >
                    تفاصيل الاستشارة ←
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
