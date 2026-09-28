import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Plus, X, Download, Trash2, Copy, Sparkles, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDialog } from "@/components/DashboardShared";
import { chatFetch } from "@/lib/chat-client";

export const Route = createFileRoute("/dashboard/lawyer/templates")({
  head: () => ({ meta: [{ title: "قوالب العقود — الوكيل" }] }),
  component: TemplatesPage,
});

type Template = {
  id: string;
  title: string;
  category: string;
  content: string;
  created_at: string;
};


const CATEGORIES: { value: string; label: string }[] = [
  { value: "lease", label: "إيجار" },
  { value: "sale", label: "بيع" },
  { value: "employment", label: "عمل" },
  { value: "poa", label: "وكالة" },
  { value: "service", label: "خدمات" },
  { value: "partnership", label: "شراكة" },
  { value: "loan", label: "قرض" },
  { value: "other", label: "أخرى" },
];

function catLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function downloadPdf(t: Template) {
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${t.title}</title>
<style>
@page { size: A4; margin: 2.2cm; }
body { font-family: "Amiri","Traditional Arabic","Times New Roman",serif; line-height: 2; font-size: 14pt; color:#111; }
h1 { text-align:center; font-size: 20pt; margin-bottom: 1.5em; }
pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; font-size: inherit; }
.footer { margin-top: 2em; padding-top:1em; border-top: 1px solid #999; font-size: 10pt; color:#666; text-align:center;}
@media print { .noprint { display:none; } }
.noprint{position:fixed;top:10px;left:10px;background:#c9a13b;color:#fff;border:0;padding:10px 16px;border-radius:8px;cursor:pointer;font-family:sans-serif;}
</style></head><body>
<button class="noprint" onclick="window.print()">طباعة / حفظ PDF</button>
<h1>${t.title}</h1>
<pre>${t.content.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!))}</pre>
<div class="footer">صدر عبر "الوكيل" — مساعد قانوني ذكي</div>
<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),400));</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

const PAGE_SIZE = 20;

function TemplatesPage() {
  const { userId } = useAuth();
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("");
  const [confirm, setConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [useTpl, setUseTpl] = useState<Template | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);

  async function reload() {
    if (!userId) return;
    setLoading(true);
    const { data, count } = await supabase
      .from("contract_templates")
      .select("*", { count: "exact" })
      .eq("lawyer_id", userId)
      .order("created_at", { ascending: false })
      .range(0, PAGE_SIZE - 1);
    const list = (data as Template[]) ?? [];
    setItems(list);
    setLoadedCount(list.length);
    setTotalCount(count ?? list.length);
    setLoading(false);
  }
  async function loadMore() {
    if (!userId) return;
    const { data } = await supabase
      .from("contract_templates")
      .select("*")
      .eq("lawyer_id", userId)
      .order("created_at", { ascending: false })
      .range(loadedCount, loadedCount + PAGE_SIZE - 1);
    const list = (data as Template[]) ?? [];
    setItems((xs) => [...xs, ...list]);
    setLoadedCount((n) => n + list.length);
  }

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId]);

  function askRemove(id: string) {
    setConfirm({ open: true, id });
  }
  async function doRemove() {
    if (!confirm.id) return;
    const id = confirm.id;
    setConfirm({ open: false, id: null });
    await supabase.from("contract_templates").delete().eq("id", id);
    reload();
  }

  async function copyText(body: string) {
    await navigator.clipboard.writeText(body);
    const { toast } = await import("sonner");
    toast.success("تم نسخ النص");
  }

  const list = filter ? items.filter((i) => i.category === filter) : items;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-gradient-gold font-bold inline-flex items-center gap-2">
            <FileText className="h-7 w-7" /> قوالب العقود
          </h1>
          <p className="text-foreground/60 text-sm mt-1">احفظ قوالبك واستخدمها مع كل قضية</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 bg-gold-gradient text-primary-foreground font-semibold px-4 py-2.5 rounded-lg shadow-gold">
          <Plus className="h-4 w-4" /> قالب جديد
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter("")} className={`text-xs px-3 py-1.5 rounded-full border ${!filter ? "bg-gold/15 border-gold text-gold" : "border-border text-foreground/60"}`}>الكل</button>
        {CATEGORIES.map((c) => (
          <button key={c.value} onClick={() => setFilter(c.value)} className={`text-xs px-3 py-1.5 rounded-full border ${filter === c.value ? "bg-gold/15 border-gold text-gold" : "border-border text-foreground/60"}`}>{c.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-surface border border-border rounded-xl h-48 animate-pulse" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-20 text-foreground/50">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          لا توجد قوالب بعد. أضف قالبك الأول.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((t) => (
            <div key={t.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="font-semibold text-sm flex-1">{t.title}</div>
                {t.category && <span className="text-[10px] bg-gold/15 text-gold px-2 py-0.5 rounded-full whitespace-nowrap">{catLabel(t.category)}</span>}
              </div>
              <div className="text-xs text-foreground/60 line-clamp-4 mb-3 flex-1">{t.content.slice(0, 200)}…</div>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => downloadPdf(t)} className="text-xs bg-gold/15 hover:bg-gold/25 text-gold border border-gold/40 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1">
                  <Download className="h-3 w-3" /> PDF
                </button>
                <button onClick={() => copyText(t.content)} className="text-xs bg-elevated hover:bg-surface border border-border rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1">
                  <Copy className="h-3 w-3" /> نسخ
                </button>
                <button onClick={() => setUseTpl(t)} className="text-xs bg-gold/15 hover:bg-gold/25 text-gold border border-gold/40 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1">
                  <Wand2 className="h-3 w-3" /> استخدم
                </button>
                <button onClick={() => askRemove(t.id)} className="text-xs text-red-300 hover:bg-red-500/10 border border-red-500/30 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1">
                  <Trash2 className="h-3 w-3" /> حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!filter && totalCount > loadedCount && !loading && (
        <button onClick={loadMore} className="w-full py-2.5 border border-gold/40 text-gold rounded-xl hover:bg-gold/10 text-sm transition">
          تحميل المزيد ({totalCount - loadedCount} متبقي)
        </button>
      )}

      {open && <NewTemplate userId={userId!} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); reload(); }} />}
      {useTpl && <UseTemplateDialog template={useTpl} onClose={() => setUseTpl(null)} />}
      <ConfirmDialog
        open={confirm.open}
        title="حذف القالب"
        desc="سيتم حذف هذا القالب نهائياً."
        onConfirm={doRemove}
        onCancel={() => setConfirm({ open: false, id: null })}
      />
    </div>
  );
}

