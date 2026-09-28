import { handleSupabaseError } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Upload, Loader2, Pencil, Trash2, Download, FileText, Image as ImageIcon, X, Check, Eye, Shield, ExternalLink, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getStoredUser, getToken } from "@/lib/laravel";
import { EmptyState, ConfirmDialog } from "@/components/DashboardShared";

export const Route = createFileRoute("/dashboard/client/documents")({
  head: () => ({ meta: [{ title: "مستنداتي — الوكيل" }] }),
  component: ClientDocuments,
});

function ClientDocuments() {
  const { userId } = useAuth();
  const effectiveUserId = userId || String(getStoredUser()?.id || "4");
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // File selected for upload -> asking for title
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Live preview without download modal state
  const [viewingDoc, setViewingDoc] = useState<any | null>(null);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Edit title modal/state
  const [editingDoc, setEditingDoc] = useState<{ id: string; name: string } | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete modal state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; path: string; name: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await supabase.from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      
      const list = Array.isArray(data) ? data : [];
      setDocs(list);
    } catch (err) {
      console.error("Error loading documents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [effectiveUserId]);

  // When a file is chosen, prepare for title input
  function handleFileSelected(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("الملف يتجاوز 10MB");
      return;
    }
    setPendingFile(file);
    // Suggest clean title
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim();
    setDocTitle(nameWithoutExt || "مستند جديد");

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  }

  function cancelUpload() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(null);
    setDocTitle("");
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function confirmUpload() {
    if (!pendingFile) return;
    const finalTitle = docTitle.trim() || pendingFile.name;
    const curId = effectiveUserId || "client";
    setUploading(true);

    try {
      const ext = pendingFile.name.split(".").pop() ?? "bin";
      const path = `${curId}/personal/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage.from("documents").upload(path, pendingFile);
      if (uploadErr) throw uploadErr;

      const { error: dbErr } = await supabase.from("documents").insert({
        title: finalTitle,
        name: finalTitle,
        original_name: finalTitle,
        file_url: path,
        file_size: pendingFile.size,
        mime_type: pendingFile.type,
        uploaded_by: curId,
        client_id: curId,
        type: "personal",
        folder: "personal",
      });
      if (dbErr) throw dbErr;

      toast.success(`تم رفع "${finalTitle}" بنجاح ✓`);
      cancelUpload();
      await load();
    } catch (e) {
      toast.error(handleSupabaseError(e));
    } finally {
      setUploading(false);
    }
  }

  async function saveDocTitle() {
    if (!editingDoc || !editTitle.trim()) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase.from("documents")
        .update({ name: editTitle.trim(), title: editTitle.trim() })
        .eq("id", editingDoc.id);

      if (error) throw error;
      toast.success("تم تحديث عنوان المستند ✓");
      setEditingDoc(null);
      await load();
    } catch (e) {
      toast.error(handleSupabaseError(e));
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteDoc() {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    try {
      const { error: storageErr } = await supabase.storage
        .from("documents")
        .remove([confirmDelete.path]);
      if (storageErr) console.warn("Storage delete:", storageErr.message);

      const { error: dbErr } = await supabase
        .from("documents")
        .delete()
        .eq("id", confirmDelete.id);
      if (dbErr) throw dbErr;

      toast.success(`تم حذف "${confirmDelete.name}" ✓`);
      setConfirmDelete(null);
      load();
    } catch (e) {
      toast.error(handleSupabaseError(e));
    } finally {
      setDeletingId(null);
    }
  }

  async function getDownloadUrl(path: string, name: string, directUrl?: string) {
    try {
      const token = getToken();
      if (directUrl && token) {
        const res = await fetch(directUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = name || "مستند";
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
          return;
        }
      }

      if (directUrl) {
        window.open(directUrl, "_blank");
        return;
      }

      const { data } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
      if (!data?.signedUrl) return toast.error("فشل إنشاء رابط التحميل");
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = name;
      a.click();
    } catch {
      toast.error("فشل تحميل المستند");
    }
  }

  async function openDocPreview(doc: any) {
    setViewingDoc(doc);
    setLoadingPreview(true);
    setViewingUrl(null);
    try {
      if (doc.download_url) {
        setViewingUrl(doc.download_url);
      } else if (doc.file_url) {
        if (doc.file_url.startsWith("http")) {
          setViewingUrl(doc.file_url);
        } else {
          const { data } = await supabase.storage.from("documents").createSignedUrl(doc.file_url, 3600);
          if (data?.signedUrl) {
            setViewingUrl(data.signedUrl);
          }
        }
      }
    } catch (err) {
      console.error("Preview url error:", err);
    } finally {
      setLoadingPreview(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="font-display text-3xl text-gradient-gold font-bold">مستنداتي الشخصية</h1>
        <p className="text-foreground/60 text-sm mt-1">
          المستندات والوثائق الخاصة بك فقط — يمكنك تسمية المستند بعنوان واضح وتنزيله أو حذفه في أي وقت
        </p>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gold/30 hover:border-gold/60 rounded-2xl p-8 text-center cursor-pointer transition bg-surface/40 hover:bg-surface/60"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFileSelected(file);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelected(file);
          }}
        />
        <Upload className="h-9 w-9 text-gold mx-auto mb-2 opacity-80" />
        <div className="font-medium text-foreground text-sm">
          اسحب ملفاً إلى هنا أو انقر لاختيار ملف من جهازك
        </div>
        <div className="text-xs text-foreground/50 mt-1">
          يمكنك تحديد عنوان واضح للمستند قبل حفظه (PDF, Word, صور حتى 10MB)
        </div>
      </div>

      {/* Upload Dialog with Title Input */}
      {pendingFile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-gold/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                <span>📄</span>
                تحديد عنوان المستند
              </h3>
              <button
                type="button"
                onClick={cancelUpload}
                disabled={uploading}
                className="text-foreground/40 hover:text-foreground p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-3 p-3 bg-elevated/40 rounded-xl border border-border">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="معاينة"
                  className="h-16 w-16 object-cover rounded-lg border border-gold/30 shrink-0"
                />
              ) : (
                <div className="h-14 w-14 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0">
                  <FileText className="h-7 w-7 text-gold/70" />
                </div>
              )}
              <div className="min-w-0 flex-1 text-xs space-y-1">
                <div className="text-foreground font-medium truncate">{pendingFile.name}</div>
                <div className="text-foreground/50">
                  الحجم: {(pendingFile.size / 1024).toFixed(0)} KB • النوع: {pendingFile.type || "ملف"}
                </div>
              </div>
            </div>

            {/* Title Input */}
            <div className="space-y-2">
              <label htmlFor="doc-title-input" className="block text-sm font-medium text-foreground">
                عنوان المستند <span className="text-gold">*</span>
              </label>
              <input
                id="doc-title-input"
                type="text"
                autoFocus
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="مثال: صورة بطاقة الرقم القومي، عقد الشقة، إيصال..."
                className="w-full bg-elevated border border-border focus:border-gold rounded-xl px-4 py-2.5 text-sm text-foreground outline-none transition"
              />
              <p className="text-xs text-foreground/50">
                العنوان الذي سيظهر لك في قائمة مستنداتك لسهولة التعرف عليه
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={cancelUpload}
                disabled={uploading}
                className="px-4 py-2 text-sm text-foreground/70 hover:text-foreground hover:bg-elevated rounded-xl transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={confirmUpload}
                disabled={uploading || !docTitle.trim()}
                className="btn-gold px-5 py-2 text-sm flex items-center gap-2 rounded-xl disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الرفع...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    تأكيد ورفع المستند
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Title Dialog */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-gold/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                <Pencil className="h-4 w-4 text-gold" />
                تعديل عنوان المستند
              </h3>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="text-foreground/40 hover:text-foreground p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-title-input" className="block text-sm font-medium text-foreground">
                عنوان جديد للمستند
              </label>
              <input
                id="edit-title-input"
                type="text"
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="اكتب عنواناً مناسباً للمستند..."
                className="w-full bg-elevated border border-border focus:border-gold rounded-xl px-4 py-2.5 text-sm text-foreground outline-none transition"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                disabled={savingEdit}
                className="px-4 py-2 text-sm text-foreground/70 hover:text-foreground hover:bg-elevated rounded-xl transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={saveDocTitle}
                disabled={savingEdit || !editTitle.trim()}
                className="btn-gold px-5 py-2 text-sm flex items-center gap-2 rounded-xl disabled:opacity-50"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    حفظ العنوان
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document List */}
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <EmptyState icon="📄" title="لا توجد مستندات بعد" desc="ارفع مستنداتك الشخصية لتظهر هنا حصرياً" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {docs.map((d) => {
            const isImage = d.mime_type?.includes("image") || /\.(jpg|jpeg|png|webp)$/i.test(d.name || d.file_url);
            const isPdf = d.mime_type?.includes("pdf") || /\.pdf$/i.test(d.name || d.file_url);

            return (
              <div
                key={d.id}
                className="bg-surface border border-border/80 hover:border-gold-soft/50 rounded-xl p-4 flex items-center gap-3 transition shadow-sm"
              >
                <div className="h-12 w-12 rounded-xl bg-elevated/80 border border-border flex items-center justify-center shrink-0 text-xl">
                  {isImage ? (
                    <ImageIcon className="h-6 w-6 text-gold" />
                  ) : isPdf ? (
                    <FileText className="h-6 w-6 text-red-400" />
                  ) : (
                    <FileText className="h-6 w-6 text-blue-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate" title={d.name}>
                      {d.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDoc({ id: d.id, name: d.name });
                        setEditTitle(d.name);
                      }}
                      className="text-foreground/40 hover:text-gold p-0.5 rounded transition"
                      title="تعديل العنوان"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="text-xs text-foreground/50 mt-0.5 flex items-center gap-1.5">
                    {d.file_size ? <span>{(d.file_size / 1024).toFixed(0)} KB</span> : null}
                    {d.file_size ? <span>•</span> : null}
                    <span>{new Date(d.created_at).toLocaleDateString("ar-EG")}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openDocPreview(d)}
                    className="p-2 text-foreground/70 hover:text-gold hover:bg-gold/10 rounded-lg transition"
                    title="معاينة وتفاصيل المستند"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => getDownloadUrl(d.file_url, d.name, d.download_url)}
                    className="p-2 text-foreground/60 hover:text-gold hover:bg-elevated rounded-lg transition"
                    title="تحميل"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete({ id: d.id, path: d.file_url, name: d.name })}
                    disabled={deletingId === d.id}
                    className="p-2 text-foreground/40 hover:text-destructive hover:bg-elevated rounded-lg transition disabled:opacity-50"
                    title="حذف"
                  >
                    {deletingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Document Preview & Details Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface border border-gold/40 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border/50 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gold/15 border border-gold/30 flex items-center justify-center text-gold">
                  <Eye className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground truncate max-w-md">
                    {viewingDoc.name || viewingDoc.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-foreground/50">
                    <span>{viewingDoc.file_size ? `${(viewingDoc.file_size / 1024).toFixed(0)} KB` : "مستند قانوني"}</span>
                    <span>•</span>
                    <span>{new Date(viewingDoc.created_at).toLocaleDateString("ar-EG", { dateStyle: "long" })}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setViewingDoc(null);
                  setViewingUrl(null);
                }}
                className="text-foreground/40 hover:text-foreground p-1.5 rounded-xl hover:bg-elevated transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Preview Window */}
            <div className="flex-1 overflow-y-auto rounded-2xl border border-border/60 bg-elevated/40 p-4 min-h-[250px] flex items-center justify-center">
              {loadingPreview ? (
                <div className="flex flex-col items-center gap-2 py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gold" />
                  <span className="text-xs text-foreground/60">جاري إعداد المعاينة المباشرة...</span>
                </div>
              ) : viewingUrl && (viewingDoc.mime_type?.includes("image") || /\.(jpg|jpeg|png|webp)$/i.test(viewingDoc.name || viewingDoc.file_url)) ? (
                <img
                  src={viewingUrl}
                  alt={viewingDoc.name}
                  className="max-h-[55vh] max-w-full object-contain rounded-xl shadow-lg"
                />
              ) : viewingUrl && (viewingDoc.mime_type?.includes("pdf") || /\.pdf$/i.test(viewingDoc.name || viewingDoc.file_url)) ? (
                <iframe
                  src={viewingUrl}
                  className="w-full h-[55vh] rounded-xl border border-border/40"
                  title={viewingDoc.name}
                />
              ) : (
                <div className="text-center py-10 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto text-gold">
                    <FileText className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">{viewingDoc.name}</p>
                    <p className="text-xs text-foreground/50 mt-1">
                      نوع الملف: {viewingDoc.mime_type || "مستند قانوني معتمد"}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>مستند مشفر ومحمي وفق معايير السرية القانونية</span>
                  </div>
                </div>
              )}
            </div>

            {/* Metadata and Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 shrink-0 border-t border-border/40">
              <div className="flex items-center gap-2 text-xs text-foreground/60">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>محفوظ ومشفر بسجلات منصة زنقور للمحاماة</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => getDownloadUrl(viewingDoc.file_url, viewingDoc.name, viewingDoc.download_url)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gold/15 hover:bg-gold/25 border border-gold-soft text-gold text-xs font-bold transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تنزيل نسخة للمستند</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewingDoc(null);
                    setViewingUrl(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl border border-border text-foreground/70 hover:bg-elevated text-xs font-semibold transition"
                >
                  إغلاق المعاينة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="حذف المستند"
        desc={`سيتم حذف "${confirmDelete?.name}" نهائياً. هل تريد المتابعة؟`}
        onConfirm={deleteDoc}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
