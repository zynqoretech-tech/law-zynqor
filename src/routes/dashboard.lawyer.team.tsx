import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { UserPlus, Trash2, Shield, Phone, Loader2, Lock } from "lucide-react";
import { ConfirmDialog } from "@/components/DashboardShared";

export const Route = createFileRoute("/dashboard/lawyer/team")({
  component: TeamPage,
});

type Member = {
  id: string;
  office_lawyer_id: string;
  member_profile_id: string;
  role: string;
  can_view_all_cases: boolean;
  can_edit_cases: boolean;
  can_view_billing: boolean;
  is_active: boolean;
  joined_at: string;
  profile?: { full_name: string | null; phone: string | null } | null;
};

const ROLES = [
  { value: "senior_lawyer", label: "محامٍ كبير" },
  { value: "associate", label: "محامٍ مساعد" },
  { value: "paralegal", label: "مساعد قانوني" },
  { value: "secretary", label: "سكرتارية" },
  { value: "admin", label: "مدير النظام" },
];

function roleLabel(r: string) {
  return ROLES.find((x) => x.value === r)?.label ?? r;
}

function TeamPage() {
  const { profile, loading: authLoading } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("associate");
  const [inviting, setInviting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const allowed = true;

  async function load() {
    if (!profile || !allowed) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("office_lawyer_id", profile.id)
      .order("joined_at", { ascending: false });
    if (error) {
      toast.error("تعذر تحميل أعضاء الفريق");
      setLoading(false);
      return;
    }
    const ids = (data ?? []).map((m: any) => m.member_profile_id);
    let profilesMap: Record<string, any> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", ids);
      profilesMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    }
    setMembers(((data ?? []) as any[]).map((m) => ({ ...m, profile: profilesMap[m.member_profile_id] ?? null })));
    setLoading(false);
  }

  useEffect(() => { load(); }, [profile?.id, allowed]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .eq("phone", inviteEmail.trim())
        .maybeSingle();
      if (pErr) throw pErr;
      if (!prof) {
        toast.error("لا يوجد مستخدم بهذا الرقم. اطلب منه التسجيل أولاً.");
        return;
      }
      if (prof.id === profile.id) {
        toast.error("لا يمكنك إضافة نفسك");
        return;
      }
      const { error } = await supabase.from("team_members").insert({
        office_lawyer_id: profile.id,
        member_profile_id: prof.id,
        role: inviteRole,
        permissions: {},
        can_view_all_cases: true,
        can_edit_cases: false,
        can_view_billing: false,
        is_active: true,
      });
      if (error) {
        if (error.code === "23505") toast.error("هذا العضو موجود بالفعل");
        else throw error;
        return;
      }
      toast.success("تمت إضافة العضو");
      setInviteEmail("");
      setInviteRole("associate");
      load();
    } catch (err: any) {
      toast.error(err.message ?? "حدث خطأ");
    } finally {
      setInviting(false);
    }
  }

  async function updateMember(id: string, patch: Partial<Omit<Member, "profile">>) {
    const { error } = await supabase.from("team_members").update(patch).eq("id", id);
    if (error) { toast.error("تعذر التحديث"); return; }
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  async function doRemove(id: string) {
    setConfirmRemove(null);
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) { toast.error("تعذر الحذف"); return; }
    toast.success("تمت الإزالة");
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  if (authLoading) {
    return <div className="py-20 text-center text-foreground/50 text-sm">جاري التحميل...</div>;
  }

  if (!allowed) {
    return (
      <div className="max-w-xl mx-auto mt-10 bg-overlay border border-gold/30 rounded-2xl p-8 text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-gold/15 flex items-center justify-center">
          <Lock className="h-7 w-7 text-gold" />
        </div>
        <h2 className="font-display text-2xl text-gradient-gold">ميزة خاصة بخطة "المكتب"</h2>
        <p className="text-foreground/70 text-sm leading-relaxed">
          إدارة الفريق وصلاحيات الأعضاء متاحة فقط لمشتركي خطة المكتب.
          ترقَّ الآن لإضافة محامين مساعدين، مساعدين قانونيين، وسكرتارية إلى مكتبك.
        </p>
        <Link to="/pricing" className="inline-flex items-center gap-2 bg-gold-gradient text-primary-foreground font-semibold px-6 py-2.5 rounded-xl shadow-gold">
          ترقية الخطة
        </Link>
        <div className="text-xs text-foreground/50">خطتك الحالية: {profile?.plan ?? "free"}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-gradient-gold font-bold">إدارة الفريق</h1>
        <p className="text-sm text-foreground/60 mt-1">أضف أعضاء المكتب وحدّد صلاحياتهم على القضايا والفواتير.</p>
      </div>

      <form onSubmit={invite} className="bg-overlay border border-gold-soft/20 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-5 w-5 text-gold" />
          <h2 className="font-semibold text-foreground">دعوة عضو جديد</h2>
        </div>
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3">
          <div className="relative">
            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
            <input
              type="tel"
              required
              placeholder="رقم هاتف العضو (مسجّل في المنصة)"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full bg-surface border border-gold-soft/30 rounded-xl pr-10 pl-3 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </div>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="bg-surface border border-gold-soft/30 rounded-xl px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
          >
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button
            type="submit"
            disabled={inviting}
            className="bg-gold-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-xl shadow-gold disabled:opacity-50 inline-flex items-center gap-2"
          >
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            إضافة
          </button>
        </div>
        <p className="text-xs text-foreground/50 mt-3">
          ملاحظة: يجب أن يكون لدى العضو حساب مسجّل في "الوكيل" قبل إضافته.
        </p>
      </form>

      <div className="bg-overlay border border-gold-soft/20 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gold-soft/20 flex items-center gap-2">
          <Shield className="h-5 w-5 text-gold" />
          <h2 className="font-semibold text-foreground">أعضاء الفريق</h2>
          <span className="text-xs text-foreground/50 mr-auto">{members.length} عضو</span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-foreground/50 text-sm">جاري التحميل...</div>
        ) : members.length === 0 ? (
          <div className="p-10 text-center text-foreground/50 text-sm">لا يوجد أعضاء في فريقك بعد.</div>
        ) : (
          <div className="divide-y divide-gold-soft/10">
            {members.map((m) => (
              <div key={m.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gold-gradient flex items-center justify-center font-bold text-primary-foreground">
                      {m.profile?.full_name?.[0] ?? "ع"}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{m.profile?.full_name ?? "عضو"}</div>
                      <div className="text-xs text-foreground/60">{m.profile?.phone}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={m.role}
                      onChange={(e) => updateMember(m.id, { role: e.target.value })}
                      className="bg-surface border border-gold-soft/30 rounded-lg px-2 py-1.5 text-xs"
                    >
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      {!ROLES.find((r) => r.value === m.role) && <option value={m.role}>{roleLabel(m.role)}</option>}
                    </select>
                    <label className="flex items-center gap-2 text-xs text-foreground/70 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={m.is_active}
                        onChange={(e) => updateMember(m.id, { is_active: e.target.checked })}
                        className="accent-gold"
                      />
                      نشط
                    </label>
                    <button
                      onClick={() => setConfirmRemove(m.id)}
                      className="p-2 rounded-lg text-destructive hover:bg-destructive/10"
                      title="إزالة"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-2 pt-2 border-t border-gold-soft/10">
                  <Perm
                    label="عرض كل القضايا"
                    value={m.can_view_all_cases}
                    onChange={(v) => updateMember(m.id, { can_view_all_cases: v })}
                  />
                  <Perm
                    label="تعديل القضايا"
                    value={m.can_edit_cases}
                    onChange={(v) => updateMember(m.id, { can_edit_cases: v })}
                  />
                  <Perm
                    label="عرض الفواتير والأتعاب"
                    value={m.can_view_billing}
                    onChange={(v) => updateMember(m.id, { can_view_billing: v })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmRemove}
        title="إزالة عضو الفريق"
        desc="سيتم إزالة هذا العضو من فريقك. يمكنك إعادة دعوته لاحقاً."
        onConfirm={() => confirmRemove && doRemove(confirmRemove)}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}

function Perm({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm bg-surface/50 rounded-lg px-3 py-2 cursor-pointer">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="accent-gold" />
      <span className="text-foreground/80">{label}</span>
    </label>
  );
}