function NewTemplate({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  async function generateWithAI() {
    if (!aiPrompt.trim() || aiBusy) return;
    setAiBusy(true);
    try {
      const r = await chatFetch({
        tool: "draft",
        messages: [
          {
            role: "user",
            content: `صِغ قالب عقد جاهز للاستخدام بصيغة عربية فصحى. اجعل الحقول القابلة للملء بين قوسين مزدوجين مثل {{اسم_المؤجر}} و {{التاريخ}} و {{المبلغ}}. وصف القالب: ${aiPrompt.trim()}`,
          },
        ],
      });
      const data = (await r.json()) as { text?: string };
      if (data.text) {
        setContent(data.text);
        if (!title.trim()) setTitle(aiPrompt.trim().slice(0, 60));
      }
    } catch {
      const { toast } = await import("sonner");
      toast.error("تعذر الاتصال بالذكاء الاصطناعي");
    } finally {
      setAiBusy(false);
    }
  }

  async function save() {
    if (!title.trim() || !content.trim() || saving) return;
    setSaving(true);
    const { error } = await supabase.from("contract_templates").insert({
      lawyer_id: userId,
      title: title.trim(),
      category: category || "other",
      content: content.trim(),
    });
    if (error) {
      const { toast } = await import("sonner");
      toast.error("تعذر حفظ القالب: " + error.message);
      setSaving(false);
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-2xl w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">قالب جديد</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-foreground/60" /></button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان القالب *" className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm">
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <div className="bg-elevated/60 border border-gold-soft/40 rounded-lg p-3 space-y-2">
          <div className="text-xs text-gold inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> توليد بالذكاء الاصطناعي</div>
          <div className="flex gap-2">
            <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="مثال: عقد إيجار شقة سكنية لمدة سنة" className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-xs" />
            <button type="button" onClick={generateWithAI} disabled={!aiPrompt.trim() || aiBusy} className="text-xs bg-gold-gradient text-primary-foreground font-semibold px-3 py-2 rounded-lg disabled:opacity-50">
              {aiBusy ? "..." : "🤖 توليد"}
            </button>
          </div>
        </div>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="نص العقد كاملاً…" rows={12} className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm font-mono" />
        <button onClick={save} disabled={!title.trim() || !content.trim() || saving} className="w-full bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-lg shadow-gold disabled:opacity-50">
          {saving ? "جاري الحفظ..." : "حفظ القالب"}
        </button>
      </div>
    </div>
  );
}

function UseTemplateDialog({ template, onClose }: { template: Template; onClose: () => void }) {
  const vars = Array.from(new Set(Array.from(template.content.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)).map((m) => m[1])));
  const [values, setValues] = useState<Record<string, string>>({});
  const rendered = vars.reduce(
    (acc, v) => acc.replace(new RegExp(`\\{\\{\\s*${v.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*\\}\\}`, "g"), values[v] ?? `{{${v}}}`),
    template.content,
  );
  async function copyAll() {
    await navigator.clipboard.writeText(rendered);
    const { toast } = await import("sonner");
    toast.success("تم نسخ النص الكامل");
    await supabase.rpc; // noop guard
    await supabase.from("contract_templates").update({ updated_at: new Date().toISOString() }).eq("id", template.id);
  }
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-auto space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">{template.title}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-foreground/60" /></button>
        </div>
        {vars.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-2">
            {vars.map((v) => (
              <div key={v}>
                <label className="text-xs text-foreground/60 mb-1 block">{v.replace(/_/g, " ")}</label>
                <input
                  value={values[v] ?? ""}
                  onChange={(e) => setValues({ ...values, [v]: e.target.value })}
                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
        )}
        <pre className="bg-elevated border border-border rounded-lg p-4 text-sm whitespace-pre-wrap font-sans max-h-80 overflow-auto">{rendered}</pre>
        <button onClick={copyAll} className="w-full bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-lg shadow-gold">
          📋 نسخ النص الكامل
        </button>
      </div>
    </div>
  );
}
