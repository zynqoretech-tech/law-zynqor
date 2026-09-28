import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SUPPORT_PHONE_DISPLAY, supportContactUrl } from "@/lib/support";
import { Clock, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/dashboard/lawyer")({
  component: LawyerLayout,
});

function LawyerLayout() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ok"; daysLeft: number | null }
    | { status: "expired" }
  >({ status: "loading" });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState({ status: "ok", daysLeft: null }); return; }
      const { data } = await supabase
        .from("profiles")
        .select("role, plan, plan_expires_at, created_at")
        .eq("id", user.id)
        .maybeSingle();
      if (!data || data.role !== "lawyer") { setState({ status: "ok", daysLeft: null }); return; }
      const now = Date.now();
      const paidPlan = !!data.plan && data.plan !== "free";
      // Admin-granted subscription
      if (data.plan_expires_at) {
        const exp = new Date(data.plan_expires_at).getTime();
        if (exp > now) {
          const daysLeft = Math.ceil((exp - now) / 86400000);
          setState({ status: "ok", daysLeft });
          return;
        }
        setState({ status: "expired" });
        return;
      }
      // Paid plan with no expiry date = open-ended subscription
      if (paidPlan) { setState({ status: "ok", daysLeft: null }); return; }

      // Trial: 3 days from created_at
      const created = data.created_at ? new Date(data.created_at).getTime() : now;
      const trialEnd = created + 3 * 86400000;
      if (trialEnd > now) {
        const daysLeft = Math.ceil((trialEnd - now) / 86400000);
        setState({ status: "ok", daysLeft });
        return;
      }
      setState({ status: "expired" });
    })();
  }, []);

  if (state.status === "loading") {
    return <div className="p-8 text-foreground/60" dir="rtl">جاري التحميل...</div>;
  }

  if (state.status === "expired") {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-overlay border border-gold-soft/40 rounded-2xl p-8 text-center shadow-gold">
          <div className="w-14 h-14 mx-auto rounded-full bg-gold/15 flex items-center justify-center mb-4">
            <Clock className="h-7 w-7 text-gold" />
          </div>
          <h2 className="font-display text-2xl text-gradient-gold mb-2">انتهت الفترة التجريبية</h2>
          <p className="text-foreground/75 text-sm leading-relaxed mb-6">
            انتهت فترتك التجريبية المجانية (3 أيام). للاستمرار في استخدام لوحة التحكم والاستفادة من كل مزايا المنصة، يُرجى التواصل معنا لتفعيل الاشتراك.
          </p>
          <div className="bg-gold/5 border border-gold/20 rounded-xl p-4 mb-5">
            <div className="text-xs text-foreground/60 mb-1">رقم التواصل الرسمي</div>
            <div className="font-display text-xl text-gold font-bold tracking-wide" dir="ltr">
              {SUPPORT_PHONE_DISPLAY}
            </div>
          </div>
          <a
            href={supportContactUrl("أرغب في تفعيل اشتراكي في منصة الوكيل")}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 bg-gold-gradient text-primary-foreground font-semibold py-3 rounded-xl shadow-gold hover:scale-[1.02] transition"
          >
            <MessageCircle className="h-5 w-5" /> تواصل عبر واتساب
          </a>
          <Link to="/pricing" className="block mt-3 text-xs text-foreground/60 hover:text-gold">
            عرض خطط الاشتراك
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {state.daysLeft !== null && state.daysLeft <= 5 && (
        <div className="bg-gold/10 border-b border-gold/30 px-4 py-2 text-center text-xs text-gold" dir="rtl">
          {state.daysLeft <= 1
            ? "ينتهي اشتراكك اليوم — "
            : `يتبقى ${state.daysLeft} أيام على انتهاء اشتراكك — `}
          <a
            href={supportContactUrl("أرغب في تجديد اشتراكي في منصة الوكيل")}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold"
          >
            تواصل للتجديد ({SUPPORT_PHONE_DISPLAY})
          </a>
        </div>
      )}
      <Outlet />
    </>
  );
}
