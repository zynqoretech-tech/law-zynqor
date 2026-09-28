import { handleSupabaseError } from "@/lib/utils";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Star, MapPin, Briefcase, MessageCircle, Calendar, Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { getAuthIntent, clearAuthIntent, redirectToAuthWithIntent } from "@/lib/auth-intent";

export const Route = createFileRoute("/lawyers/$id")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", params.id)
      .maybeSingle();
    return { fullName: (data?.full_name as string | undefined) ?? null };
  },
  head: ({ loaderData }) => ({
    meta: [{
      title: loaderData?.fullName
        ? `الأستاذ ${loaderData.fullName} — الوكيل`
        : "ملف المحامي — الوكيل",
    }],
  }),
  component: LawyerPage,
});

function LawyerPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { isAuthed, loading: authLoading, userId } = useAuth();
  const isSelf = !!userId && userId === id;

  const [lawyer, setLawyer] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [engageOpen, setEngageOpen] = useState(false);

  // Auth Continuation: auto-open BookingDialog or EngagementDialog if the user returned from /auth
  useEffect(() => {
    if (authLoading || !isAuthed) return;
    const intent = getAuthIntent();
    if (intent && intent.pendingAction?.lawyerId === id) {
      if (intent.pendingAction.type === "book_consultation") {
        clearAuthIntent();
        setOpen(true);
      } else if (intent.pendingAction.type === "request_engagement") {
        clearAuthIntent();
        setEngageOpen(true);
      }
    }
  }, [authLoading, isAuthed, id]);

  function handleBookClick() {
    if (!isAuthed) {
      redirectToAuthWithIntent(
        `/lawyers/${id}`,
        { type: "book_consultation", lawyerId: id },
        (opts) => navigate(opts as Parameters<typeof navigate>[0]),
      );
      return;
    }
    setOpen(true);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [l, r] = await Promise.all([
        supabase.from("lawyers").select("*").eq("id", id).maybeSingle(),
        supabase.from("reviews").select("*, reviewer:profiles!client_id(full_name)").eq("lawyer_id", id).eq("is_visible", true).order("created_at", { ascending: false }).limit(20),
      ]);
      const item = l?.data ?? null;
      if (item) {
        setLawyer(item);
        setProfile(item.profile ?? { full_name: item.name || "الأستاذ المحامي", avatar_url: null, location: item.city || "القاهرة" });
      } else {
        setLawyer(null);
        setProfile(null);
      }
      setReviews(r?.data ?? []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-gold" />
      </div>
    );
  }
  if (!lawyer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-4xl text-gradient-gold mb-4">المحامي غير موجود</h1>
          <Link to="/marketplace" className="text-gold hover:underline">العودة للسوق القانوني</Link>
        </div>
      </div>
    );
  }

  const name = profile?.full_name || lawyer.name || lawyer.firm_name || "الأستاذ المحامي";
  const city = lawyer.city ?? profile?.location ?? "القاهرة";

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        <div className="grid md:grid-cols-3 gap-8">
          <aside className="md:col-span-1">
            <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 text-center shadow-gold sticky top-24">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={`صورة ${name}`}
                  loading="lazy"
                  className="h-28 w-28 rounded-2xl object-cover mx-auto mb-4 border border-gold-soft/40"
                />
              ) : (
                <div className="h-28 w-28 rounded-2xl bg-gold-gradient mx-auto flex items-center justify-center font-display text-5xl text-primary-foreground font-bold mb-4">
                  {name?.[0] ?? "أ"}
                </div>
              )}
              <h1 className="font-display text-2xl text-foreground mb-1">{name}</h1>
              {lawyer.firm_name && <div className="text-gold/90 text-sm mb-4">{lawyer.firm_name}</div>}
              <div className="inline-flex items-center gap-1 text-gold mb-6">
                <Star className="h-4 w-4 fill-current" />
                <span className="font-semibold">{lawyer.rating ?? 0}</span>
                <span className="text-foreground/40 text-sm">({lawyer.reviews_count ?? 0} تقييم)</span>
              </div>
              <div className="space-y-2 mb-6 text-sm">
                {Number(lawyer.consultation_price_online) > 0 && (
                  <div className="flex justify-between"><span className="text-foreground/60">أونلاين:</span><span className="text-gold font-bold">{Number(lawyer.consultation_price_online).toLocaleString()} ج</span></div>
                )}
                {Number(lawyer.consultation_price) > 0 && (
                  <div className="flex justify-between"><span className="text-foreground/60">في المكتب:</span><span className="text-gold font-bold">{Number(lawyer.consultation_price).toLocaleString()} ج</span></div>
                )}
              </div>
              {isSelf ? (
                <div className="w-full border border-gold/30 text-gold/70 text-sm font-medium py-3 rounded-xl text-center bg-gold/5">
                  هذا هو ملفك الشخصي العام
                </div>
              ) : (
                <div className="hidden md:block">

                  <button onClick={handleBookClick} className="w-full bg-gold-gradient text-primary-foreground font-semibold py-3 rounded-xl shadow-gold hover:scale-[1.02] transition mb-2 inline-flex items-center justify-center gap-2">
                    <Calendar className="h-4 w-4" /> احجز استشارة
                  </button>
                  <button
                    onClick={() => {
                      if (!isAuthed) {
                        redirectToAuthWithIntent(`/lawyers/${id}`, { type: "request_engagement", lawyerId: id }, (opts) => navigate(opts as Parameters<typeof navigate>[0]));
                        return;
                      }
                      setEngageOpen(true);
                    }}
                    className="w-full border border-gold/40 text-gold font-semibold py-3 rounded-xl hover:bg-gold/10 transition mb-2 inline-flex items-center justify-center gap-2"
                  >
                    <UserPlus className="h-4 w-4" /> طلب توكيل
                  </button>
                </div>

              )}

              {profile.phone && (
                <a href={`tel:${profile.phone}`} className="w-full border border-gold/40 text-gold font-semibold py-3 rounded-xl hover:bg-gold/10 transition inline-flex items-center justify-center gap-2">
                  <MessageCircle className="h-4 w-4" /> اتصل
                </a>
              )}
            </div>
          </aside>

          <section className="md:col-span-2 space-y-6">
            {lawyer.bio && (
              <div className="bg-surface/60 border border-border rounded-2xl p-6">
                <h2 className="font-display text-2xl text-gradient-gold mb-3">نبذة</h2>
                <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap">{lawyer.bio}</p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <Info icon={MapPin} label="المدينة" value={city} />
              <Info icon={Briefcase} label="سنوات الخبرة" value={`${lawyer.experience_years ?? 0} سنة`} />
            </div>

            {(lawyer.specializations ?? []).length > 0 && (
              <div className="bg-surface/60 border border-border rounded-2xl p-6">
                <h2 className="font-display text-2xl text-gradient-gold mb-4">التخصصات</h2>
                <div className="flex flex-wrap gap-2">
                  {lawyer.specializations.map((s: string) => (
                    <span key={s} className="px-4 py-2 rounded-lg bg-gold/10 border border-gold/30 text-gold">{s}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-surface/60 border border-border rounded-2xl p-6">
              <h2 className="font-display text-2xl text-gradient-gold mb-4">التقييمات ({reviews.length})</h2>
              {reviews.length === 0 ? (
                <p className="text-foreground/60 text-sm">لا توجد تقييمات بعد</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((r) => (
                    <div key={r.id} className="border-b border-border pb-3 last:border-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-gold-gradient flex items-center justify-center font-bold text-xs text-primary-foreground">
                            {(r.reviewer?.full_name ?? "م")[0]}
                          </div>
                          <span className="text-sm text-foreground font-medium">
                            {r.reviewer?.full_name ?? "مستخدم"}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 text-gold">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3 w-3 ${i < (r.rating ?? 0) ? "fill-current" : "opacity-30"}`} />
                          ))}
                        </div>
                      </div>
                      {r.review && <p className="text-foreground/80 text-sm">{r.review}</p>}
                      <div className="text-xs text-foreground/50 mt-1">
                        {new Date(r.created_at).toLocaleDateString("ar-EG", { year: "numeric", month: "long" })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {!isSelf && (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur border-t border-gold-soft/40 px-3 py-2.5 flex items-center gap-2">
          <button
            onClick={handleBookClick}
            className="flex-1 bg-gold-gradient text-primary-foreground font-semibold py-3 rounded-xl shadow-gold inline-flex items-center justify-center gap-2 text-sm"
          >
            <Calendar className="h-4 w-4" /> احجز استشارة
          </button>
          <button
            onClick={() => {
              if (!isAuthed) {
                redirectToAuthWithIntent(`/lawyers/${id}`, { type: "request_engagement", lawyerId: id }, (opts) => navigate(opts as Parameters<typeof navigate>[0]));
                return;
              }
              setEngageOpen(true);
            }}
            className="flex-1 border border-gold/40 text-gold font-semibold py-3 rounded-xl inline-flex items-center justify-center gap-2 text-sm"
          >
            <UserPlus className="h-4 w-4" /> طلب توكيل
          </button>
          {profile.phone && (
            <a href={`tel:${profile.phone}`} aria-label="اتصل" className="h-11 w-11 shrink-0 border border-gold/40 text-gold rounded-xl inline-flex items-center justify-center">
              <MessageCircle className="h-4 w-4" />
            </a>
          )}
        </div>
      )}


      {open && <BookingDialog lawyer={lawyer} onClose={() => setOpen(false)} />}
      {engageOpen && <EngagementDialog lawyerId={id} lawyerName={name} onClose={() => setEngageOpen(false)} />}
    </div>
  );
}

function EngagementDialog({ lawyerId, lawyerName, onClose }: { lawyerId: string; lawyerName: string; onClose: () => void }) {
  const { userId } = useAuth();
  const [subject, setSubject] = useState("");
  const [caseType, setCaseType] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!userId) return;
    if (userId === lawyerId) return toast.error("لا يمكنك إرسال طلب توكيل لنفسك");
    if (!subject.trim()) return toast.error("اكتب موضوع الطلب");
    setSaving(true);
    const { data: inserted, error } = await supabase.from("engagement_requests").insert({
      client_id: userId,
      lawyer_id: lawyerId,
      subject: subject.trim(),
      case_type: caseType.trim() || null,
      description: description.trim() || null,
      budget: budget ? Number(budget) : null,
    }).select("id").single();
    setSaving(false);
    if (error) return toast.error(handleSupabaseError(error));
    await supabase.from("notifications").insert({
      user_id: lawyerId,
      type: "engagement_request",
      title: "طلب توكيل جديد",
      body: subject.trim(),
    });
    // Fire telegram notification (silent if user hasn't linked)
    if (inserted?.id) {
      try {
        const { notifyEngagementRequest } = await import("@/lib/telegram-notify.functions");
        await notifyEngagementRequest({ data: { requestId: inserted.id } }).catch(() => {});
      } catch {}
    }
    setSent(true);
  }


  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-gold-soft/40 rounded-2xl shadow-gold max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-gradient-gold">طلب توكيل</h2>
          <button onClick={onClose} className="text-foreground/60 hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        {sent ? (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">✅</div>
            <h3 className="font-display text-xl text-gradient-gold mb-2">تم إرسال طلبك</h3>
            <p className="text-foreground/70 text-sm mb-4">سيراجع الأستاذ {lawyerName} طلبك ويرد عليك قريباً.</p>
            <button onClick={onClose} className="bg-gold-gradient text-primary-foreground font-semibold px-6 py-2 rounded-lg">حسناً</button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-foreground/70">اطلب من الأستاذ {lawyerName} أن يتولى قضيتك. إذا وافق ستضاف تلقائياً كموكل عنده.</p>
            <div>
              <label className="text-sm text-foreground/70 mb-1 block">الموضوع *</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2" placeholder="مثال: نزاع تجاري بشأن عقد بيع" />
            </div>
            <div>
              <label className="text-sm text-foreground/70 mb-1 block">نوع القضية</label>
              <input value={caseType} onChange={(e) => setCaseType(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2" placeholder="مدني / جنائي / تجاري / ..." />
            </div>
            <div>
              <label className="text-sm text-foreground/70 mb-1 block">تفاصيل</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full bg-background border border-border rounded-lg px-3 py-2 resize-none" placeholder="اشرح القضية باختصار..." />
            </div>
            <div>
              <label className="text-sm text-foreground/70 mb-1 block">الميزانية المتاحة (ج.م) — اختياري</label>
              <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={submit} disabled={saving} className="flex-1 bg-gold-gradient text-primary-foreground font-semibold py-2 rounded-lg disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} إرسال الطلب
              </button>
              <button onClick={onClose} className="px-4 border border-border rounded-lg text-foreground/70 hover:bg-surface">إلغاء</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BookingDialog({ lawyer, onClose }: { lawyer: any; onClose: () => void }) {
  const { userId } = useAuth();
  const [type, setType] = useState<"online" | "office">("online");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [booked, setBooked] = useState(false);

  const price = type === "online" ? Number(lawyer.consultation_price_online ?? 0) : Number(lawyer.consultation_price ?? 0);
  const today = new Date().toISOString().split("T")[0];
  const minTime = date === today
    ? new Date(Date.now() + 2 * 60 * 60 * 1000).toTimeString().slice(0, 5)
    : "08:00";

  async function book() {
    if (!date || !time) return toast.error("اختر التاريخ والوقت");
    if (userId === lawyer.id) return toast.error("لا يمكنك حجز استشارة مع نفسك");
    const scheduledDate = new Date(`${date}T${time}`);
    if (scheduledDate <= new Date()) return toast.error("يجب اختيار وقت مستقبلي");
    if (scheduledDate < new Date(Date.now() + 2 * 60 * 60 * 1000)) {
      return toast.error("يجب الحجز قبل الموعد بساعتين على الأقل");
    }
    setSaving(true);
    try {
      const { data: inserted, error } = await supabase.from("consultations").insert({
        lawyer_id: lawyer.id,
        client_id: userId,
        type,
        scheduled_at: scheduledDate.toISOString(),
        price,
        client_notes: notes || null,
        status: "pending",
      }).select("id").single();
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: lawyer.id,
        type: "consultation_booked",
        title: "حجز استشارة جديد",
        body: `${type === "online" ? "أونلاين" : "في المكتب"} — ${scheduledDate.toLocaleString("ar-EG")}`,
      });
      if (inserted?.id) {
        try {
          const { notifyConsultationBooked } = await import("@/lib/telegram-notify.functions");
          await notifyConsultationBooked({ data: { consultationId: inserted.id } }).catch(() => {});
        } catch {}

        // Deposit flow — if the lawyer requires a deposit, mark it and start Paymob checkout.
        if (lawyer.requires_deposit) {
          await supabase.from("consultations").update({ deposit_status: "required" }).eq("id", inserted.id);
          try {
            const { createPaymentIntention } = await import("@/lib/payments");
            const res = await createPaymentIntention({
              purpose: "consultation_deposit",
              consultation_id: inserted.id,
              amount: Math.max(50, Math.round(price * 0.25)),
            });
            if (res.available) {
              window.location.href = res.checkout_url;
              return;
            }
            if (res.reason === "rate_limited" || res.status === 429) {
              toast.error("حاول مرة أخرى بعد قليل");
            }
            // Gateway not configured or other error → fall through to confirmation screen.
          } catch {}
        }
      }
      setBooked(true);
    } catch (e) {
      toast.error(handleSupabaseError(e));
    } finally {
      setSaving(false);
    }
  }


  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-gold">
        {booked ? (
          <div className="text-center py-4 space-y-4">
            <div className="text-5xl">🎉</div>
            <h3 className="font-display text-2xl text-gradient-gold">تم إرسال طلبك!</h3>
            <p className="text-sm text-foreground/70 leading-relaxed">
              سيتواصل معك المحامي لتأكيد الموعد خلال 24 ساعة. تابع الاستشارة من لوحة تحكمك.
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <Link
                to="/dashboard/client/consultations"
                className="bg-gold-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-xl shadow-gold text-sm"
                onClick={onClose}>
                تابع استشاراتي
              </Link>
              <button onClick={onClose}
                className="border border-border text-foreground/70 px-4 py-2.5 rounded-xl text-sm">
                إغلاق
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="font-display text-2xl text-gradient-gold">احجز استشارة</h2>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setType("online")} className={`p-3 rounded-lg border transition ${type === "online" ? "bg-gold/15 border-gold text-gold" : "bg-elevated border-border text-foreground/70"}`}>
                أونلاين
                <div className="text-xs mt-1">{Number(lawyer.consultation_price_online ?? 0).toLocaleString()} ج</div>
              </button>
              <button onClick={() => setType("office")} className={`p-3 rounded-lg border transition ${type === "office" ? "bg-gold/15 border-gold text-gold" : "bg-elevated border-border text-foreground/70"}`}>
                في المكتب
                <div className="text-xs mt-1">{Number(lawyer.consultation_price ?? 0).toLocaleString()} ج</div>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-foreground/70 mb-1.5">التاريخ</label>
                <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-elevated border border-gold-soft/40 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-foreground/70 mb-1.5">الوقت</label>
                <input type="time" min={minTime} max="21:00" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-elevated border border-gold-soft/40 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-foreground/70 mb-1.5">ملاحظات (اختياري)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full bg-elevated border border-gold-soft/40 rounded-lg px-3 py-2 text-sm" />
            </div>

            <div className="text-center font-display text-xl text-gradient-gold">السعر: {price.toLocaleString()} ج</div>

            <div className="flex gap-2">
              <button onClick={book} disabled={saving} className="flex-1 bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-lg inline-flex items-center justify-center gap-2 disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} تأكيد الحجز
              </button>
              <button onClick={onClose} className="border border-border text-foreground/70 px-4 py-2.5 rounded-lg">إلغاء</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="bg-surface/60 border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs text-foreground/50 mb-2">
        <Icon className="h-3.5 w-3.5 text-gold" /> {label}
      </div>
      <div className="text-foreground font-semibold">{value}</div>
    </div>
  );
}
