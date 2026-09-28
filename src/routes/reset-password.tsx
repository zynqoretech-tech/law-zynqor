import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/alwakeel-logo.jpeg";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "تعيين كلمة مرور جديدة — الوكيل" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    setDone(true);
    setTimeout(() => navigate({ to: "/dashboard" }), 1200);
  };

  return (
    <div className="min-h-screen islamic-pattern flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface border border-gold-soft/40 rounded-2xl p-8 shadow-gold">
        <div className="text-center mb-6">
          <Link to="/"><img src={logo} alt="الوكيل" className="h-14 w-14 mx-auto rounded-xl object-cover ring-1 ring-gold/40 mb-3" /></Link>
          <h1 className="font-display text-2xl text-gradient-gold font-bold">تعيين كلمة مرور جديدة</h1>
        </div>
        {done ? (
          <p className="text-center text-gold">تم! يتم تحويلك للوحة التحكم…</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <input
              type="password"
              required
              minLength={6}
              placeholder="كلمة المرور الجديدة"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-elevated border border-gold-soft/40 focus:border-gold rounded-lg px-4 py-2.5 outline-none"
            />
            {error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3">{error}</div>}
            <button disabled={loading} className="w-full bg-gold-gradient text-primary-foreground font-semibold py-3 rounded-xl inline-flex items-center justify-center gap-2 disabled:opacity-50">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} حفظ
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
