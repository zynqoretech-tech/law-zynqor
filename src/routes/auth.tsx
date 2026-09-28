import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowRight, User, Scale, Loader2, Lock } from "lucide-react";
import logo from "@/assets/alwakeel-logo.jpeg";
import { signIn, signUp, resetPassword } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { translateAuthError } from "@/lib/translate-error";
import { getAuthIntent, clearAuthIntent } from "@/lib/auth-intent";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    returnUrl: typeof search.returnUrl === "string" ? (search.returnUrl as string) : undefined,
    invite: typeof search.invite === "string" ? (search.invite as string) : undefined,
    type: typeof search.type === "string" ? (search.type as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "سجّل الآن — الوكيل" },
      { name: "description", content: "أنشئ حسابك في الوكيل كموكّل أو كمحامي وابدأ رحلتك القانونية." },
    ],
  }),
  component: Auth,
});

function Auth() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const returnUrl = (search as { returnUrl?: string })?.returnUrl;
  const invite = (search as { invite?: string })?.invite;
  const inviteType = (search as { type?: string })?.type;

  const { isAuthed, loading: authChecking, profile } = useAuth();

  // Guest Middleware: If user is authenticated, redirect away from guest /auth route
  useEffect(() => {
    if (authChecking) return;
    if (isAuthed && profile) {
      const intent = getAuthIntent();
      const rawTarget = intent?.returnUrl || returnUrl;
      const target = rawTarget && !rawTarget.startsWith("/auth") ? rawTarget : null;
      if (target) {
        clearAuthIntent();
        navigate({ to: target as any });
      } else {
        const dest = profile.role === "admin"
          ? "/dashboard/admin"
          : profile.role === "lawyer"
          ? "/dashboard/lawyer"
          : "/dashboard/client";
        navigate({ to: dest, replace: true });
      }
    }
  }, [authChecking, isAuthed, profile, navigate, returnUrl]);

  async function linkInvite(uid: string) {
    if (!invite || inviteType !== "manual_client" || !uid) return;
    try {
      const { data, error } = await supabase
        .from("manual_clients")
        .update({ platform_user_id: uid })
        .eq("id", invite)
        .is("platform_user_id", null)
        .select("id");
      const { toast } = await import("sonner");
      if (error) {
        toast.error("تعذّر ربط الدعوة — تأكّد أن البريد المسجّل هو نفس البريد الذي دعاك به المحامي");
        return;
      }
      if (!data || data.length === 0) {
        toast.error("لم يتم ربط الدعوة: البريد الإلكتروني لحسابك لا يطابق البريد الذي أدخله المحامي في بيانات الدعوة");
        return;
      }
      toast.success("🎉 تم ربط حسابك بقضاياك الموجودة");
    } catch {/* ignore */ }
  }
  const [mode, setMode] = useState<"signup" | "login" | "reset">("signup");
  const [role, setRole] = useState<"client" | "lawyer">("client");
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    location: "",
    bar_number: "",
    firm_name: "",
    specializations: "",
  });
  const [agree, setAgree] = useState(false);
  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));


  const DEFAULT_CITIES = [
    "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية", "القليوبية",
    "كفر الشيخ", "الغربية", "المنوفية", "الفيوم", "بني سويف", "المنيا",
    "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان", "البحر الأحمر", "البحيرة",
    "الإسماعيلية", "بورسعيد", "السويس", "مطروح", "شمال سيناء", "جنوب سيناء", "الوادي الجديد"
  ];
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [citiesList, setCitiesList] = useState<string[]>(DEFAULT_CITIES);
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [catRes, cityRes] = await Promise.all([
          supabase.from("categories").select("*"),
          supabase.from("cities").select("*"),
        ]);
        const list = catRes?.data ?? [];
        if (Array.isArray(list) && list.length > 0) {
          const names: string[] = [];
          list.forEach((cat: any) => {
            if (cat.name_ar) names.push(cat.name_ar);
            if (Array.isArray(cat.children)) {
              cat.children.forEach((sub: any) => {
                if (sub.name_ar && !names.includes(sub.name_ar)) names.push(sub.name_ar);
              });
            }
          });
          setCategoriesList(names);
        }
        const rawCities = cityRes?.data ?? cityRes ?? [];
        const loadedCities = Array.isArray(rawCities)
          ? rawCities
          : Array.isArray((rawCities as any)?.data)
          ? (rawCities as any).data
          : [];
        if (loadedCities.length > 0) {
          const cNames = loadedCities
            .map((c: any) => (typeof c === "string" ? c : c.name_ar || c.name || c.name_en))
            .filter(Boolean);
          if (cNames.length > 0) setCitiesList(cNames);
        }
      } catch {/* ignore */}
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const { user } = await signIn(form.email, form.password);
        if (user?.id) await linkInvite(user.id);
        const { determineUserRole } = await import("@/lib/laravel");
        const userRole = determineUserRole(user);

        const intent = getAuthIntent();
        const rawTarget = intent?.returnUrl || returnUrl;
        const target = rawTarget && !rawTarget.startsWith("/auth") ? rawTarget : null;
        if (target) {
          clearAuthIntent();
          navigate({ to: target as any });
        } else {
          const dest = userRole === "admin"
            ? "/dashboard/admin"
            : userRole === "lawyer"
            ? "/dashboard/lawyer"
            : "/dashboard/client";
          navigate({ to: dest, replace: true });
        }
      } else if (mode === "reset") {
        await resetPassword(form.email);
        setInfo("تم إرسال رابط استعادة كلمة المرور إلى بريدك.");
      } else {
        if (!agree) {
          throw new Error("يجب الموافقة على شروط الاستخدام وسياسة الخصوصية قبل إنشاء الحساب.");
        }
        const finalSpecs = selectedSpecs.length > 0 
          ? selectedSpecs 
          : (form.specializations ? form.specializations.split(",").map((s) => s.trim()).filter(Boolean) : []);

        const result = await signUp({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          phone: form.phone,
          location: form.location,
          role,
          bar_number: role === "lawyer" ? form.bar_number : undefined,
          firm_name: role === "lawyer" ? form.firm_name : undefined,
          specializations: role === "lawyer" ? finalSpecs : undefined,
        });
        if (result?.user?.id) await linkInvite(result.user.id);
        if (result?.session && result.user?.id) {
          await supabase
            .from("profiles")
            .update({ terms_accepted_at: new Date().toISOString() } as never)
            .eq("id", result.user.id);
        }

        // Auto-confirm is enabled — a session is returned immediately. Navigate straight to dashboard.
        if (result?.session) {
          const intent = getAuthIntent();
          const target = intent?.returnUrl || returnUrl;
          if (target) { clearAuthIntent(); navigate({ to: target }); }
          else navigate({ to: role === "lawyer" ? "/dashboard/lawyer" : "/dashboard/client" });
        } else {
          setInfo("🎉 تم إنشاء حسابك! سجّل دخولك للمتابعة.");
          setMode("login");
        }
      }
    } catch (err) {
      setError(translateAuthError((err as Error).message || "حدث خطأ، حاول مرة أخرى."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen islamic-pattern flex flex-col">
      <header className="border-b border-gold-soft/40 bg-overlay/60 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="الوكيل" className="h-10 w-10 rounded-lg object-cover ring-1 ring-gold/40" />
            <div className="font-display text-xl text-gradient-gold font-bold">الوكيل</div>
          </Link>
          <Link to="/" className="text-sm text-foreground/70 hover:text-gold inline-flex items-center gap-2">
            العودة <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-surface border border-gold-soft/40 rounded-2xl p-6 sm:p-8 shadow-gold">
          <div className="text-center mb-6">
            <img src={logo} alt="الوكيل" className="h-14 w-14 mx-auto rounded-xl object-cover ring-1 ring-gold/40 mb-4" />
            <h1 className="font-display text-2xl sm:text-3xl text-gradient-gold font-bold">
              {mode === "signup" ? "إنشاء حساب" : mode === "login" ? "تسجيل الدخول" : "استعادة كلمة المرور"}
            </h1>
            <p className="text-xs sm:text-sm text-foreground/60 mt-2">— والله خير وكيل —</p>
          </div>

          {invite && inviteType === "manual_client" && mode !== "reset" && (
            <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm text-green-300 flex items-center gap-2">
              <span className="text-lg">🎉</span>
              <span>دعوة من محاميك — أكمل تسجيلك لربط حسابك بقضاياك تلقائياً</span>
            </div>
          )}
          {(returnUrl || getAuthIntent()) && mode !== "reset" && !invite && (
            <div className="mb-4 bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 text-sm text-gold flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0" />
              <span>سجّل دخولك للمتابعة — سيُعاد توجيهك تلقائياً إلى حيث كنت</span>
            </div>
          )}



          {mode === "signup" && step === 1 && (
            <>
              <p className="text-sm text-foreground/70 text-center mb-4">اختر نوع حسابك</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => { setRole("client"); setStep(2); }}
                  className="p-5 rounded-xl border border-border bg-surface/40 hover:border-gold hover:bg-gold/10 transition flex flex-col items-center gap-2"
                >
                  <User className="h-7 w-7 text-gold" />
                  <span className="font-semibold">موكّل</span>
                  <span className="text-xs text-foreground/60">أبحث عن محامٍ أو استشارة</span>
                </button>
                <button
                  onClick={() => { setRole("lawyer"); setStep(2); }}
                  className="p-5 rounded-xl border border-border bg-surface/40 hover:border-gold hover:bg-gold/10 transition flex flex-col items-center gap-2"
                >
                  <Scale className="h-7 w-7 text-gold" />
                  <span className="font-semibold">محامي</span>
                  <span className="text-xs text-foreground/60">أدير ممارستي القانونية</span>
                </button>
              </div>
            </>
          )}

          {(mode !== "signup" || step === 2) && (
            <form onSubmit={onSubmit} className="space-y-3">
              {mode === "signup" && (
                <>
                  <Field label="الاسم الكامل" required value={form.full_name} onChange={upd("full_name")} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="رقم الهاتف" value={form.phone} onChange={upd("phone")} placeholder="01xxxxxxxxx" />
                    <div>
                      <label className="block text-xs text-foreground/70 mb-1.5">المحافظة / المدينة</label>
                      <select
                        value={form.location}
                        onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                        style={{ colorScheme: "dark" }}
                        className="w-full bg-[#121927] text-foreground border border-gold-soft/40 focus:border-gold rounded-lg px-3 py-2.5 outline-none text-sm cursor-pointer shadow-sm"
                      >
                        <option value="" className="bg-[#121927] text-foreground/70">— اختر المحافظة —</option>
                        {citiesList.map((c) => (
                          <option key={c} value={c} className="bg-[#121927] text-foreground py-1">{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="text-xs text-foreground/60 bg-gold/5 border border-gold/20 rounded-lg px-3 py-2">
                    📱 سنتواصل معك عبر الواتساب أيضاً على الرقم المدخل عند الحاجة.
                  </div>
                </>
              )}
              <Field label="البريد الإلكتروني" type="email" required value={form.email} onChange={upd("email")} />
              {mode !== "reset" && (
                <Field label="كلمة المرور" type="password" required value={form.password} onChange={upd("password")} />
              )}
              {mode === "signup" && role === "lawyer" && (
                <>
                  <Field label="رقم القيد بالنقابة" required value={form.bar_number} onChange={upd("bar_number")} />
                  <Field label="اسم المكتب (اختياري)" value={form.firm_name} onChange={upd("firm_name")} />
                  <div>
                    <label className="block text-xs text-foreground/70 mb-2 font-medium">التخصصات / أنواع القضايا (اختر تخصصاتك من جدول legal_categories)</label>
                    {categoriesList.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-2 bg-elevated/40 border border-gold-soft/30 rounded-lg">
                        {categoriesList.map((catName) => {
                          const active = selectedSpecs.includes(catName);
                          return (
                            <button
                              key={catName}
                              type="button"
                              onClick={() =>
                                setSelectedSpecs((prev) =>
                                  prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
                                )
                              }
                              className={`px-2.5 py-1 rounded-full text-xs border transition ${
                                active
                                  ? "bg-gold text-primary-foreground border-gold font-bold"
                                  : "bg-surface/80 border-gold-soft/40 text-foreground/70 hover:border-gold/60"
                              }`}
                            >
                              {catName}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <Field label="التخصصات (مفصولة بفواصل)" value={form.specializations} onChange={upd("specializations")} placeholder="جنائي, مدني, أسرة" />
                    )}
                  </div>
                </>
              )}

              {mode === "signup" && (
                <label className="flex items-start gap-2 text-xs text-foreground/70 bg-elevated/60 border border-border rounded-lg px-3 py-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    className="mt-0.5 accent-[var(--gold,#c9a227)]"
                  />
                  <span>
                    أقر بأنني قرأت ووافقت على{" "}
                    <a href="/terms" target="_blank" rel="noreferrer" className="text-gold hover:underline">شروط الاستخدام</a>{" "}
                    و
                    <a href="/privacy" target="_blank" rel="noreferrer" className="text-gold hover:underline">سياسة الخصوصية</a>،
                    وأن «الوكيل» منصة وساطة تقنية فقط ولا تُقدّم خدمات قانونية ولا تتحمل مسؤولية العلاقة بين المحامي والموكل.
                  </span>
                </label>
              )}



              {error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3">{error}</div>}
              {info && <div className="text-sm text-gold bg-gold/10 border border-gold/30 rounded-lg p-3">{info}</div>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gold-gradient animate-shimmer text-primary-foreground font-semibold py-3 rounded-xl shadow-gold hover:scale-[1.01] transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signup" ? "إنشاء الحساب" : mode === "login" ? "دخول" : "إرسال رابط الاستعادة"}
              </button>

              {mode === "signup" && (
                <button type="button" onClick={() => setStep(1)} className="block w-full text-xs text-foreground/60 hover:text-gold">
                  ← تغيير نوع الحساب
                </button>
              )}
            </form>
          )}

          <div className="text-center mt-6 text-sm text-foreground/60 space-y-2">
            {mode !== "login" && (
              <div>
                لديك حساب؟{" "}
                <button onClick={() => { setMode("login"); setError(null); setInfo(null); }} className="text-gold hover:underline font-semibold">سجّل دخولك</button>
              </div>
            )}
            {mode !== "signup" && (
              <div>
                لا تملك حساباً؟{" "}
                <button onClick={() => { setMode("signup"); setStep(1); setError(null); setInfo(null); }} className="text-gold hover:underline font-semibold">أنشئ حساباً</button>
              </div>
            )}
            {mode === "login" && (
              <div>
                <button onClick={() => { setMode("reset"); setError(null); setInfo(null); }} className="text-foreground/70 hover:text-gold">نسيت كلمة المرور؟</button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-sm text-foreground/80 mb-1.5">{label}</label>
      <input
        {...rest}
        className="w-full bg-elevated border border-gold-soft/40 focus:border-gold rounded-lg px-4 py-2.5 text-foreground placeholder:text-foreground/30 outline-none transition"
      />
    </div>
  );
}
