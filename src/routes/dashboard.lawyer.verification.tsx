import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ShieldCheck, Upload, Camera, CheckCircle2, Clock3, XCircle } from "lucide-react";

export const Route = createFileRoute("/dashboard/lawyer/verification")({
  head: () => ({ meta: [{ title: "توثيق الحساب — الوكيل" }] }),
  component: VerificationPage,
});

type Req = {
  id: string;
  status: string;
  bar_number: string | null;
  bar_document_url: string | null;
  id_document_url: string | null;
  selfie_url: string | null;
  notes: string | null;
  created_at: string;
};

const MAX_SIZE = 8 * 1024 * 1024; // 8 MB
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

function VerificationPage() {
  const { userId } = useAuth();
  const [req, setReq] = useState<Req | null>(null);
  const [barNumber, setBarNumber] = useState("");
  const [barFile, setBarFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const selfieRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("lawyer_verification_requests")
      .select("*")
      .eq("lawyer_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setReq((data as unknown as Req) ?? null);
    if (data && (data as any).bar_number) setBarNumber((data as any).bar_number);
    setLoading(false);
  }

  useEffect(() => { load(); }, [userId]);

  function validate(file: File | null, label: string): string | null {
    if (!file) return `يرجى رفع ${label}`;
    if (file.size > MAX_SIZE) return `${label}: حجم الملف يتجاوز 8 ميجابايت`;
    if (!ACCEPT.split(",").includes(file.type)) return `${label}: نوع الملف غير مدعوم (JPG/PNG/WEBP/PDF)`;
    return null;
  }

  async function upload(file: File, key: string): Promise<string | null> {
    if (!userId) return null;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${userId}/${key}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("verification-docs").upload(path, file, {
      cacheControl: "3600", upsert: false, contentType: file.type,
    });
    if (error) { toast.error(`فشل رفع ${key}: ${error.message}`); return null; }
    return path;
  }

  async function submit() {
    if (!userId) return;
    const trimmed = barNumber.trim();
    if (!trimmed || trimmed.length < 3) { toast.error("رقم قيد النقابة مطلوب"); return; }
    for (const [f, l] of [[barFile, "كارنيه النقابة"], [idFile, "صورة الرقم القومي"], [selfieFile, "صورة سيلفي بالبطاقة والكارنيه"]] as const) {
      const e = validate(f, l);
      if (e) { toast.error(e); return; }
    }
    setBusy(true);
    try {
      const [barPath, idPath, selfiePath] = await Promise.all([
        upload(barFile!, "bar"),
        upload(idFile!, "id"),
        upload(selfieFile!, "selfie"),
      ]);
      if (!barPath || !idPath || !selfiePath) return;

      // Update the current (non-approved) row if it exists, else insert new.
      const payload = {
        bar_number: trimmed,
        bar_document_url: barPath,
        id_document_url: idPath,
        selfie_url: selfiePath,
        status: "pending",
        notes: null,
      };
      let saveErr: any = null;
      if (req && req.status !== "approved") {
        const { error } = await supabase
          .from("lawyer_verification_requests")
          .update(payload as any)
          .eq("id", req.id);
        saveErr = error;
      } else {
        const { error } = await supabase
          .from("lawyer_verification_requests")
          .insert({ lawyer_id: userId, ...payload } as any);
        saveErr = error;
      }
      if (saveErr) { toast.error(saveErr.message); return; }


      // Also mirror bar_number to lawyers table (trigger will revoke verified on change).
      await supabase.from("lawyers").update({ bar_number: trimmed }).eq("id", userId);

      // Notify all admins in-app.
      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (admins && admins.length > 0) {
        await supabase.from("notifications").insert(
          admins.map((a: any) => ({
            user_id: a.user_id,
            title: "طلب توثيق محامي جديد",
            body: `رقم القيد: ${trimmed}`,
            type: "verification_request",
          })),
        );
      }

      toast.success("تم إرسال طلب التوثيق. سيتم مراجعته خلال 24-48 ساعة.");
      setBarFile(null); setIdFile(null); setSelfieFile(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-8 text-foreground/60">جاري التحميل…</div>;

  const statusBadge = req && (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
      req.status === "approved" ? "bg-green-500/15 text-green-400 border border-green-500/40"
      : req.status === "rejected" ? "bg-destructive/15 text-destructive border border-destructive/40"
      : "bg-gold/15 text-gold border border-gold/40"
    }`}>
      {req.status === "approved" && <><CheckCircle2 className="h-3.5 w-3.5" /> تم التوثيق</>}
      {req.status === "rejected" && <><XCircle className="h-3.5 w-3.5" /> مرفوض</>}
      {req.status === "pending" && <><Clock3 className="h-3.5 w-3.5" /> قيد المراجعة</>}
    </div>
  );

  const canResubmit = !req || req.status === "rejected";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl text-gradient-gold font-bold flex items-center gap-2">
          <ShieldCheck className="h-7 w-7" /> توثيق حساب المحامي
        </h1>
        <p className="text-foreground/60 text-sm mt-1">ارفع مستنداتك للحصول على شارة التوثيق وزيادة ثقة الموكلين.</p>
      </div>

      {req && (
        <div className="bg-overlay border border-gold-soft/30 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-foreground/80">حالة الطلب الحالي</div>
            <div className="text-xs text-foreground/50 mt-0.5">أرسل في {new Date(req.created_at).toLocaleString("ar-EG")}</div>
            {req.notes && req.status === "rejected" && (
              <div className="text-xs text-destructive mt-2">سبب الرفض: {req.notes}</div>
            )}
          </div>
          {statusBadge}
        </div>
      )}

      {!canResubmit && req?.status === "pending" && (
        <div className="bg-gold/5 border border-gold/30 rounded-xl p-4 text-sm text-foreground/80">
          طلبك قيد المراجعة الآن. سنُخطرك فور اتخاذ قرار.
        </div>
      )}

      {!canResubmit && req?.status === "approved" && (
        <div className="bg-green-500/5 border border-green-500/30 rounded-xl p-4 text-sm text-foreground/80">
          حسابك موثّق ✓ لن تحتاج لإعادة الرفع إلا لو تم تغيير رقم قيدك.
        </div>
      )}

      {canResubmit && (
        <div className="bg-overlay border border-gold-soft/30 rounded-2xl p-5 space-y-5">
          <div>
            <label className="block text-sm text-foreground/80 mb-1">رقم قيد النقابة</label>
            <input
              type="text" value={barNumber} onChange={(e) => setBarNumber(e.target.value)}
              placeholder="مثال: 12345"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm"
              maxLength={30}
            />
          </div>

          <FileField
            label="صورة كارنيه النقابة"
            hint="صورة واضحة للوجه الأمامي (JPG/PNG/PDF — أقل من 8MB)"
            file={barFile} onFile={setBarFile}
          />
          <FileField
            label="صورة الرقم القومي (الوجه الأمامي)"
            hint="صورة واضحة لا تحتوي على انعكاسات"
            file={idFile} onFile={setIdFile}
          />

          <div>
            <label className="block text-sm text-foreground/80 mb-1">سيلفي بالبطاقة + الكارنيه</label>
            <p className="text-xs text-foreground/50 mb-2">
              التقط صورة لنفسك وأنت تمسك بطاقة الرقم القومي وكارنيه النقابة بجوار وجهك للتأكد من الهوية.
            </p>
            <input
              ref={selfieRef}
              type="file" accept="image/*" capture="user"
              onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              type="button" onClick={() => selfieRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-gold/40 hover:border-gold hover:bg-gold/5 transition"
            >
              <Camera className="h-5 w-5 text-gold" />
              <span className="text-sm">{selfieFile ? selfieFile.name : "التقط صورة سيلفي"}</span>
            </button>
          </div>

          <button
            onClick={submit} disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 bg-gold-gradient text-primary-foreground font-semibold py-3 rounded-xl shadow-gold disabled:opacity-50"
          >
            <Upload className="h-5 w-5" /> {busy ? "جارٍ الرفع…" : "إرسال طلب التوثيق"}
          </button>
        </div>
      )}
    </div>
  );
}

function FileField({ label, hint, file, onFile }: {
  label: string; hint: string; file: File | null; onFile: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="block text-sm text-foreground/80 mb-1">{label}</label>
      <p className="text-xs text-foreground/50 mb-2">{hint}</p>
      <input
        ref={ref} type="file" accept={ACCEPT}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        className="hidden"
      />
      <button
        type="button" onClick={() => ref.current?.click()}
        className="w-full inline-flex items-center justify-center gap-2 py-4 rounded-xl border border-dashed border-gold-soft/50 hover:border-gold hover:bg-gold/5 transition text-sm"
      >
        <Upload className="h-4 w-4 text-gold" />
        <span>{file ? file.name : "اختر ملف…"}</span>
      </button>
    </div>
  );
}
