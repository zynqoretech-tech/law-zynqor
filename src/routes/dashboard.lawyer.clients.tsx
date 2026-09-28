import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, UserPlus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState } from "@/components/DashboardShared";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { caseTypeLabel, handleSupabaseError } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/lawyer/clients")({
  head: () => ({ meta: [{ title: "الموكلون — الوكيل" }] }),
  component: ClientsPage,
});

type ClientRow = {
  id: string;
  name: string;
  phone: string | null;
  email?: string | null;
  cases: number;
  source: "registered" | "manual";
  raw?: any;
};

const PAGE_SIZE = 30;

function ClientsPage() {
  const { userId } = useAuth();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [clientCases, setClientCases] = useState<any[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      // Registered clients (via cases.client_id → profiles)
      const FETCH = PAGE_SIZE * 4;
      const { data: casesData } = await supabase
        .from("cases")
        .select("client_id")
        .eq("lawyer_id", userId)
        .not("client_id", "is", null)
        .range(0, (page + 1) * FETCH - 1);
      const counts = new Map<string, number>();
      (casesData ?? []).forEach((c: any) => {
        if (!c.client_id) return;
        counts.set(c.client_id, (counts.get(c.client_id) ?? 0) + 1);
      });
      const ids = Array.from(counts.keys());
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name, phone").in("id", ids)
        : { data: [] as any[] };

      // Manual (external) clients
      const { data: manualData } = await supabase
        .from("manual_clients")
        .select("*")
        .eq("lawyer_id", userId)
        .order("created_at", { ascending: false });
      const manualIds = (manualData ?? []).map((m: any) => m.id);
      const { data: manualCaseCounts } = manualIds.length
        ? await supabase.from("cases").select("manual_client_id").eq("lawyer_id", userId).in("manual_client_id", manualIds)
        : { data: [] as any[] };
      const manualCounts = new Map<string, number>();
      (manualCaseCounts ?? []).forEach((c: any) => {
        if (!c.manual_client_id) return;
        manualCounts.set(c.manual_client_id, (manualCounts.get(c.manual_client_id) ?? 0) + 1);
      });

      const all: ClientRow[] = [
        ...(profs ?? []).map((p: any) => ({
          id: p.id, name: p.full_name, phone: p.phone, cases: counts.get(p.id) ?? 0, source: "registered" as const,
        })),
        ...(manualData ?? []).map((m: any) => ({
          id: m.id, name: m.full_name, phone: m.phone, email: m.email,
          cases: manualCounts.get(m.id) ?? 0, source: "manual" as const, raw: m,
        })),
      ];
      const visible = all.slice(0, (page + 1) * PAGE_SIZE);
      setHasMore(all.length > visible.length);
      setClients(visible);
      setLoading(false);
    })();
  }, [userId, page, reloadKey]);

  async function openClient(client: ClientRow) {
    setSelectedClient(client);
    setLoadingCases(true);
    const col = client.source === "manual" ? "manual_client_id" : "client_id";
    const { data } = await supabase
      .from("cases")
      .select("id, title, status, type, next_hearing, case_number")
      .eq("lawyer_id", userId!)
      .eq(col, client.id)
      .order("updated_at", { ascending: false });
    setClientCases(data ?? []);
    setLoadingCases(false);
  }

  async function deleteManual(c: ClientRow) {
    if (!confirm(`حذف الموكل "${c.name}"؟ سيتم فصله عن أي قضايا مرتبطة.`)) return;
    const { error } = await supabase.from("manual_clients").delete().eq("id", c.id);
    if (error) { toast.error(handleSupabaseError(error)); return; }
    toast.success("تم الحذف");
    setSelectedClient(null);
    setReloadKey((k) => k + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-gradient-gold font-bold">الموكلون</h1>
          <p className="text-foreground/60 text-sm mt-1">{clients.length} موكّل</p>
        </div>
        <button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="inline-flex items-center gap-2 bg-gold-gradient text-primary-foreground font-semibold px-4 py-2.5 rounded-xl shadow-gold text-sm">
          <UserPlus className="h-4 w-4" /> إضافة موكل خارجي
        </button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-5 flex items-center gap-3 animate-pulse">
              <div className="h-12 w-12 rounded-lg bg-elevated" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-elevated rounded w-3/4" />
                <div className="h-3 bg-elevated rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon="👥"
          title="لا يوجد موكلون بعد"
          desc="أضف موكلاً خارجياً (غير مسجل في المنصة) أو سيظهر الموكلون المسجلون هنا عند ربطهم بقضاياك"
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c) => (
            <button
              key={`${c.source}-${c.id}`}
              onClick={() => openClient(c)}
              className="bg-surface border border-border rounded-xl p-5 flex items-center gap-3 hover:border-gold/50 transition text-right w-full">
              <div className="h-12 w-12 rounded-lg bg-gold-gradient flex items-center justify-center font-bold text-primary-foreground text-lg shrink-0">
                {c.name?.[0] ?? "م"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground truncate flex items-center gap-2">
                  {c.name}
                  {c.source === "manual" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/15 text-gold border border-gold/30">خارجي</span>
                  )}
                </div>
                {c.phone && <div className="text-xs text-gold/70 truncate">{c.phone}</div>}
                <div className="text-xs text-foreground/50 mt-1">{c.cases} قضية</div>
              </div>
              <div className="text-foreground/30 text-lg">←</div>
            </button>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div className="text-center">
          <button onClick={() => setPage((p) => p + 1)}
            className="border border-gold/40 text-gold px-6 py-2.5 rounded-xl hover:bg-gold/10 transition text-sm">
            تحميل المزيد
          </button>
        </div>
      )}

      {selectedClient && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setSelectedClient(null)}>
          <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-gold space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start gap-2">
              <h3 className="font-display text-xl text-gradient-gold">{selectedClient.name}</h3>
              <button onClick={() => setSelectedClient(null)} className="text-foreground/60 hover:text-foreground">✕</button>
            </div>

            <div className="flex flex-wrap gap-3">
              {selectedClient.phone && (
                <a href={`tel:${selectedClient.phone}`} className="inline-flex items-center gap-2 text-sm text-gold hover:underline">📱 {selectedClient.phone}</a>
              )}
              {selectedClient.phone && (
                <a href={`https://wa.me/${selectedClient.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-green-400 hover:underline">💬 واتساب</a>
              )}
              {selectedClient.email && (
                <a href={`mailto:${selectedClient.email}`} className="inline-flex items-center gap-2 text-sm text-foreground/70 hover:underline">✉️ {selectedClient.email}</a>
              )}
            </div>

            {selectedClient.source === "manual" && selectedClient.raw && (
              <div className="text-xs text-foreground/60 space-y-1 bg-elevated rounded-lg p-3">
                {selectedClient.raw.national_id && <div>الرقم القومي: {selectedClient.raw.national_id}</div>}
                {selectedClient.raw.client_type === "company" && selectedClient.raw.company_name && <div>الشركة: {selectedClient.raw.company_name}</div>}
                {selectedClient.raw.address && <div>العنوان: {selectedClient.raw.address}</div>}
                {selectedClient.raw.notes && <div className="pt-1 border-t border-border">ملاحظات: {selectedClient.raw.notes}</div>}
              </div>
            )}

            <div className="flex gap-2 flex-wrap items-center">
              <Link
                to="/dashboard/lawyer/clients/$id"
                params={{ id: selectedClient.id }}
                className="inline-flex items-center gap-1.5 text-xs bg-gold-gradient text-primary-foreground font-semibold px-3 py-1.5 rounded-lg shadow-gold hover:opacity-95"
              >
                🔍 عرض الملف الكامل والتفاصيل
              </Link>
            </div>

            {selectedClient.source === "manual" && (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => { setEditing(selectedClient); setDialogOpen(true); setSelectedClient(null); }}
                  className="inline-flex items-center gap-1.5 text-xs border border-gold/40 text-gold px-3 py-1.5 rounded-lg hover:bg-gold/10">
                  <Pencil className="h-3.5 w-3.5" /> تعديل
                </button>
                <button
                  disabled={!selectedClient.raw?.email}
                  title={selectedClient.raw?.email ? undefined : "أضف بريد الموكل أولاً لتفعيل رابط الدعوة (يُستخدم للتحقق من الهوية)"}
                  onClick={() => {
                    if (!selectedClient.raw?.email) {
                      toast.error("أضف بريد الموكل الإلكتروني أولاً — يُستخدم للتحقق عند ربط الحساب");
                      return;
                    }
                    const link = `${window.location.origin}/auth?invite=${selectedClient.id}&type=manual_client`;
                    navigator.clipboard.writeText(link);
                    toast.success("تم نسخ رابط الدعوة ✓");
                  }}
                  className="inline-flex items-center gap-1.5 text-xs border border-gold/40 text-gold px-3 py-1.5 rounded-lg hover:bg-gold/10 disabled:opacity-40 disabled:cursor-not-allowed">
                  📋 نسخ رابط الدعوة
                </button>
                {selectedClient.phone && selectedClient.raw?.email && (
                  <a
                    href={`https://wa.me/${String(selectedClient.phone).replace(/\D/g, "")}?text=${encodeURIComponent(
                      `مرحباً ${selectedClient.name}،\nيمكنك الآن متابعة قضاياك وفواتيرك عبر منصة الوكيل.\n${window.location.origin}/auth?invite=${selectedClient.id}&type=manual_client`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs border border-[#25D366]/40 text-[#25D366] px-3 py-1.5 rounded-lg hover:bg-[#25D366]/10">
                    💬 دعوة عبر واتساب
                  </a>
                )}
                {selectedClient.raw?.platform_user_id && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-400 px-2 py-1.5">✅ مرتبط بحساب</span>
                )}
                <button onClick={() => deleteManual(selectedClient)}
                  className="inline-flex items-center gap-1.5 text-xs border border-destructive/40 text-destructive px-3 py-1.5 rounded-lg hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" /> حذف
                </button>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-foreground/60 mb-3">القضايا ({clientCases.length})</h4>
              {loadingCases ? (
                <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-14 bg-elevated rounded-lg animate-pulse" />)}</div>
              ) : clientCases.length === 0 ? (
                <p className="text-sm text-foreground/50">لا توجد قضايا مرتبطة</p>
              ) : (
                <div className="space-y-2">
                  {clientCases.map((c) => (
                    <Link key={c.id} to="/dashboard/lawyer/cases/$id" params={{ id: c.id }} onClick={() => setSelectedClient(null)}
                      className="flex items-center justify-between bg-elevated rounded-lg p-3 hover:bg-gold/10 transition">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{c.title}</div>
                        <div className="text-xs text-foreground/50">{caseTypeLabel(c.type)}</div>
                      </div>
                      <StatusBadge status={c.status} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {dialogOpen && (
        <ManualClientDialog
          userId={userId!}
          editing={editing}
          onClose={() => setDialogOpen(false)}
          onSaved={() => { setDialogOpen(false); setReloadKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}

function ManualClientDialog({
  userId, editing, onClose, onSaved,
}: { userId: string; editing: ClientRow | null; onClose: () => void; onSaved: () => void }) {
  const raw = editing?.raw ?? {};
  const [f, setF] = useState({
    full_name: raw.full_name ?? editing?.name ?? "",
    phone: raw.phone ?? "",
    email: raw.email ?? "",
    national_id: raw.national_id ?? "",
    address: raw.address ?? "",
    client_type: raw.client_type ?? "individual",
    company_name: raw.company_name ?? "",
    notes: raw.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.full_name.trim()) { toast.error("الاسم مطلوب"); return; }
    setSaving(true);
    const payload = {
      lawyer_id: userId,
      full_name: f.full_name.trim(),
      phone: f.phone.trim() || null,
      email: f.email.trim() || null,
      national_id: f.national_id.trim() || null,
      address: f.address.trim() || null,
      client_type: f.client_type,
      company_name: f.client_type === "company" ? (f.company_name.trim() || null) : null,
      notes: f.notes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("manual_clients").update(payload).eq("id", editing.id)
      : await supabase.from("manual_clients").insert(payload);
    setSaving(false);
    if (error) { toast.error(handleSupabaseError(error)); return; }
    toast.success(editing ? "تم التحديث" : "تمت إضافة الموكل ✓");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-gold space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-display text-xl text-gradient-gold">{editing ? "تعديل موكل" : "إضافة موكل خارجي"}</h3>
          <button type="button" onClick={onClose} className="text-foreground/60 hover:text-foreground">✕</button>
        </div>
        <p className="text-xs text-foreground/60 bg-elevated rounded-lg p-2">
          موكل خارجي = شخص أو شركة ليس مسجلاً على المنصة، تحتفظ ببياناته لاستخدامه في قضاياك فقط.
        </p>

        <div className="flex gap-2">
          {(["individual", "company"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setF((p) => ({ ...p, client_type: t }))}
              className={`px-3 py-1.5 rounded-lg text-xs border transition ${f.client_type === t ? "bg-gold/15 border-gold text-gold" : "border-border text-foreground/60"}`}>
              {t === "individual" ? "فرد" : "شركة"}
            </button>
          ))}
        </div>

        <Input label="الاسم الكامل *" value={f.full_name} onChange={(v) => setF({ ...f, full_name: v })} />
        {f.client_type === "company" && (
          <Input label="اسم الشركة" value={f.company_name} onChange={(v) => setF({ ...f, company_name: v })} />
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="الهاتف" value={f.phone} onChange={(v) => setF({ ...f, phone: v })} />
          <Input label="البريد الإلكتروني" type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} />
        </div>
        <Input label="الرقم القومي / السجل التجاري" value={f.national_id} onChange={(v) => setF({ ...f, national_id: v })} />
        <Input label="العنوان" value={f.address} onChange={(v) => setF({ ...f, address: v })} />
        <div>
          <label className="block text-xs text-foreground/70 mb-1.5">ملاحظات</label>
          <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={3} maxLength={1000}
            className="w-full bg-elevated border border-gold-soft/40 focus:border-gold rounded-lg px-3 py-2.5 text-sm outline-none" />
        </div>

        <button type="submit" disabled={saving}
          className="w-full bg-gold-gradient text-primary-foreground font-semibold py-3 rounded-xl shadow-gold inline-flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {editing ? "حفظ التعديلات" : "إضافة الموكل"}
        </button>
      </form>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs text-foreground/70 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-elevated border border-gold-soft/40 focus:border-gold rounded-lg px-3 py-2.5 text-sm outline-none" />
    </div>
  );
}
