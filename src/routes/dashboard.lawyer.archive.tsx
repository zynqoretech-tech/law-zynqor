import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Upload, FileText, Trash2, Download, Link as LinkIcon, Search, X, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/dashboard/lawyer/archive")({
  head: () => ({ meta: [{ title: "الأرشيف — الوكيل" }] }),
  component: ArchivePage,
});

type ArchiveFile = {
  id: string;
  name: string;
  description: string | null;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  tags: string[] | null;
  case_id: string | null;
  expense_id: string | null;
  invoice_id: string | null;
  client_id: string | null;
  hearing_id: string | null;
  consultation_id: string | null;
  created_at: string;
};

type Option = { id: string; label: string };

const BUCKET = "archive";
const inputCls =
  "w-full bg-elevated border border-gold-soft/40 focus:border-gold rounded-lg px-3 py-2 text-foreground outline-none text-sm";

function fmtSize(n: number | null) {
  if (!n) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function ArchivePage() {
  const { userId } = useAuth();
  const [items, setItems] = useState<ArchiveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [filterCase, setFilterCase] = useState<string>("");

  // options for linking
  const [cases, setCases] = useState<Option[]>([]);
  const [expenses, setExpenses] = useState<Option[]>([]);
  const [invoices, setInvoices] = useState<Option[]>([]);
  const [clients, setClients] = useState<Option[]>([]);
  const [hearings, setHearings] = useState<Option[]>([]);
  const [consultations, setConsultations] = useState<Option[]>([]);

  async function reload() {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("archive_files")
      .select("*")
      .eq("lawyer_id", userId)
      .order("created_at", { ascending: false });
    setItems((data as unknown as ArchiveFile[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (!userId) return;
    reload();
    supabase.from("cases").select("id, title").eq("lawyer_id", userId).then(({ data }) =>
      setCases((data ?? []).map((r: any) => ({ id: r.id, label: r.title }))));
    supabase.from("case_expenses").select("id, description, amount").eq("lawyer_id", userId).then(({ data }) =>
      setExpenses((data ?? []).map((r: any) => ({ id: r.id, label: `${r.description ?? "مصروف"} (${r.amount})` }))));
    supabase.from("invoices").select("id, invoice_number, total").eq("lawyer_id", userId).then(({ data }) =>
      setInvoices((data ?? []).map((r: any) => ({ id: r.id, label: `#${r.invoice_number ?? r.id.slice(0, 6)} — ${r.total ?? ""}` }))));
    supabase.from("manual_clients").select("id, full_name").eq("lawyer_id", userId).then(({ data }) =>
      setClients((data ?? []).map((r: any) => ({ id: r.id, label: r.full_name }))));
    supabase.from("hearings").select("id, court, hearing_date").then(({ data }) =>
      setHearings((data ?? []).map((r: any) => ({ id: r.id, label: `${r.court ?? "جلسة"} — ${r.hearing_date ?? ""}` }))));
    supabase.from("consultations").select("id, subject, scheduled_at").eq("lawyer_id", userId).then(({ data }) =>
      setConsultations((data ?? []).map((r: any) => ({ id: r.id, label: `${r.subject ?? "استشارة"} — ${r.scheduled_at ?? ""}` }))));
  }, [userId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((it) => {
      if (filterCase && it.case_id !== filterCase) return false;
      if (!term) return true;
      return (
        it.name.toLowerCase().includes(term) ||
        (it.description ?? "").toLowerCase().includes(term) ||
        (it.tags ?? []).some((t) => t.toLowerCase().includes(term))
      );
    });
  }, [items, q, filterCase]);

  async function downloadFile(path: string, name: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return toast.error("تعذّر إنشاء رابط التحميل");
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name;
    a.rel = "noopener";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function removeFile(f: ArchiveFile) {
    if (!confirm(`حذف الملف "${f.name}"؟`)) return;
    await supabase.storage.from(BUCKET).remove([f.storage_path]);
    await supabase.from("archive_files").delete().eq("id", f.id);
    setItems((xs) => xs.filter((x) => x.id !== f.id));
    toast.success("تم الحذف");
  }

  const linkLabel = (f: ArchiveFile) => {
    const parts: string[] = [];
    if (f.case_id) parts.push("قضية");
    if (f.expense_id) parts.push("مصروف");
    if (f.invoice_id) parts.push("فاتورة");
    if (f.client_id) parts.push("موكّل");
    if (f.hearing_id) parts.push("جلسة");
    if (f.consultation_id) parts.push("استشارة");
    return parts.join(" • ");
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-gradient-gold font-bold">الأرشيف</h1>
          <p className="text-sm text-foreground/60 mt-1">
            ارفع أي ملف واربطه بقضية أو مصروف أو فاتورة أو موكّل أو جلسة أو استشارة.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="bg-gold-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-xl shadow-gold inline-flex items-center gap-2"
        >
          <Upload className="h-4 w-4" /> رفع ملف
        </button>
      </div>

      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث في الاسم أو الوصف أو الوسوم"
            className={`${inputCls} pr-9`}
          />
        </div>
        <div className="inline-flex items-center gap-2 text-sm">
          <Filter className="h-4 w-4 text-foreground/60" />
          <select value={filterCase} onChange={(e) => setFilterCase(e.target.value)} className={inputCls + " min-w-[200px]"}>
            <option value="">كل القضايا</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="text-xs text-foreground/60">
          {filtered.length} ملف من أصل {items.length}
        </div>
      </div>

      <div className="bg-surface border border-gold-soft/40 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-foreground/60 text-center">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="h-10 w-10 mx-auto text-foreground/30 mb-3" />
            <div className="text-foreground/60">لا توجد ملفات بعد</div>
          </div>
        ) : (
          <ul className="divide-y divide-gold-soft/20">
            {filtered.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 p-4 hover:bg-elevated/40">
                <FileText className="h-5 w-5 text-gold shrink-0" />
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold text-foreground text-sm">{f.name}</div>
                  {f.description && <div className="text-xs text-foreground/60 mt-0.5">{f.description}</div>}
                  <div className="flex flex-wrap gap-2 mt-1.5 text-[11px] text-foreground/60">
                    <span>{fmtSize(f.size_bytes)}</span>
                    <span>·</span>
                    <span>{new Date(f.created_at).toLocaleDateString("ar-EG")}</span>
                    {linkLabel(f) && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 text-gold">
                          <LinkIcon className="h-3 w-3" /> {linkLabel(f)}
                        </span>
                      </>
                    )}
                    {(f.tags ?? []).map((t) => (
                      <span key={t} className="bg-gold/10 text-gold px-2 py-0.5 rounded">#{t}</span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => downloadFile(f.storage_path, f.name)}
                  className="border border-gold-soft/40 text-foreground px-3 py-1.5 rounded-lg text-xs inline-flex items-center gap-1 hover:bg-gold/10"
                >
                  <Download className="h-3.5 w-3.5" /> تحميل
                </button>
                <button
                  onClick={() => removeFile(f)}
                  className="border border-destructive/40 text-destructive px-3 py-1.5 rounded-lg text-xs inline-flex items-center gap-1 hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> حذف
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && (
        <UploadDialog
          onClose={() => setOpen(false)}
          onDone={() => { setOpen(false); reload(); }}
          userId={userId!}
          cases={cases}
          expenses={expenses}
          invoices={invoices}
          clients={clients}
          hearings={hearings}
          consultations={consultations}
        />
      )}
    </div>
  );
}

function UploadDialog(props: {
  onClose: () => void;
  onDone: () => void;
  userId: string;
  cases: Option[];
  expenses: Option[];
  invoices: Option[];
  clients: Option[];
  hearings: Option[];
  consultations: Option[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [caseId, setCaseId] = useState("");
  const [expenseId, setExpenseId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [clientId, setClientId] = useState("");
  const [hearingId, setHearingId] = useState("");
  const [consultationId, setConsultationId] = useState("");
  const [uploading, setUploading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("اختر ملفاً");
    setUploading(true);
    try {
      const cleanName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${props.userId}/${Date.now()}_${cleanName}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;

      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      const { error: insErr } = await supabase.from("archive_files").insert({
        lawyer_id: props.userId,
        name: name.trim() || file.name,
        description: description.trim() || null,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        tags,
        case_id: caseId || null,
        expense_id: expenseId || null,
        invoice_id: invoiceId || null,
        client_id: clientId || null,
        hearing_id: hearingId || null,
        consultation_id: consultationId || null,
      } as any);
      if (insErr) throw insErr;
      toast.success("تم رفع الملف");
      props.onDone();
    } catch (err) {
      toast.error((err as Error).message || "فشل الرفع");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={props.onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-gold-soft/40 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4"
        dir="rtl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-gold">رفع ملف جديد</h2>
          <button type="button" onClick={props.onClose} className="text-foreground/60 hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <label className="block text-xs text-foreground/70 mb-1.5">الملف</label>
          <input
            type="file"
            required
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !name) setName(f.name);
            }}
            className={inputCls}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-foreground/70 mb-1.5">الاسم المعروض</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-foreground/70 mb-1.5">وسوم (مفصولة بفواصل)</label>
            <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="عقد, نسخة أصلية" className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-xs text-foreground/70 mb-1.5">وصف</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls} />
        </div>

        <div className="border-t border-gold-soft/20 pt-4">
          <div className="text-sm text-foreground/70 mb-3">اربط الملف (اختياري):</div>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              { label: "قضية", val: caseId, set: setCaseId, opts: props.cases },
              { label: "مصروف", val: expenseId, set: setExpenseId, opts: props.expenses },
              { label: "فاتورة", val: invoiceId, set: setInvoiceId, opts: props.invoices },
              { label: "موكّل", val: clientId, set: setClientId, opts: props.clients },
              { label: "جلسة", val: hearingId, set: setHearingId, opts: props.hearings },
              { label: "استشارة", val: consultationId, set: setConsultationId, opts: props.consultations },
            ].map((row) => (
              <div key={row.label}>
                <label className="block text-xs text-foreground/70 mb-1.5">{row.label}</label>
                <select value={row.val} onChange={(e) => row.set(e.target.value)} className={inputCls}>
                  <option value="">— بدون —</option>
                  {row.opts.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={props.onClose} className="border border-gold-soft/40 text-foreground px-4 py-2 rounded-lg text-sm">
            إلغاء
          </button>
          <button
            type="submit"
            disabled={uploading || !file}
            className="bg-gold-gradient text-primary-foreground font-semibold px-5 py-2 rounded-lg shadow-gold disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Upload className="h-4 w-4" /> {uploading ? "جاري الرفع..." : "رفع"}
          </button>
        </div>
      </form>
    </div>
  );
}
