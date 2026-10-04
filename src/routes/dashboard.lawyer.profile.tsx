import { handleSupabaseError } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Loader2, Camera, ShieldCheck, ShieldAlert, ShieldQuestion, Upload,
  Save, CreditCard, Sparkles, Building2, Smartphone, Check, Copy,
  Calendar, CheckCircle2, AlertCircle, Clock, RefreshCw, UserCheck
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/laravel";

export const Route = createFileRoute("/dashboard/lawyer/profile")({
  head: () => ({ meta: [{ title: "ملفي العام واشتراكي — الوكيل" }] }),
  component: LawyerProfile,
});

const DEFAULT_SPECS = ["قانون الأسرة والاحوال الشخصية", "القانون الجنائي", "قانون الشركات والأعمال", "العقارات والأملاك", "قانون العمل والتوظيف"];
const DEFAULT_CITIES = [
  "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية", "القليوبية",
  "كفر الشيخ", "الغربية", "المنوفية", "الفيوم", "بني سويف", "المنيا",
  "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان", "البحر الأحمر", "البحيرة",
  "الإسماعيلية", "بورسعيد", "السويس", "مطروح", "شمال سيناء", "جنوب سيناء", "الوادي الجديد"
];

function LawyerProfile() {
  const { userId } = useAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "subscription" | "verification">("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const [specsList, setSpecsList] = useState<string[]>(DEFAULT_SPECS);
  const [citiesList, setCitiesList] = useState<string[]>(DEFAULT_CITIES);
  const [f, setF] = useState({
    full_name: "", phone: "", location: "", bar_number: "", firm_name: "",
    bio: "", city: "", experience_years: "", consultation_price: "",
    consultation_price_online: "", available_online: true, available_office: true,
    requires_deposit: false,
    specializations: [] as string[],
  });
  const [lawyerData, setLawyerData] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [p, l, catRes, cityRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("lawyers").select("*").eq("id", userId).single(),
        supabase.from("categories").select("*"),
        supabase.from("cities").select("*"),
      ]);
      setLawyerData(l.data);
      setProfileData(p.data);

      const loadedCats = catRes?.data ?? [];
      if (Array.isArray(loadedCats) && loadedCats.length > 0) {
        const names: string[] = [];
        loadedCats.forEach((cat: any) => {
          if (cat.name_ar) names.push(cat.name_ar);
          if (Array.isArray(cat.children)) {
            cat.children.forEach((sub: any) => {
              if (sub.name_ar && !names.includes(sub.name_ar)) names.push(sub.name_ar);
            });
          }
        });
        if (names.length > 0) setSpecsList(names);
      }

      const loadedCities = cityRes?.data ?? [];
      if (Array.isArray(loadedCities) && loadedCities.length > 0) {
        const cNames = loadedCities.map((c: any) => c.name_ar || c.name).filter(Boolean);
        if (cNames.length > 0) setCitiesList(cNames);
      }

      setF({
        full_name: p.data?.full_name ?? "",
        phone: p.data?.phone ?? "",
        location: p.data?.location ?? "",
        bar_number: l.data?.bar_number ?? "",
        firm_name: l.data?.firm_name ?? "",
        bio: l.data?.bio ?? "",
        city: l.data?.city ?? "",
        experience_years: String(l.data?.experience_years ?? ""),
        consultation_price: String(l.data?.consultation_price ?? ""),
        consultation_price_online: String(l.data?.consultation_price_online ?? ""),
        available_online: l.data?.available_online ?? true,
        available_office: l.data?.available_office ?? true,
        requires_deposit: l.data?.requires_deposit ?? false,
        specializations: l.data?.specializations ?? [],
      });
      const stored = p.data?.avatar_url ?? null;
      if (stored && !stored.startsWith("http")) {
        const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(stored, 60 * 60 * 24 * 365);
        setAvatarUrl(signed?.signedUrl ?? null);
      } else {
        setAvatarUrl(stored);
      }
      setLoading(false);
    })();
  }, [userId]);

  async function uploadAvatar(file: File) {
    if (!userId) return;
    if (file.size > 3 * 1024 * 1024) return toast.error("الصورة يجب أن تكون أقل من 3MB");
    if (!file.type.startsWith("image/")) return toast.error("يرجى اختيار ملف صورة");
    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
      const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
      setAvatarUrl(signed?.signedUrl ?? null);
      toast.success("تم رفع الصورة بنجاح ✓");
    } catch (e) {
      toast.error(handleSupabaseError(e));
    } finally {
      setAvatarUploading(false);
    }
  }

  async function save() {
    if (!userId) return;
    setSaving(true);
    try {
      const [p, l] = await Promise.all([
        supabase.from("profiles").update({
          full_name: f.full_name, phone: f.phone, location: f.location,
        }).eq("id", userId),
        supabase.from("lawyers").update({
          bar_number: f.bar_number || null,
          firm_name: f.firm_name || null,
          bio: f.bio || null,
          city: f.city || null,
          experience_years: Number(f.experience_years) || 0,
          consultation_price: Number(f.consultation_price) || 0,
          consultation_price_online: Number(f.consultation_price_online) || 0,
          available_online: f.available_online,
          available_office: f.available_office,
          requires_deposit: f.requires_deposit,
          specializations: f.specializations,
          profile_completed: true,
        }).eq("id", userId),
      ]);
      if (p.error) throw p.error;
      if (l.error) throw l.error;
      toast.success("تم حفظ بيانات ملفك بنجاح ✓");
    } catch (e) {
      toast.error(handleSupabaseError(e));
    } finally {
      setSaving(false);
    }
  }

  function toggleSpec(s: string) {
    setF((p) => ({
      ...p,
      specializations: p.specializations.includes(s) ? p.specializations.filter((x) => x !== s) : [...p.specializations, s],
    }));
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-surface border border-border rounded-xl animate-pulse" />
          <div className="h-3 w-64 bg-surface border border-border rounded-xl animate-pulse" />
        </div>
        <div className="flex items-center gap-6 bg-surface border border-border rounded-2xl p-6 animate-pulse">
          <div className="h-20 w-20 rounded-2xl bg-elevated shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-1/2 bg-elevated rounded" />
            <div className="h-3 w-1/3 bg-elevated rounded" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-4 animate-pulse space-y-2">
              <div className="h-3 w-1/3 bg-elevated rounded" />
              <div className="h-9 w-full bg-elevated rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header with Title and Primary Save Button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-gradient-gold font-bold">ملفي العام واشتراكي</h1>
          <p className="text-foreground/60 text-sm mt-1">إدارة بيانات ملفك العام، التوثيق، وباقة اشتراكك في المنصة</p>
        </div>

        {activeTab === "profile" && (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-gold-gradient text-primary-foreground font-bold px-6 py-2.5 rounded-xl shadow-gold hover:opacity-95 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
          </button>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex gap-2 p-1.5 bg-surface border border-gold-soft/30 rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 ${
            activeTab === "profile"
              ? "bg-gold text-primary-foreground shadow-gold"
              : "text-foreground/70 hover:text-foreground hover:bg-elevated/50"
          }`}
        >
          <UserCheck className="h-4 w-4" /> الملف الشخصي والمهني
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("subscription")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 ${
            activeTab === "subscription"
              ? "bg-gold text-primary-foreground shadow-gold"
              : "text-foreground/70 hover:text-foreground hover:bg-elevated/50"
          }`}
        >
          <CreditCard className="h-4 w-4" /> باقة الاشتراك والترقية
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("verification")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 ${
            activeTab === "verification"
              ? "bg-gold text-primary-foreground shadow-gold"
              : "text-foreground/70 hover:text-foreground hover:bg-elevated/50"
          }`}
        >
          <ShieldCheck className="h-4 w-4" /> توثيق الحساب
        </button>
      </div>

      {/* TAB 1: Profile Tab */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          {lawyerData?.approval_status === "pending" && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
              <span className="text-xl">⏳</span>
              <div>
                <div className="font-semibold text-yellow-400">ملفك قيد المراجعة</div>
                <div className="text-sm text-foreground/60 mt-0.5">
                  سيظهر ملفك في السوق القانوني بعد موافقة الفريق. عادةً خلال 24-48 ساعة.
                </div>
              </div>
            </div>
          )}

          {lawyerData?.approval_status === "rejected" && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <div className="font-semibold text-red-400">⚠️ لم يتم اعتماد ملفك</div>
              {lawyerData?.rejection_reason && (
                <div className="text-sm text-foreground/60 mt-1">السبب: {lawyerData.rejection_reason}</div>
              )}
              <div className="text-sm text-foreground/60 mt-1">تواصل معنا لمراجعة طلبك.</div>
            </div>
          )}

          {/* Avatar Card */}
          <div className="flex items-center gap-6 bg-surface border border-gold-soft/40 rounded-2xl p-6">
            <div className="relative shrink-0">
              <div className="h-20 w-20 rounded-2xl overflow-hidden bg-gold-gradient flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="صورتي" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display text-3xl font-bold text-primary-foreground">
                    {f.full_name?.[0] ?? "م"}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarRef.current?.click()}
                disabled={avatarUploading}
                className="absolute -bottom-1 -left-1 h-7 w-7 bg-gold rounded-full flex items-center justify-center shadow-gold hover:scale-110 transition disabled:opacity-50"
                title="تغيير الصورة"
              >
                {avatarUploading ? (
                  <Loader2 className="h-3.5 w-3.5 text-primary-foreground animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5 text-primary-foreground" />
                )}
              </button>
              <input
                ref={avatarRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAvatar(file);
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="font-display text-xl text-foreground truncate">{f.full_name || "اسمك"}</div>
              <div className="text-sm text-gold/80 mt-0.5 truncate">{f.firm_name || "محامٍ"}</div>
              <div className="text-xs text-foreground/50 mt-2">انقر الكاميرا لتغيير الصورة الشخصية (JPG/PNG حتى 3MB)</div>
            </div>
          </div>

          {/* Form Fields Card */}
          <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="الاسم الكامل *" v={f.full_name} on={(v) => setF({ ...f, full_name: v })} />
              <Input label="رقم الهاتف" v={f.phone} on={(v) => setF({ ...f, phone: v })} />
              <div>
                <label className="block text-xs text-foreground/70 mb-1.5">المحافظة / المدينة</label>
                <select
                  value={f.city || f.location}
                  onChange={(e) => setF({ ...f, city: e.target.value, location: e.target.value })}
                  style={{ colorScheme: "dark" }}
                  className="w-full bg-[#121927] text-foreground border border-gold-soft/40 focus:border-gold rounded-lg px-3 py-2.5 outline-none text-sm cursor-pointer shadow-sm"
                >
                  <option value="" className="bg-[#121927] text-foreground/70">— اختر المحافظة —</option>
                  {citiesList.map((c) => (
                    <option key={c} value={c} className="bg-[#121927] text-foreground py-1">{c}</option>
                  ))}
                </select>
              </div>
              <Input label="رقم قيد النقابة" v={f.bar_number} on={(v) => setF({ ...f, bar_number: v })} />
              <Input label="اسم المكتب / الشركة القانونية" v={f.firm_name} on={(v) => setF({ ...f, firm_name: v })} />
              <Input label="سنوات الخبرة" type="number" v={f.experience_years} on={(v) => setF({ ...f, experience_years: v })} />
            </div>

            <div>
              <label className="block text-xs text-foreground/70 mb-1.5">نبذة مهنية عنك</label>
              <textarea
                value={f.bio}
                onChange={(e) => setF({ ...f, bio: e.target.value })}
                rows={4}
                maxLength={500}
                placeholder="اكتب نبذة مختصرة عن مؤهلاتك وخبراتك القضائية..."
                className="w-full bg-elevated border border-gold-soft/40 rounded-lg px-3 py-2.5 text-foreground placeholder:text-foreground/40 outline-none focus:border-gold"
              />
            </div>

            <div>
              <label className="block text-xs text-foreground/70 mb-2">التخصصات القانونية</label>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 bg-elevated/40 border border-gold-soft/30 rounded-lg">
                {specsList.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSpec(s)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${
                      f.specializations.includes(s)
                        ? "bg-gold text-primary-foreground border-gold font-bold shadow-sm"
                        : "bg-surface/60 border-gold-soft/40 text-foreground/70 hover:border-gold/60"
                    }`}
                  >
                    {f.specializations.includes(s) ? "✓ " : ""}{s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="سعر استشارة أونلاين (ج.م)" type="number" v={f.consultation_price_online} on={(v) => setF({ ...f, consultation_price_online: v })} />
              <Input label="سعر استشارة في المكتب (ج.م)" type="number" v={f.consultation_price} on={(v) => setF({ ...f, consultation_price: v })} />
            </div>

            <div className="flex flex-wrap gap-3">
              <Toggle label="متاح للاستشارات أونلاين" v={f.available_online} on={(v) => setF({ ...f, available_online: v })} />
              <Toggle label="متاح للاستشارات في المكتب" v={f.available_office} on={(v) => setF({ ...f, available_office: v })} />
              <Toggle label="طلب عربون لتأكيد الاستشارات (25%)" v={f.requires_deposit} on={(v) => setF({ ...f, requires_deposit: v })} />
            </div>

            {userId && (
              <div className="bg-elevated border border-gold-soft/30 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">رابط ملفك العام</div>
                  <div className="text-xs text-foreground/50 mt-0.5 font-mono truncate max-w-[200px] sm:max-w-xs">
                    {typeof window !== "undefined" ? window.location.origin : ""}/lawyers/{userId}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/lawyers/${userId}`);
                      toast.success("تم نسخ الرابط ✓");
                    }}
                    className="text-xs text-gold border border-gold/40 px-3 py-1.5 rounded-lg hover:bg-gold/10 transition"
                  >
                    📋 نسخ الرابط
                  </button>
                  <a
                    href={`/lawyers/${userId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-foreground/70 border border-border px-3 py-1.5 rounded-lg hover:border-gold/40 hover:text-gold transition"
                  >
                    معاينة الصفحة ←
                  </a>
                </div>
              </div>
            )}

            {/* Bottom Save Action Bar */}
            <div className="flex items-center justify-between pt-5 border-t border-gold-soft/20">
              <span className="text-xs text-foreground/50">تأكد من صحة بياناتك قبل النقر على حفظ التعديلات</span>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-gold-gradient text-primary-foreground font-bold px-8 py-3 rounded-xl shadow-gold hover:opacity-95 transition disabled:opacity-50 text-sm"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Lawyer Subscription & Upgrade Request */}
      {activeTab === "subscription" && (
        <LawyerSubscriptionSection profile={profileData} userId={userId} />
      )}

      {/* TAB 3: Verification Tab */}
      {activeTab === "verification" && (
        <VerificationCard userId={userId} verified={!!lawyerData?.verified} />
      )}
    </div>
  );
}

function LawyerSubscriptionSection({ profile, userId }: { profile: any; userId: string | null }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [selectedMethod, setSelectedMethod] = useState<any>(null);
  const [reference, setReference] = useState("");
  const [clientMessage, setClientMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const DEFAULT_PLANS = [
    {
      id: "pro",
      name: "Professional Lawyer (المحامي المستقل)",
      price: 49.99,
      currency: "EGP",
      billing_interval: "monthly",
      description: "باقة متكاملة للمحامي المستقل مع مساعد الذكاء الاصطناعي وإدارة غير محدودة للقضايا والظهور في الدليل العام.",
      features: [
        "إدارة غير محدودة للقضايا والآجال والمهام",
        "مساعد الذكاء الاصطناعي القانوني 500 استعلام/شهر",
        "إصدار الفواتير وتسجيل المصروفات والمدفوعات",
        "الظهور المميز في دليل المحامين وتلقي طلبات الموكلين",
        "تتبع الوقت وإنتاجية العمل",
      ],
    },
    {
      id: "enterprise",
      name: "Firm Enterprise (مكتب المحاماة)",
      price: 199.99,
      currency: "EGP",
      billing_interval: "monthly",
      description: "حل متقدم وشامل لمكاتب وشركات المحاماة مع ميزات إدارة الفريق والصلاحيات المتقدمة والذكاء الاصطناعي غير المحدود.",
      features: [
        "كل مزايا باقة المحامي المستقل",
        "إضافة أعضاء الفريق وإدارة الصلاحيات",
        "استعلامات ذكاء اصطناعي موسعة (2,500 استعلام/شهر)",
        "تقارير وإحصائيات أداء الفريق والمكتب",
        "دعم فني مخصص وأولوية في معالجة الطلبات",
      ],
    },
  ];

  const DEFAULT_PAYMENT_METHODS = [
    {
      id: 1,
      key: "instapay",
      name_ar: "إنستاباي (InstaPay)",
      type: "instapay",
      account_number: "lawfirm@instapay",
      account_name: "مكتب المحاماة الرقمي",
      instructions: "قم بالتحويل عبر تطبيق إنستاباي إلى العنوان أعلاه ثم اكتب رقم العملية.",
    },
    {
      id: 2,
      key: "vodafone_cash",
      name_ar: "فودافون كاش / المحافظ الإلكترونية",
      type: "wallet",
      account_number: "01000000000",
      account_name: "المحفظة الإلكترونية للمنصة",
      instructions: "حول قيمة الاشتراك إلى رقم المحفظة وأدخل رقم العملية أو هاتف التحويل.",
    },
    {
      id: 3,
      key: "cib_bank",
      name_ar: "تحويل بنكي (CIB)",
      type: "bank",
      bank_name: "البنك التجاري الدولي (CIB)",
      account_number: "100045892301",
      iban: "EG50001000045892301000000000",
      account_name: "شركة المحاماة والخدمات القانونية",
      instructions: "تحويل مباشر لحساب البنك التجاري الدولي مع إرفاق رقم الحوالة.",
    },
  ];

  const fetchRequests = async () => {
    try {
      const res = await supabase.from("plan_payment_requests").select("*");
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch {
      setRequests([]);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [plansRes, methodsRes] = await Promise.all([
          supabase.from("subscription_plans").select("*"),
          apiFetch("/payment-methods").catch(() => null),
        ]);

        const loadedPlans = Array.isArray(plansRes.data) && plansRes.data.length > 0 ? plansRes.data : DEFAULT_PLANS;
        setPlans(loadedPlans);
        setSelectedPlan(loadedPlans[0]);

        const loadedMethods = Array.isArray(methodsRes?.data) && methodsRes.data.length > 0
          ? methodsRes.data
          : Array.isArray(methodsRes) && methodsRes.length > 0
          ? methodsRes
          : DEFAULT_PAYMENT_METHODS;
        setMethods(loadedMethods);
        setSelectedMethod(loadedMethods[0]);

        await fetchRequests();
      } catch (err) {
        setPlans(DEFAULT_PLANS);
        setSelectedPlan(DEFAULT_PLANS[0]);
        setMethods(DEFAULT_PAYMENT_METHODS);
        setSelectedMethod(DEFAULT_PAYMENT_METHODS[0]);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const copyText = (txt: string, key: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedKey(key);
    toast.success("تم النسخ بنجاح ✓");
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSubmitRequest = async () => {
    if (!userId) return;
    if (!selectedPlan) {
      toast.error("يرجى اختيار الباقة المراد الاشتراك بها");
      return;
    }
    if (!reference.trim()) {
      toast.error("يرجى إدخال رقم العملية / مرجع التحويل للتأكيد");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        subscription_plan_id: selectedPlan.id,
        plan_id: selectedPlan.id,
        payment_method_id: selectedMethod?.id || null,
        payment_method_key: selectedMethod?.key || selectedMethod?.type || "bank",
        payment_method_name: selectedMethod?.name_ar || selectedMethod?.name || "تحويل بنكي",
        payment_method: selectedMethod?.name_ar || selectedMethod?.key || "bank",
        amount: Number(selectedPlan.price) || 0,
        currency: selectedPlan.currency || "EGP",
        transaction_reference: reference.trim(),
        client_message: clientMessage.trim(),
        notes: clientMessage.trim(),
      };

      const res = await supabase.from("plan_payment_requests").insert(payload);
      if (res.error) throw res.error;

      toast.success("تم إرسال طلب الاشتراك بنجاح! سيتم مراجعة التحويل وتفعيل الباقة فوراً.");
      setReference("");
      setClientMessage("");
      await fetchRequests();
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ أثناء إرسال طلب الاشتراك");
    } finally {
      setSubmitting(false);
    }
  };

  const currentPlan = profile?.plan || "free";
  const hasExpiry = profile?.plan_expires_at;
  const isPaid = currentPlan !== "free" && currentPlan !== null;

  return (
    <div className="space-y-6">
      {/* Current Subscription Status Banner */}
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-gold/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-foreground/60">
              <CreditCard className="h-4 w-4 text-gold" /> حالتك الحالية
            </div>
            <div className="font-display text-2xl font-bold text-foreground flex items-center gap-3">
              <span>الباقة: {currentPlan === "free" ? "الفترة التجريبية (مجانية)" : currentPlan}</span>
              {isPaid ? (
                <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/30 px-3 py-1 rounded-full font-sans">
                  اشتراك نشط ✓
                </span>
              ) : (
                <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full font-sans">
                  فترة تجريبية
                </span>
              )}
            </div>
            <p className="text-xs text-foreground/60 mt-1">
              {hasExpiry
                ? `ينتهي اشتراكك في: ${new Date(profile.plan_expires_at).toLocaleDateString("ar-EG")}`
                : "يمكنك ترقية اشتراكك في أي وقت لتفعيل كافة مزايا المنصة والذكاء الاصطناعي."}
            </p>
          </div>

          <div className="text-left">
            <span className="inline-flex items-center gap-1.5 text-xs text-gold bg-gold/10 border border-gold/30 px-3.5 py-2 rounded-xl">
              <Sparkles className="h-4 w-4" /> وصول كامل للمنصة
            </span>
          </div>
        </div>
      </div>

      {/* Available Plans Section */}
      <div className="space-y-3">
        <div>
          <h2 className="font-display text-xl text-gradient-gold font-bold">باقات الاشتراك المتاحة</h2>
          <p className="text-foreground/60 text-xs mt-0.5">اختر الباقة المناسبة لمكتبك لتقديم طلب التفعيل أو التجديد</p>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="h-64 bg-surface border border-border rounded-2xl animate-pulse" />
            <div className="h-64 bg-surface border border-border rounded-2xl animate-pulse" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {plans.map((p) => {
              const isSelected = selectedPlan?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlan(p)}
                  className={`bg-surface border rounded-2xl p-6 cursor-pointer transition relative flex flex-col justify-between ${
                    isSelected
                      ? "border-gold shadow-gold bg-gradient-to-b from-surface to-gold/5"
                      : "border-gold-soft/30 hover:border-gold/60"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-4 left-4 bg-gold text-primary-foreground text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> مختارة
                    </div>
                  )}

                  <div>
                    <h3 className="font-display text-lg font-bold text-foreground">{p.name}</h3>
                    <p className="text-xs text-foreground/60 mt-1 line-clamp-2">{p.description}</p>

                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="font-display text-3xl font-bold text-gold">
                        {Math.round(Number(p.price))}
                      </span>
                      <span className="text-xs text-foreground/60 font-sans">
                        {p.currency || "ج.م"} / {p.billing_interval === "yearly" ? "سنوياً" : "شهرياً"}
                      </span>
                    </div>

                    <ul className="mt-4 space-y-2 border-t border-gold-soft/20 pt-4">
                      {(p.features || [
                        "إدارة القضايا والآجال",
                        "مساعد الذكاء الاصطناعي القانوني",
                        "إصدار الفواتير والأتعاب",
                        "الظهور في دليل المحامين",
                      ]).map((feat: string, i: number) => (
                        <li key={i} className="text-xs text-foreground/80 flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-gold shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPlan(p);
                    }}
                    className={`mt-6 w-full py-2.5 rounded-xl font-bold text-xs transition ${
                      isSelected
                        ? "bg-gold text-primary-foreground shadow-gold"
                        : "border border-gold/40 text-gold hover:bg-gold/10"
                    }`}
                  >
                    {isSelected ? "الباقة المختارة للتسديد" : "اختيار هذه الباقة"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment Channels & Request Submission */}
      {selectedPlan && (
        <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="font-display text-lg text-gradient-gold font-bold">طرق السداد وتحويل الاشتراك</h2>
            <p className="text-foreground/60 text-xs mt-0.5">
              قم بالتحويل عبر إحدى الطرق التالية بقيمة ({Math.round(Number(selectedPlan.price))} {selectedPlan.currency || "ج.م"}) ثم سجل رقم العملية
            </p>
          </div>

          {/* Payment Method Selector */}
          <div className="grid sm:grid-cols-3 gap-3">
            {methods.map((m) => {
              const active = selectedMethod?.id === m.id || selectedMethod?.key === m.key;
              return (
                <button
                  key={m.id || m.key}
                  type="button"
                  onClick={() => setSelectedMethod(m)}
                  className={`p-3.5 rounded-xl border text-right transition flex flex-col justify-between ${
                    active
                      ? "border-gold bg-gold/10 text-foreground"
                      : "border-gold-soft/30 bg-elevated hover:border-gold/50 text-foreground/70"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-foreground">{m.name_ar || m.name}</span>
                    {m.type === "instapay" ? (
                      <Sparkles className="h-4 w-4 text-amber-400" />
                    ) : m.type === "wallet" ? (
                      <Smartphone className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Building2 className="h-4 w-4 text-blue-400" />
                    )}
                  </div>
                  <span className="text-[11px] text-foreground/50 truncate">
                    {m.account_number || m.iban || "تحويل رسمي"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Channel Details Card */}
          {selectedMethod && (
            <div className="bg-elevated border border-gold-soft/30 rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-gold">بيانات التحويل لطريقة: {selectedMethod.name_ar || selectedMethod.name}</div>

              {selectedMethod.bank_name && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-foreground/60">اسم البنك:</span>
                  <span className="font-bold text-foreground">{selectedMethod.bank_name}</span>
                </div>
              )}

              {selectedMethod.account_name && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-foreground/60">اسم الحساب المستفيد:</span>
                  <span className="font-bold text-foreground">{selectedMethod.account_name}</span>
                </div>
              )}

              {selectedMethod.account_number && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-foreground/60">رقم الحساب / المحفظة / العنوان:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">{selectedMethod.account_number}</span>
                    <button
                      type="button"
                      onClick={() => copyText(selectedMethod.account_number, "acc")}
                      className="p-1 hover:text-gold transition text-foreground/60"
                      title="نسخ"
                    >
                      {copiedKey === "acc" ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {selectedMethod.iban && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-foreground/60">رقم الآيبان (IBAN):</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-foreground">{selectedMethod.iban}</span>
                    <button
                      type="button"
                      onClick={() => copyText(selectedMethod.iban, "iban")}
                      className="p-1 hover:text-gold transition text-foreground/60"
                      title="نسخ"
                    >
                      {copiedKey === "iban" ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {selectedMethod.instructions && (
                <p className="text-[11px] text-foreground/50 border-t border-gold-soft/10 pt-2">
                  ℹ️ {selectedMethod.instructions}
                </p>
              )}
            </div>
          )}

          {/* Form to submit request */}
          <div className="space-y-4 border-t border-gold-soft/20 pt-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-foreground/70 mb-1.5">
                  رقم عملية التحويل / كود الحوالة أو هاتف الدفع *
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="مثال: TXN-8941032 أو رقم الهاتف المحول منه"
                  className="w-full bg-elevated border border-gold-soft/40 focus:border-gold rounded-lg px-3 py-2.5 text-foreground placeholder:text-foreground/40 outline-none text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-foreground/70 mb-1.5">
                  ملاحظات إضافية (اختياري)
                </label>
                <input
                  type="text"
                  value={clientMessage}
                  onChange={(e) => setClientMessage(e.target.value)}
                  placeholder="أي ملاحظات تخص السداد أو تفعيل الفرع..."
                  className="w-full bg-elevated border border-gold-soft/40 focus:border-gold rounded-lg px-3 py-2.5 text-foreground placeholder:text-foreground/40 outline-none text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-foreground/50">
                سيتم تفعيل الباقة ومميزات الذكاء الاصطناعي فور تأكيد التحويل.
              </span>
              <button
                type="button"
                onClick={handleSubmitRequest}
                disabled={submitting || !reference.trim()}
                className="inline-flex items-center gap-2 bg-gold-gradient text-primary-foreground font-bold px-7 py-2.5 rounded-xl shadow-gold hover:opacity-95 transition disabled:opacity-50 text-sm"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendRequestIcon className="h-4 w-4" />}
                {submitting ? "جاري الإرسال..." : "إرسال طلب التفعيل"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requests History List */}
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-foreground">سجل طلبات الاشتراك والترقية السابقة</h3>
          <button
            type="button"
            onClick={fetchRequests}
            className="text-xs text-gold hover:underline inline-flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" /> تحديث
          </button>
        </div>

        {requests.length === 0 ? (
          <div className="text-xs text-foreground/50 text-center py-6 border border-dashed border-border rounded-xl">
            لا توجد طلبات اشتراك مسجلة حالياً
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map((r, i) => (
              <div
                key={r.id || i}
                className="bg-elevated/70 border border-gold-soft/20 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-foreground">
                    طلب باقة: {r.payment_method_name || r.payment_method || "اشتراك"} • {Math.round(Number(r.amount || 0))} {r.currency || "EGP"}
                  </div>
                  <div className="text-[11px] text-foreground/50 font-mono">
                    المرجع: {r.transaction_reference || "—"} • {new Date(r.created_at || Date.now()).toLocaleDateString("ar-EG")}
                  </div>
                </div>

                <div>
                  {r.status === "approved" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-green-400 bg-green-500/10 border border-green-500/30 px-2.5 py-1 rounded-full font-sans">
                      <CheckCircle2 className="h-3 w-3" /> معتمد ومفعل
                    </span>
                  ) : r.status === "rejected" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 px-2.5 py-1 rounded-full font-sans">
                      <AlertCircle className="h-3 w-3" /> مرفوض
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full font-sans">
                      <Clock className="h-3 w-3" /> قيد المراجعة
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SendRequestIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function VerificationCard({ userId, verified }: { userId: string | null; verified: boolean }) {
  const [status, setStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const [notes, setNotes] = useState<string | null>(null);
  const [uploading, setUploading] = useState<null | "bar" | "id">(null);
  const [submitting, setSubmitting] = useState(false);
  const [barDoc, setBarDoc] = useState<string | null>(null);
  const [idDoc, setIdDoc] = useState<string | null>(null);
  const [barNumber, setBarNumber] = useState("");
  const barRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from("lawyer_verification_requests")
        .select("status, notes, bar_document_url, id_document_url, bar_number")
        .eq("lawyer_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setStatus(data.status as typeof status);
        setNotes(data.notes ?? null);
        setBarDoc(data.bar_document_url ?? null);
        setIdDoc(data.id_document_url ?? null);
        setBarNumber(data.bar_number ?? "");
      }
    })();
  }, [userId]);

  async function upload(kind: "bar" | "id", file: File) {
    if (!userId) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("الملف يجب أن يكون أقل من 5MB");
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop() ?? "pdf";
      const path = `${userId}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("verification-docs").upload(path, file, { upsert: true });
      if (error) throw error;
      if (kind === "bar") setBarDoc(path);
      else setIdDoc(path);
      toast.success("تم رفع المستند بنجاح ✓");
    } catch (e) {
      toast.error(handleSupabaseError(e));
    } finally {
      setUploading(null);
    }
  }

  async function submitRequest() {
    if (!userId) return;
    if (!barDoc || !idDoc) return toast.error("ارفع كلا المستندين أولاً");
    if (!barNumber.trim()) return toast.error("أدخل رقم قيد النقابة");
    setSubmitting(true);
    const { error } = await supabase.from("lawyer_verification_requests").insert({
      lawyer_id: userId,
      bar_number: barNumber.trim(),
      bar_document_url: barDoc,
      id_document_url: idDoc,
      status: "pending",
    });
    setSubmitting(false);
    if (error) return toast.error(handleSupabaseError(error));
    setStatus("pending");
    toast.success("تم إرسال طلب التوثيق — سيراجعه الفريق قريباً");
  }

  if (!userId) return null;

  return (
    <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-gradient-gold">توثيق الحساب المهني</h2>
          <p className="text-xs text-foreground/60 mt-1">ارفع مستنداتك الرسمية ليراجعها الفريق وتظهر شارة التوثيق المعتمدة على ملفك.</p>
        </div>
        {verified ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-500/10 border border-green-500/30 px-3 py-1.5 rounded-full">
            <ShieldCheck className="h-4 w-4" /> موثّق رسمياً
          </span>
        ) : status === "pending" ? (
          <span className="inline-flex items-center gap-1 text-xs text-gold bg-gold/10 border border-gold/30 px-3 py-1.5 rounded-full">
            <ShieldQuestion className="h-4 w-4" /> قيد المراجعة
          </span>
        ) : status === "rejected" ? (
          <span className="inline-flex items-center gap-1 text-xs text-destructive bg-destructive/10 border border-destructive/30 px-3 py-1.5 rounded-full">
            <ShieldAlert className="h-4 w-4" /> مرفوض
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-foreground/60 border border-border px-3 py-1.5 rounded-full">
            غير موثّق
          </span>
        )}
      </div>

      {status === "rejected" && notes && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
          السبب: {notes}
        </div>
      )}

      {(status === "none" || status === "rejected") && !verified && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-foreground/70 mb-1.5">رقم القيد بالنقابة *</label>
            <input
              value={barNumber}
              onChange={(e) => setBarNumber(e.target.value)}
              placeholder="أدخل رقم القيد بنقابة المحامين"
              className="w-full bg-elevated border border-gold-soft/40 focus:border-gold rounded-lg px-3 py-2.5 text-foreground outline-none text-sm"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <FileSlot label="صورة كارنيه النقابة" file={barDoc} onPick={() => barRef.current?.click()} uploading={uploading === "bar"} />
            <FileSlot label="صورة بطاقة الرقم القومي" file={idDoc} onPick={() => idRef.current?.click()} uploading={uploading === "id"} />
          </div>
          <input
            ref={barRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload("bar", file);
            }}
          />
          <input
            ref={idRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload("id", file);
            }}
          />
          <button
            type="button"
            onClick={submitRequest}
            disabled={submitting || !barDoc || !idDoc}
            className="bg-gold-gradient text-primary-foreground font-bold px-6 py-2.5 rounded-xl inline-flex items-center gap-2 disabled:opacity-50 text-sm shadow-gold"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} إرسال طلب التوثيق للمراجعة
          </button>
        </div>
      )}

      {status === "pending" && (
        <p className="text-sm text-foreground/70 bg-gold/5 border border-gold/20 rounded-lg p-3">
          تم استلام مستنداتك بنجاح. سيقوم فريق الإدارة بمراجعتها وتدقيق القيد خلال 24-48 ساعة وستُخطَر بالنتيجة.
        </p>
      )}
    </div>
  );
}

function FileSlot({ label, file, onPick, uploading }: { label: string; file: string | null; onPick: () => void; uploading: boolean }) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={uploading}
      className={`w-full text-right px-4 py-3 rounded-lg border transition ${
        file ? "border-green-500/40 bg-green-500/5" : "border-gold-soft/40 bg-elevated hover:border-gold"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-foreground">{label}</span>
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-gold" />
        ) : file ? (
          <ShieldCheck className="h-4 w-4 text-green-500" />
        ) : (
          <Upload className="h-4 w-4 text-gold" />
        )}
      </div>
      <div className="text-xs text-foreground/50 mt-1">{file ? "تم الرفع بنجاح ✓" : "PDF أو صورة (حتى 5MB)"}</div>
    </button>
  );
}

function Input({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs text-foreground/70 mb-1.5">{label}</label>
      <input
        type={type}
        value={v}
        onChange={(e) => on(e.target.value)}
        className="w-full bg-elevated border border-gold-soft/40 focus:border-gold rounded-lg px-3 py-2.5 text-foreground outline-none text-sm"
      />
    </div>
  );
}

function Toggle({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => on(!v)}
      className={`px-4 py-2 rounded-lg border text-xs sm:text-sm font-medium transition ${
        v ? "bg-gold/15 border-gold text-gold" : "bg-surface/60 border-gold-soft/40 text-foreground/60"
      }`}
    >
      {v ? "✓" : "○"} {label}
    </button>
  );
}
