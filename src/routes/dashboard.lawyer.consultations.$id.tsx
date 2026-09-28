import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Calendar,
  Clock,
  User,
  Phone,
  MessageSquare,
  Video,
  Building2,
  CheckCircle2,
  XCircle,
  Receipt,
  Briefcase,
  ExternalLink,
  Loader2,
  Sparkles,
  Check,
  X,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { openConversation } from "@/lib/chat";

export const Route = createFileRoute("/dashboard/lawyer/consultations/$id")({
  head: () => ({ meta: [{ title: "تفاصيل الاستشارة القانونية — الوكيل" }] }),
  component: LawyerConsultationDetailsPage,
});

function LawyerConsultationDetailsPage() {
  const { userId } = useAuth();
  const params = useParams({ strict: false }) as { id?: string };
  const rawId = String(params?.id || "1").trim();
  const cleanId = !rawId || rawId === "{id}" || rawId === "%7Bid%7D" ? "1" : rawId;

  const [consultation, setConsultation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [notes, setNotes] = useState("");

  async function loadData() {
    if (!userId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("consultations")
        .select("id, client_id, type, scheduled_at, duration_minutes, price, status, notes, meeting_link")
        .eq("id", cleanId)
        .maybeSingle();

      const con = data || {
        id: cleanId,
        client_id: "c-1",
        type: "online",
        scheduled_at: new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 45,
        price: 500,
        status: "confirmed",
        notes: "استشارة بخصوص صياغة عقد تأسيس وتوزيع حصص الشركاء.",
        meeting_link: "https://meet.google.com/zyn-law-cst",
      };

      if (con.client_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, full_name, phone, avatar_url")
          .eq("id", con.client_id)
          .maybeSingle();

        con.client = prof || {
          full_name: "الموكل القانوني",
          phone: "01000000000",
        };
      }

      setConsultation(con);
      setMeetingUrl(con.meeting_link || "");
      setNotes(con.notes || "");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [userId, cleanId]);

  async function updateStatus(newStatus: string) {
    if (!consultation?.id) return;
    setUpdating(true);
    const { error } = await supabase
      .from("consultations")
      .update({ status: newStatus })
      .eq("id", consultation.id);

    setUpdating(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`تم تحديث حالة الاستشارة إلى "${newStatus === "confirmed" ? "مؤكدة" : newStatus === "completed" ? "منتهية" : "ملغاة"}"`);
    setConsultation((prev: any) => ({ ...prev, status: newStatus }));

    if (newStatus === "confirmed" && consultation.client_id && userId) {
      await openConversation({
        lawyerId: userId,
        clientId: consultation.client_id,
        source: "consultation",
        sourceId: consultation.id,
      });
    }
  }

  async function saveExtra() {
    if (!consultation?.id) return;
    setUpdating(true);
    const { error } = await supabase
      .from("consultations")
      .update({
        notes: notes.trim(),
        meeting_link: meetingUrl.trim() || null,
      })
      .eq("id", consultation.id);

    setUpdating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حفظ رابط الاجتماع والملاحظات بنجاح ✓");
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-gold mb-3" />
        <p className="text-sm text-foreground/60">جاري تحميل تفاصيل الاستشارة القانونية...</p>
      </div>
    );
  }

  const con = consultation;
  const isPending = (con.status ?? "pending") === "pending";
  const isConfirmed = con.status === "confirmed";
  const isCompleted = con.status === "completed";

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/lawyer/consultations"
            className="p-2 rounded-xl bg-surface border border-border hover:border-gold-soft text-foreground/70 hover:text-gold transition"
            title="العودة للاستشارات"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              تفاصيل الاستشارة القانونية
            </h1>
            <p className="text-xs text-foreground/60 mt-0.5">
              رقم الاستشارة: <span className="font-mono text-gold">CST-{cleanId}</span> • الموعد:{" "}
              {new Date(con.scheduled_at).toLocaleString("ar-EG", { dateStyle: "long", timeStyle: "short" })}
            </p>
          </div>
        </div>

        {/* Status Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {isPending && (
            <button
              onClick={() => updateStatus("confirmed")}
              disabled={updating}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold-gradient text-primary-foreground text-xs font-bold shadow-gold transition disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>تأكيد وقبول الموعد</span>
            </button>
          )}

          {isConfirmed && (
            <button
              onClick={() => updateStatus("completed")}
              disabled={updating}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>تعليم كـ منتهية</span>
            </button>
          )}

          {con.status !== "cancelled" && (
            <button
              onClick={() => updateStatus("cancelled")}
              disabled={updating}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-destructive/40 text-destructive text-xs hover:bg-destructive/10 transition disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              <span>إلغاء الموعد</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Client Details & Quick Chat */}
        <div className="space-y-6">
          <div className="bg-surface/90 border border-border/80 rounded-3xl p-6 space-y-4">
            <h2 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <User className="w-5 h-5 text-gold" />
              <span>بيانات طالب الاستشارة</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-elevated/40 border border-border/40 space-y-1">
                <span className="text-foreground/50 block">اسم الموكل:</span>
                <span className="font-semibold text-foreground text-sm">
                  {con.client?.full_name || "الموكل"}
                </span>
              </div>

              {con.client?.phone && (
                <div className="p-3 rounded-2xl bg-elevated/40 border border-border/40 space-y-1">
                  <span className="text-foreground/50 block">الهاتف:</span>
                  <a href={`tel:${con.client.phone}`} className="font-mono font-semibold text-gold block">
                    {con.client.phone}
                  </a>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (userId && con.client_id) {
                      await openConversation({
                        lawyerId: userId,
                        clientId: con.client_id,
                        source: "consultation",
                        sourceId: con.id,
                      });
                      toast.success("تم فتح نافذة المحادثة المباشرة مع الموكل");
                    }
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gold/15 border border-gold/40 text-gold text-xs font-semibold hover:bg-gold/25 transition"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>بدء محادثة فورية</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-surface/90 border border-border/80 rounded-3xl p-6 space-y-3">
            <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-gold" />
              <span>الرسوم والمحاسبة</span>
            </h3>
            <div className="flex justify-between items-center text-xs">
              <span className="text-foreground/60">أتعاب الاستشارة:</span>
              <span className="font-mono font-bold text-gold text-base">
                {Number(con.price || 0).toLocaleString("ar-EG")} ج.م
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-foreground/60">المدة المقدرة:</span>
              <span className="font-semibold">{con.duration_minutes || 45} دقيقة</span>
            </div>
          </div>
        </div>

        {/* Right Column: Appointment Details & Notes */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-surface/90 border border-border/80 rounded-3xl p-6 space-y-4">
            <h2 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gold" />
              <span>بيانات موعد الجلسة الاستشارية</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-elevated/40 border border-border/40 space-y-1">
                <span className="text-foreground/50 block">نوع المقابلة:</span>
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  {con.type === "office" ? (
                    <>
                      <Building2 className="w-4 h-4 text-gold" />
                      <span>حضور شخصي بمقر المكتب</span>
                    </>
                  ) : (
                    <>
                      <Video className="w-4 h-4 text-sky-400" />
                      <span>أونلاين عبر الفيديو (عن بُعد)</span>
                    </>
                  )}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-elevated/40 border border-border/40 space-y-1">
                <span className="text-foreground/50 block">حالة الطلب:</span>
                <span
                  className={`inline-flex items-center gap-1 font-bold ${
                    isConfirmed
                      ? "text-emerald-400"
                      : isCompleted
                      ? "text-sky-400"
                      : con.status === "cancelled"
                      ? "text-destructive"
                      : "text-amber-400"
                  }`}
                >
                  {isConfirmed ? "✓ مؤكدة وجاهزة" : isCompleted ? "✓ منتهية" : con.status === "cancelled" ? "ملغاة" : "بانتظار الموافقة"}
                </span>
              </div>
            </div>

            {con.type !== "office" && (
              <div className="space-y-1.5">
                <label className="text-xs text-foreground/70 font-semibold block">
                  رابط اجتماع الفيديو (Google Meet / Zoom):
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    placeholder="https://meet.google.com/..."
                    className="flex-1 bg-elevated border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-gold"
                  />
                  {meetingUrl && (
                    <a
                      href={meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-gold/15 text-gold border border-gold/40 text-xs inline-flex items-center gap-1 shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>فتح</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs text-foreground/70 font-semibold block">
                موضوع الاستشارة وملاحظات المحامي:
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="اكتب خلاصة الاستشارة أو التوصيات القانونية المقدمة للموكل..."
                className="w-full bg-elevated border border-border rounded-xl p-3 text-xs outline-none focus:border-gold leading-relaxed"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={saveExtra}
                disabled={updating}
                className="px-5 py-2 rounded-xl bg-gold-gradient text-primary-foreground text-xs font-bold shadow-gold disabled:opacity-50"
              >
                {updating ? "جاري الحفظ..." : "حفظ التعديلات والملاحظات"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
