import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { translateAuthError } from "@/lib/translate-error";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({ meta: [{ title: "الإعدادات — الوكيل" }] }),
  component: Settings,
});

function Settings() {
  const { profile, userId } = useAuth();
  const [pwd, setPwd] = useState({ next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [tg, setTg] = useState<{ chat_id: number | null; code: string | null } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data: prof } = await supabase
        .from("profiles").select("telegram_chat_id").eq("id", userId).maybeSingle();
      let code: string | null = null;
      const { data: link } = await supabase
        .from("telegram_link_codes").select("code").eq("user_id", userId).maybeSingle();
      code = (link as any)?.code ?? null;
      if (!code) {
        const { data: created } = await supabase
          .from("telegram_link_codes")
          .insert({ user_id: userId } as any)
          .select("code")
          .maybeSingle();
        code = (created as any)?.code ?? null;
      }
      if (!cancelled) setTg({ chat_id: (prof as any)?.telegram_chat_id ?? null, code });
    })();
    return () => { cancelled = true; };
  }, [userId]);

  async function unlinkTelegram() {
    if (!userId) return;
    await supabase.from("profiles").update({ telegram_chat_id: null } as any).eq("id", userId);
    setTg((t) => (t ? { ...t, chat_id: null } : t));
    toast.success("تم فصل تليجرام");
  }


  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.next !== pwd.confirm) return toast.error("كلمتا المرور الجديدتان لا تتطابقان");
    if (pwd.next.length < 8) return toast.error("يجب أن تكون كلمة المرور 8 أحرف على الأقل");
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd.next });
      if (error) throw error;
      toast.success("تم تغيير كلمة المرور بنجاح ✓");
      setPwd({ next: "", confirm: "" });
    } catch (e) {
      toast.error(translateAuthError((e as Error).message));
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full bg-elevated border border-gold-soft/40 focus:border-gold rounded-lg px-3 py-2.5 text-foreground outline-none text-sm";

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="font-display text-3xl text-gradient-gold font-bold">الإعدادات</h1>

      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6">
        <h2 className="font-display text-xl text-gold mb-4">معلومات الحساب</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-foreground/60">الاسم</span>
            <span className="text-foreground">{profile?.full_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/60">الدور</span>
            <span className="text-foreground">{profile?.role === "lawyer" ? "محامٍ" : "موكّل"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/60">الخطة</span>
            <span className="text-gold font-semibold">{profile?.plan ?? "free"}</span>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6">
        <h2 className="font-display text-xl text-gold mb-4 inline-flex items-center gap-2"><Send className="h-5 w-5" /> ربط بوت تليجرام</h2>
        <p className="text-sm text-foreground/70 mb-4">
          استقبل إشعارات الحجوزات والجلسات وطلبات التوكيل مباشرة على تليجرام. الأدمن يمكنه أيضاً محادثة البوت للاستفسار عن القضايا والموكلين.
        </p>
        {tg?.chat_id ? (
          <div className="space-y-3">
            <div className="bg-green-500/10 border border-green-500/30 text-green-300 rounded-lg px-4 py-3 text-sm">
              ✓ حسابك مربوط بتليجرام (chat_id: <code>{tg.chat_id}</code>)
            </div>
            <button onClick={unlinkTelegram} className="border border-destructive/40 text-destructive px-4 py-2 rounded-lg text-sm hover:bg-destructive/10">
              فصل الربط
            </button>
          </div>
        ) : tg?.code ? (
          <div className="space-y-3">
            <div className="bg-elevated border border-border rounded-lg p-4 text-sm space-y-2">
              <div>1. افتح البوت من هذا الرابط: <a href={`https://t.me/Alwakeellwyerbot?start=${tg.code}`} target="_blank" rel="noreferrer" className="text-gold hover:underline font-semibold">فتح @Alwakeellwyerbot في تليجرام</a></div>
              <div>2. أو ابحث في تليجرام عن البوت وأرسل:</div>
              <div className="bg-background border border-gold/30 rounded px-3 py-2 font-mono text-gold text-center">
                /start {tg.code}
              </div>
              <div className="text-xs text-foreground/50 pt-2">⚠️ لا تشارك هذا الكود مع أحد.</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-foreground/50">جاري التحميل...</div>
        )}
      </div>

      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6">
        <h2 className="font-display text-xl text-gold mb-4">تغيير كلمة المرور</h2>
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label className="block text-xs text-foreground/70 mb-1.5">كلمة المرور الجديدة</label>
            <input type="password" value={pwd.next}
              onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
              placeholder="8 أحرف على الأقل" minLength={8} required className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-foreground/70 mb-1.5">تأكيد كلمة المرور</label>
            <input type="password" value={pwd.confirm}
              onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
              placeholder="أعد كتابة كلمة المرور" required className={inputCls} />
          </div>
          <button type="submit" disabled={saving || !pwd.next || !pwd.confirm}
            className="bg-gold-gradient text-primary-foreground font-semibold px-6 py-2.5 rounded-xl shadow-gold disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            تغيير كلمة المرور
          </button>
        </form>
      </div>

      <div className="bg-surface border border-destructive/30 rounded-2xl p-6">
        <h2 className="font-display text-xl text-destructive mb-4">منطقة الخطر</h2>
        <p className="text-sm text-foreground/60 mb-4">
          حذف الحساب إجراء لا يمكن التراجع عنه. ستُفقد جميع البيانات.
        </p>
        <a href="mailto:support@alwakeel.app?subject=طلب حذف الحساب"
          className="inline-flex items-center gap-2 border border-destructive/40 text-destructive px-4 py-2 rounded-lg text-sm hover:bg-destructive/10 transition">
          طلب حذف الحساب عبر البريد
        </a>
      </div>
    </div>
  );
}
