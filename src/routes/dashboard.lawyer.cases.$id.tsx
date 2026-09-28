import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Trash2, Loader2, Plus, Upload, X, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { chatFetch } from "@/lib/chat-client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { caseTypeLabel, handleSupabaseError } from "@/lib/utils";
import { ConfirmDialog } from "@/components/DashboardShared";

export const Route = createFileRoute("/dashboard/lawyer/cases/$id")({
  head: () => ({ meta: [{ title: "تفاصيل القضية — الوكيل" }] }),
  component: CaseDetail,
});

type Tab = "info" | "hearings" | "docs" | "fees" | "notes" | "ai" | "deadlines" | "tasks" | "time";

const inputCls = "w-full bg-elevated border border-gold-soft/40 focus:border-gold rounded-lg px-3 py-2.5 text-foreground outline-none text-sm";

const STATUS_OPTIONS = [
  { v: "active", l: "جارية" },
  { v: "pending", l: "معلقة" },
  { v: "won", l: "رابحة" },
  { v: "lost", l: "خاسرة" },
  { v: "closed", l: "منتهية" },
] as const;

function CaseDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [c, setC] = useState<any>(null);
  const [hearings, setHearings] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [caseDeadlines, setCaseDeadlines] = useState<any[]>([]);
  const [caseTasks, setCaseTasks] = useState<any[]>([]);
  const [caseTimeEntries, setCaseTimeEntries] = useState<any[]>([]);
  const [caseExpenses, setCaseExpenses] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("info");
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const notesTimer = useRef<any>(null);

  const [aiMessages, setAiMessages] = useState<{ role: string; content: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [caseAnalysis, setCaseAnalysis] = useState<{ text: string; included: string[]; skipped: string[] } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [quickExpenseOpen, setQuickExpenseOpen] = useState(false);
  const [quickDeadlineOpen, setQuickDeadlineOpen] = useState(false);
  const [quickTaskOpen, setQuickTaskOpen] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; desc?: string; onConfirm: () => void;
  }>({ open: false, title: "", onConfirm: () => {} });

  function askConfirm(title: string, desc: string, onConfirm: () => void) {
    setConfirmState({ open: true, title, desc, onConfirm });
  }
  function closeConfirm() {
    setConfirmState((s) => ({ ...s, open: false }));
  }

  const load = async () => {
    const [caseRes, hearRes, docsRes, rcpRes, deadRes, taskRes, teRes, expRes] = await Promise.all([
      supabase.from("cases")
        .select("*, client_profile:profiles!client_id(full_name, phone, avatar_url), manual_client:manual_clients!manual_client_id(id, full_name, phone, email, platform_user_id)")
        .eq("id", id).single(),
      supabase.from("hearings").select("*").eq("case_id", id).order("hearing_date", { ascending: false }),
      supabase.from("documents").select("*").eq("case_id", id).order("created_at", { ascending: false }),
      supabase.from("invoices").select("*")
        .eq("case_id", id)
        .eq("status", "paid")
        .like("invoice_number", "RCP-%")
        .order("created_at", { ascending: false }),
      supabase.from("deadlines").select("*").eq("case_id", id).order("due_date", { ascending: true }),
      supabase.from("tasks").select("*").eq("case_id", id).order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("time_entries").select("*").eq("case_id", id).order("created_at", { ascending: false }),
      supabase.from("case_expenses").select("*").eq("case_id", id).order("created_at", { ascending: false }),
    ]);
    setC(caseRes.data);
    setNotes((caseRes.data as any)?.notes_private ?? "");
    setHearings(hearRes.data ?? []);
    setDocs(docsRes.data ?? []);
    setReceipts(rcpRes.data ?? []);
    setCaseDeadlines(deadRes.data ?? []);
    setCaseTasks(taskRes.data ?? []);
    setCaseTimeEntries(teRes.data ?? []);
    setCaseExpenses(expRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); setAiMessages([]); }, [id]);

  // Initialize AI context once
  useEffect(() => {
    if (tab === "ai" && aiMessages.length === 0 && c) {
      const typeLbl = c.type ? caseTypeLabel(c.type) : "عام";
      const ctx = [
        `📋 بيانات القضية:`,
        `العنوان: ${c.title || "—"}`,
        `النوع: ${typeLbl}`,
        `المحكمة: ${c.court ?? "غير محدد"}`,
        `الحالة: ${c.status ?? "جارية"}`,
        c.case_number ? `رقم القضية: ${c.case_number}` : null,
        c.opposing_party ? `الطرف الآخر: ${c.opposing_party}` : null,
        c.judge ? `القاضي: ${c.judge}` : null,
        c.facts ? `الوقائع: ${c.facts}` : null,
      ].filter(Boolean).join("\n");
      setAiMessages([{
        role: "assistant",
        content: `أنا مساعدك القانوني الذكي. لقد اطلعت على ملف وبيانات القضية:\n\n${ctx}\n\nما الذي تريد تحليله أو السؤال عنه بخصوص هذه القضية؟`,
      }]);
    }
  }, [tab, c, aiMessages.length]);

  function deleteCase() {
    askConfirm("حذف القضية", "هل أنت متأكد؟ ستختفي القضية من قوائمك (يمكن استعادتها لاحقاً).", async () => {
      closeConfirm();
      const { error } = await supabase.from("cases").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) return toast.error(error.message);
      toast.success("تم حذف القضية");
      navigate({ to: "/dashboard/lawyer/cases" });
    });
  }

  function openEdit() {
    if (!c) return;
    setEditData({
      title: c.title ?? "",
      court: c.court ?? "",
      court_department: c.court_department ?? "",
      next_hearing: c.next_hearing ? String(c.next_hearing).split("T")[0] : "",
      opposing_party: c.opposing_party ?? "",
      opposing_lawyer: c.opposing_lawyer ?? "",
      judge: c.judge ?? "",
      total_fees: String(c.total_fees ?? ""),
      facts: c.facts ?? "",
    });
    setEditMode(true);
  }

  async function saveEdit() {
    setEditSaving(true);
    try {
      const { error } = await supabase.from("cases").update({
        title: editData.title,
        court: editData.court || null,
        court_department: editData.court_department || null,
        next_hearing: editData.next_hearing || null,
        opposing_party: editData.opposing_party || null,
        opposing_lawyer: editData.opposing_lawyer || null,
        judge: editData.judge || null,
        total_fees: Number(editData.total_fees) || 0,
        facts: editData.facts || null,
      }).eq("id", id);
      if (error) throw error;
      toast.success("تم تحديث بيانات القضية ✓");
      setEditMode(false);
      load();
    } catch (e) {
      toast.error(handleSupabaseError(e));
    } finally {
      setEditSaving(false);
    }
  }

  async function changeStatus(newStatus: string) {
    setChangingStatus(true);
    const { error } = await supabase.from("cases").update({ status: newStatus }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم تغيير حالة القضية ✓"); load(); }
    setChangingStatus(false);
  }

  async function addHearing(e: React.FormEvent) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    const next_hearing = fd.get("next_hearing_date") as string;
    const { data: inserted, error } = await supabase.from("hearings").insert({
      case_id: id,
      hearing_date: fd.get("date") as string,
      court: (fd.get("court") as string) || null,
      judge: (fd.get("judge") as string) || null,
      result: (fd.get("result") as string) || null,
      decision: (fd.get("decision") as string) || null,
      notes: (fd.get("notes") as string) || null,
      next_hearing_date: next_hearing || null,
    }).select("id").single();
    if (error) return toast.error(error.message);
    if (next_hearing) {
      await supabase.from("cases").update({ next_hearing }).eq("id", id);
    }
    if (inserted?.id) {
      try {
        const { notifyHearingScheduled } = await import("@/lib/telegram-notify.functions");
        notifyHearingScheduled({ data: { hearingId: inserted.id } }).catch(() => {});
      } catch {}
    }
    toast.success("تم إضافة الجلسة ✓");
    form.reset();
    load();
  }

  function deleteHearing(hid: string) {
    askConfirm("حذف الجلسة", "سيتم حذف بيانات هذه الجلسة نهائياً.", async () => {
      closeConfirm();
      await supabase.from("hearings").delete().eq("id", hid);
      load();
    });
  }

  async function uploadFile(file: File) {
    if (!c) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("الملف يتجاوز 10MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${c.lawyer_id}/${id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("case-files").upload(path, file, { upsert: false });
      if (uploadErr) throw uploadErr;
      const { error: dbErr } = await supabase.from("documents").insert({
        name: file.name,
        file_url: path,
        file_size: file.size,
        mime_type: file.type,
        case_id: id,
        uploaded_by: c.lawyer_id,
        type: file.type.includes("pdf") ? "case_document" : "other",
      });
      if (dbErr) throw dbErr;
      toast.success("تم رفع الملف ✓");
      load();
    } catch (e) {
      toast.error(handleSupabaseError(e));
    } finally {
      setUploading(false);
    }
  }

  function deleteDoc(d: any) {
    askConfirm("حذف الملف", `سيتم حذف "${d.name}" نهائياً.`, async () => {
      closeConfirm();
      if (d.file_url) await supabase.storage.from("case-files").remove([d.file_url]);
      await supabase.from("documents").delete().eq("id", d.id);
      load();
    });
  }

  async function downloadDoc(path: string, name: string) {
    const { data, error } = await supabase.storage.from("case-files").createSignedUrl(path, 3600);
    if (error || !data) return toast.error("فشل إنشاء رابط التحميل");
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name;
    a.click();
  }

  function handleNotesChange(v: string) {
    setNotes(v);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      setNotesSaving(true);
      await supabase.from("cases").update({ notes_private: v } as any).eq("id", id);
      setNotesSaving(false);
    }, 1500);
  }

  async function sendAI() {
    const text = aiInput.trim();
    if (!text || aiLoading) return;
    const msgs = [...aiMessages, { role: "user", content: text }];
    setAiMessages(msgs);
    setAiInput("");
    setAiLoading(true);
    try {
      const caseCtx = c ? [
        `📋 بيانات القضية:`,
        `العنوان: ${c.title || "—"}`,
        `النوع: ${c.type ? caseTypeLabel(c.type) : "عام"}`,
        `المحكمة: ${c.court || "—"}${c.court_department ? ` — الدائرة: ${c.court_department}` : ""}`,
        `القاضي: ${c.judge || "—"}`,
        `الطرف الآخر: ${c.opposing_party || "—"}${c.opposing_lawyer ? ` — محاميه: ${c.opposing_lawyer}` : ""}`,
        `الحالة: ${c.status || "جارية"}`,
        c.next_hearing ? `الجلسة القادمة: ${c.next_hearing}` : "",
        c.facts ? `الوقائع: ${c.facts}` : "",
        c.description ? `التفاصيل: ${c.description}` : "",
        notes ? `ملاحظات المحامي: ${notes}` : "",
      ].filter(Boolean).join("\n") : "";

      const systemPrompt = `أنت مستشار قانوني ومحامٍ بالنقض خبير تقدم استشارات استراتيجية قانونية وتكتيكية للمحامي المسؤول عن القضية.
${caseCtx}

أجب كمستشار قانوني ومحامٍ بالنقض خبير: قدّم حلولاً، دفوعاً شكلية وموضوعية، استراتيجيات إجرائية، واقتراحات عملية تخدم موكلنا وتساعد في الفوز بالقضية.`;

      const r = await chatFetch({
        messages: [
          { role: "system", content: systemPrompt },
          ...msgs.slice(-8),
        ],
        tool: "case_strategy",
      });
      const data = await r.json();
      setAiMessages((m) => [...m, { role: "assistant", content: data.text || "لم أتمكن من الحصول على إجابة، يرجى المحاولة ثانية." }]);
    } catch {
      setAiMessages((m) => [...m, { role: "assistant", content: "حدث خطأ في الاتصال بالمساعد الذكي. حاول مجدداً." }]);
    } finally {
      setAiLoading(false);
    }
  }

  async function runCaseAnalysis() {
    if (analyzing || !c) return;
    setAnalyzing(true);
    setCaseAnalysis(null);
    try {
      const caseCtx = [
        `📋 بيانات القضية:`,
        `العنوان: ${c.title || "—"}`,
        `نوع القضية: ${c.type ? caseTypeLabel(c.type) : "عام"}`,
        `رقم القضية: ${c.case_number || "—"}`,
        `المحكمة: ${c.court || "—"}${c.court_department ? ` — الدائرة: ${c.court_department}` : ""}`,
        `القاضي: ${c.judge || "—"}`,
        `الطرف الآخر: ${c.opposing_party || "—"}${c.opposing_lawyer ? ` — محاميه: ${c.opposing_lawyer}` : ""}`,
        `الحالة: ${c.status || "جارية"}`,
        c.next_hearing ? `الجلسة القادمة: ${c.next_hearing}` : "",
        c.facts ? `\nالوقائع:\n${c.facts}` : "",
        c.description ? `\nالوصف والملحوظات:\n${c.description}` : "",
        c.notes_private ? `\nملاحظات المحامي الخاصة:\n${c.notes_private}` : "",
      ].filter(Boolean).join("\n");

      const hearingsTxt = hearings.length
        ? "\n\nسجل الجلسات:\n" + hearings.map((h: any) => `- ${h.hearing_date || h.session_date}: ${h.decision || h.result || "—"}${h.notes ? ` (${h.notes})` : ""}`).join("\n")
        : "";

      const deadlinesTxt = caseDeadlines.length
        ? "\n\nالآجال القانونية:\n" + caseDeadlines.map((x: any) => `- ${x.title} — ${x.due_date} — ${x.status}`).join("\n")
        : "";

      const docsTxt = docs.length
        ? "\n\nالمستندات والملفات المرفقة:\n" + docs.map((d: any) => `- ${d.name || d.title}`).join("\n")
        : "";

      const prompt = `أنت مستشار قانوني ومحامٍ بالنقض خبير. يرجى تقديم تحليل استراتيجي قانوني شامل للقضية التالية:
${caseCtx}
${hearingsTxt}
${deadlinesTxt}
${docsTxt}

المطلوب تقديم تحليل مفصل ومرتب بالعربية الفصحى وفق العناصر الآتية:
1. التكييف القانوني وملخص الوقائع.
2. نقاط القوة والأسانيد القانونية المؤيدة لموقفنا.
3. نقاط الضعف والمخاطر والدفوع المحتملة من الخصم.
4. خطة استراتيجية الدفاع وخارطة الطريق الإجرائية.
5. الدفوع والمذكرات المطلوب إعدادها وتقديمها.
6. المستندات التكميلية المطلوب تجهيزها.
7. تقدير احتمالية النجاح والمدة الزمنية المتوقعة.`;

      const r = await chatFetch({
        messages: [{ role: "user", content: prompt }],
        tool: "case_strategy",
      });

      const data = await r.json();
      if (!data.text) {
        toast.error("تعذر إتمام التحليل حالياً، يرجى المحاولة لاحقاً");
        return;
      }

      setCaseAnalysis({
        text: data.text,
        included: docs.map((d) => d.name || "مستند"),
        skipped: [],
      });
      toast.success("تم إتمام التحليل الاستراتيجي للقضية بنجاح ✓");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }


  async function addPayment(e: React.FormEvent) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    const amount = Number(fd.get("amount"));
    if (!amount || amount <= 0) return toast.error("أدخل مبلغاً صحيحاً");
    const newPaid = (Number(c?.paid_fees) || 0) + amount;
    const year = new Date().getFullYear();
    const ts = Date.now().toString().slice(-6);

    const { error: caseErr } = await supabase.from("cases").update({ paid_fees: newPaid }).eq("id", id);
    if (caseErr) return toast.error(caseErr.message);

    await supabase.from("invoices").insert({
      invoice_number: `RCP-${year}-${ts}`,
      lawyer_id: c.lawyer_id,
      client_id: c.client_id ?? null,
      case_id: id,
      amount,
      paid_amount: amount,
      tax_percent: 0,
      tax_amount: 0,
      total_amount: amount,
      status: "paid",
      notes: `دفعة من قضية: ${c.title}`,
      line_items: [{ description: "دفعة أتعاب", quantity: 1, price: amount }],
    });

    toast.success("تم تسجيل الدفعة ✓");
    form.reset();
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }
  if (!c) {
    return (
      <div className="text-center py-20">
        <div className="text-4xl mb-4">⚖️</div>
        <p className="text-foreground/60">القضية غير موجودة</p>
        <Link to="/dashboard/lawyer/cases" className="text-gold hover:underline text-sm mt-2 inline-block">العودة للقضايا</Link>
      </div>
    );
  }

  const total = Number(c.total_fees) || 0;
  const paid = Number(c.paid_fees) || 0;
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;

  const TABS: { k: Tab; l: string }[] = [
    { k: "info", l: "التفاصيل" },
    { k: "hearings", l: `الجلسات (${hearings.length})` },
    { k: "deadlines", l: `الآجال (${caseDeadlines.length})` },
    { k: "tasks", l: `المهام (${caseTasks.length})` },
    { k: "time", l: "الوقت والمصروفات" },
    { k: "docs", l: `المستندات (${docs.length})` },
    { k: "fees", l: "الأتعاب" },
    { k: "notes", l: "ملاحظات" },
    { k: "ai", l: "🤖 AI" },
  ];

  const totalTimeMins = caseTimeEntries.reduce((s, e) => s + Number(e.duration_minutes || 0), 0);
  const billableTimeMins = caseTimeEntries.filter((e) => e.is_billable).reduce((s, e) => s + Number(e.duration_minutes || 0), 0);
  const billableValue = caseTimeEntries.filter((e) => e.is_billable).reduce((s, e) => s + Number(e.billed_amount || 0), 0);
  const totalExpenses = caseExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const reimbursedExpenses = caseExpenses.filter((e) => e.is_reimbursed).reduce((s, e) => s + Number(e.amount || 0), 0);
  const pendingExpenses = totalExpenses - reimbursedExpenses;

  function daysUntil(due: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(due); d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - today.getTime()) / 86400000);
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs text-foreground/50 mb-1 inline-flex items-center gap-2">
            رقم: {c.case_number ?? "—"}
            {c.case_number && (
              <button
                onClick={() => { navigator.clipboard.writeText(c.case_number); toast.success("تم نسخ الرقم"); }}
                className="text-foreground/40 hover:text-gold" title="نسخ الرقم">
                📋
              </button>
            )}
          </div>
          <h1 className="font-display text-3xl text-gradient-gold font-bold">{c.title}</h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <StatusBadge status={c.status} />
            {(() => {
              const mc = c.manual_client;
              const name = c.client_profile?.full_name ?? mc?.full_name;
              if (!name) return null;
              const external = !c.client_id && mc;
              return (
                <span className="text-xs text-foreground/60 inline-flex items-center gap-1">
                  الموكل: <span className="text-gold font-medium">{name}</span>
                  {external && <span className="text-[10px] bg-gold/10 text-gold/70 px-1.5 py-0.5 rounded">خارجي</span>}
                  {external && mc?.platform_user_id && <span className="text-[10px] text-green-400">✓ مرتبط</span>}
                </span>
              );
            })()}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={openEdit}
            className="inline-flex items-center gap-2 border border-gold/40 text-gold px-4 py-2 rounded-lg hover:bg-gold/10 transition text-sm">
            ✏️ تعديل
          </button>
          <button onClick={deleteCase}
            className="inline-flex items-center gap-2 border border-destructive/40 text-destructive px-4 py-2 rounded-lg hover:bg-destructive/10 transition text-sm">
            <Trash2 className="h-4 w-4" /> حذف
          </button>
          <Link to="/dashboard/lawyer/cases"
            className="text-sm inline-flex items-center gap-2 text-foreground/70 hover:text-gold border border-border px-4 py-2 rounded-lg">
            العودة <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(({ k, l }) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 transition ${tab === k ? "border-gold text-gold font-semibold" : "border-transparent text-foreground/60 hover:text-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="bg-surface border border-border rounded-2xl p-6 space-y-3">
          <Row k="النوع" v={caseTypeLabel(c.type)} />
          <Row k="المحكمة" v={c.court} />
          <Row k="الدائرة" v={c.court_department} />
          <Row k="القاضي" v={c.judge} />
          <Row k="الطرف الآخر" v={c.opposing_party} />
          <Row k="محامي الخصم" v={c.opposing_lawyer} />
          <Row k="الموكل" v={c.client_profile?.full_name ?? c.manual_client?.full_name} />
          <Row k="هاتف الموكل" v={c.client_profile?.phone ?? c.manual_client?.phone} />
          {c.manual_client && !c.client_id && (
            <div className="mt-2 p-3 bg-gold/5 border border-gold/20 rounded-xl space-y-2">
              <div className="text-xs text-foreground/70">
                {c.manual_client.platform_user_id
                  ? "✅ موكل خارجي مرتبط بحساب على المنصة — يرى القضية في داشبورده"
                  : "موكل خارجي — لا يرى هذه القضية لأنه ليس مسجّلاً على المنصة"}
              </div>
              {!c.manual_client.platform_user_id && (
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={!c.manual_client.email}
                    title={c.manual_client.email ? undefined : "أضف بريد الموكل في صفحة الموكلين أولاً — يُستخدم للتحقق من هويته"}
                    onClick={() => {
                      if (!c.manual_client.email) {
                        toast.error("أضف بريد الموكل الإلكتروني أولاً — يُستخدم للتحقق عند ربط الحساب");
                        return;
                      }
                      const link = `${window.location.origin}/auth?invite=${c.manual_client.id}&type=manual_client`;
                      navigator.clipboard.writeText(link);
                      toast.success("تم نسخ رابط الدعوة ✓");
                    }}
                    className="text-xs bg-gold-gradient text-primary-foreground px-3 py-1.5 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    📋 نسخ رابط الدعوة
                  </button>
                  {c.manual_client.phone && c.manual_client.email && (
                    <a
                      href={`https://wa.me/${String(c.manual_client.phone).replace(/\D/g, "")}?text=${encodeURIComponent(
                        `مرحباً ${c.manual_client.full_name}،\nسجّل في منصة الوكيل لمتابعة قضيتك: ${window.location.origin}/auth?invite=${c.manual_client.id}&type=manual_client`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#25D366] border border-[#25D366]/40 px-3 py-1.5 rounded-lg hover:bg-[#25D366]/10"
                    >
                      💬 دعوة عبر واتساب
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
          <Row k="الجلسة القادمة" v={c.next_hearing ? new Date(c.next_hearing).toLocaleDateString("ar-EG") : null} />
          {c.facts && (
            <div className="pt-3 border-t border-border">
              <div className="text-xs text-foreground/50 mb-2">الوقائع</div>
              <p className="text-foreground/80 whitespace-pre-wrap leading-relaxed text-sm">{c.facts}</p>
            </div>
          )}
          <div className="pt-3 border-t border-border">
            <div className="text-xs text-foreground/60 mb-3">تغيير حالة القضية</div>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button key={opt.v} disabled={c.status === opt.v || changingStatus}
                  onClick={() => changeStatus(opt.v)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition disabled:opacity-40 ${
                    c.status === opt.v
                      ? "bg-gold/15 border-gold text-gold font-semibold"
                      : "bg-surface/60 border-border text-foreground/60 hover:border-gold/40"
                  }`}>
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "hearings" && (
        <div className="space-y-4">
          <form onSubmit={addHearing} className="bg-surface border border-border rounded-2xl p-5 space-y-3">
            <div className="font-semibold text-gold inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> إضافة جلسة
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-foreground/60 mb-1">التاريخ والوقت *</label>
                <input name="date" type="datetime-local" required className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-foreground/60 mb-1">المحكمة</label>
                <input name="court" placeholder="المحكمة" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-foreground/60 mb-1">القاضي</label>
                <input name="judge" placeholder="القاضي" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-foreground/60 mb-1">الجلسة القادمة</label>
                <input name="next_hearing_date" type="date" className={inputCls} />
              </div>
            </div>
            <input name="result" placeholder="النتيجة" className={inputCls} />
            <input name="decision" placeholder="القرار" className={inputCls} />
            <textarea name="notes" placeholder="ملاحظات الجلسة" rows={2} className={inputCls} />
            <button className="bg-gold-gradient text-primary-foreground font-semibold px-4 py-2 rounded-lg text-sm">
              حفظ الجلسة
            </button>
          </form>

          {hearings.length === 0 ? (
            <div className="text-center text-foreground/50 py-8">لا توجد جلسات بعد</div>
          ) : (
            <div className="space-y-2">
              {hearings.map((h) => (
                <div key={h.id} className="bg-surface border border-border rounded-xl p-4">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="text-sm text-gold font-semibold mb-1">
                        {new Date(h.hearing_date).toLocaleString("ar-EG")}
                      </div>
                      {h.court && <div className="text-xs text-foreground/60">المحكمة: {h.court}</div>}
                      {h.judge && <div className="text-xs text-foreground/60">القاضي: {h.judge}</div>}
                      {h.result && <div className="text-sm text-foreground/80 mt-1">النتيجة: {h.result}</div>}
                      {h.decision && <div className="text-sm text-foreground/80">القرار: {h.decision}</div>}
                      {h.next_hearing_date && (
                        <div className="text-xs text-gold/70 mt-1">
                          الجلسة القادمة: {new Date(h.next_hearing_date).toLocaleDateString("ar-EG")}
                        </div>
                      )}
                      {h.notes && <div className="text-xs text-foreground/60 mt-1">{h.notes}</div>}
                    </div>
                    <button onClick={() => deleteHearing(h.id)} className="text-foreground/40 hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "docs" && (
        <div className="space-y-4">
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gold/30 hover:border-gold/60 rounded-2xl p-10 text-center cursor-pointer transition"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) uploadFile(file);
            }}
          >
            <input ref={fileRef} type="file" className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
              }} />
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-gold mx-auto mb-2" />
            ) : (
              <Upload className="h-8 w-8 text-gold/60 mx-auto mb-2" />
            )}
            <div className="text-sm text-foreground/60">
              {uploading ? "جاري الرفع..." : "اسحب ملفاً هنا أو انقر للاختيار"}
            </div>
            <div className="text-xs text-foreground/40 mt-1">PDF, Word, JPG, PNG — حد أقصى 10MB</div>
          </div>

          {docs.length === 0 ? (
            <div className="text-center text-foreground/50 py-8">لا توجد مستندات بعد</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {docs.map((d) => (
                <div key={d.id} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
                  <div className="text-2xl">
                    {d.mime_type?.includes("pdf") ? "📄" : d.mime_type?.includes("image") ? "🖼️" : "📝"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">{d.name}</div>
                    <div className="text-xs text-foreground/50">
                      {d.file_size ? `${(d.file_size / 1024).toFixed(0)} KB` : ""} •{" "}
                      {new Date(d.created_at).toLocaleDateString("ar-EG")}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => downloadDoc(d.file_url, d.name)}
                      className="text-xs text-gold hover:underline px-2 py-1">تحميل</button>
                    <button onClick={() => deleteDoc(d)}
                      className="text-foreground/40 hover:text-destructive px-2">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "fees" && (
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-2xl p-6">
            <div className="grid grid-cols-3 gap-4 mb-5 text-center">
              <div>
                <div className="text-xs text-foreground/60 mb-1">الإجمالي المتفق عليه</div>
                <div className="text-2xl font-bold text-gradient-gold">{total.toLocaleString()} ج</div>
              </div>
              <div>
                <div className="text-xs text-foreground/60 mb-1">المدفوع</div>
                <div className="text-2xl font-bold text-green-400">{paid.toLocaleString()} ج</div>
              </div>
              <div>
                <div className="text-xs text-foreground/60 mb-1">المتبقي</div>
                <div className="text-2xl font-bold text-destructive">{(total - paid).toLocaleString()} ج</div>
              </div>
            </div>
            <div className="h-2 bg-elevated rounded-full overflow-hidden mb-2">
              <div className="h-full bg-gold-gradient transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-xs text-foreground/50 text-center">{pct.toFixed(0)}% مدفوع</div>
          </div>

          {Number(c.success_fee_percent) > 0 && (
            <SuccessFeeBox
              percent={Number(c.success_fee_percent)}
              caseId={c.id}
              clientId={c.client_id}
              lawyerId={c.lawyer_id}
            />
          )}

          <form onSubmit={addPayment} className="bg-surface border border-border rounded-2xl p-5 space-y-3">
            <div className="font-semibold text-gold">تسجيل دفعة جديدة</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-foreground/60 mb-1">المبلغ (ج.م) *</label>
                <input name="amount" type="number" min="1" required placeholder="0" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-foreground/60 mb-1">طريقة الدفع</label>
                <select name="method" className={inputCls}>
                  <option value="cash">كاش</option>
                  <option value="transfer">تحويل بنكي</option>
                  <option value="check">شيك</option>
                </select>
              </div>
            </div>
            <input name="notes" placeholder="ملاحظة (اختياري)" className={inputCls} />
            <button className="bg-gold-gradient text-primary-foreground font-semibold px-5 py-2 rounded-lg text-sm">
              تسجيل الدفعة
            </button>
          </form>

          {receipts.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl p-5">
              <div className="font-semibold text-foreground/70 text-sm mb-3">سجل المدفوعات</div>
              <div className="space-y-2">
                {receipts.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0">
                    <div>
                      <div className="text-sm font-medium text-foreground">{Number(r.amount).toLocaleString()} ج</div>
                      <div className="text-xs text-foreground/50">
                        {new Date(r.created_at).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}
                      </div>
                    </div>
                    <div className="text-xs text-foreground/40 font-mono">{r.invoice_number}</div>
                    <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                      ✓ مُسجَّل
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "deadlines" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <button
              onClick={() => setQuickDeadlineOpen(true)}
              className="bg-gold-gradient text-primary-foreground font-semibold px-4 py-2 rounded-lg text-sm shadow-gold inline-flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> إضافة أجل جديد
            </button>
            <Link to="/dashboard/lawyer/deadlines" className="text-xs text-gold hover:underline">
              فتح جدول الآجال الكامل ←
            </Link>
          </div>

          {caseDeadlines.length === 0 ? (
            <div className="text-center py-12 text-foreground/50 border border-dashed border-border rounded-xl">لا توجد آجال قانونية مسجلة لهذه القضية</div>
          ) : caseDeadlines.map((d) => {
            const left = daysUntil(d.due_date);
            const cls = left < 0 ? "bg-red-500/15 border-red-500/40 text-red-300"
              : left <= 3 ? "bg-red-500/10 border-red-500/30 text-red-200"
              : left <= 7 ? "bg-orange-500/10 border-orange-500/30 text-orange-200"
              : left <= 30 ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-200"
              : "bg-green-500/10 border-green-500/30 text-green-200";
            return (
              <div key={d.id} className={`border rounded-xl p-4 ${cls} flex items-center justify-between flex-wrap gap-3`}>
                <div>
                  <div className="font-semibold">{d.title}</div>
                  <div className="text-xs opacity-80 mt-1">
                    موعد: {new Date(d.due_date).toLocaleDateString("ar-EG")} •
                    {left < 0 ? ` متأخر ${Math.abs(left)} يوم` : ` متبقي ${left} يوم`}
                    {d.court_name && ` • المحكمة: ${d.court_name}`}
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-surface/40">{d.status === "completed" ? "مكتمل" : d.status === "expired" ? "منتهي" : "نشط"}</span>
              </div>
            );
          })}
        </div>
      )}

      {tab === "tasks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <button
              onClick={() => setQuickTaskOpen(true)}
              className="bg-gold-gradient text-primary-foreground font-semibold px-4 py-2 rounded-lg text-sm shadow-gold inline-flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> إضافة مهمة جديدة
            </button>
            <Link to="/dashboard/lawyer/tasks" className="text-xs text-gold hover:underline">
              فتح لوحة المهام الكاملة ←
            </Link>
          </div>

          {caseTasks.length === 0 ? (
            <div className="text-center py-12 text-foreground/50 border border-dashed border-border rounded-xl">لا توجد مهام مسجلة لهذه القضية</div>
          ) : caseTasks.map((t) => (
            <div key={t.id} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <div className="font-medium">{t.title}</div>
                {t.description && <div className="text-xs text-foreground/70 mt-1">{t.description}</div>}
                {t.due_date && <div className="text-xs text-foreground/50 mt-1">موعد: {new Date(t.due_date).toLocaleDateString("ar-EG")}</div>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${
                  t.priority === "urgent" ? "bg-red-500/20 text-red-300" :
                  t.priority === "high" ? "bg-orange-500/15 text-orange-300" :
                  t.priority === "medium" ? "bg-blue-500/15 text-blue-300" :
                  "bg-foreground/10 text-foreground/60"
                }`}>{t.priority === "urgent" ? "طارئة" : t.priority === "high" ? "عالية" : t.priority === "medium" ? "متوسطة" : "منخفضة"}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-elevated text-foreground/70">{
                  t.status === "done" ? "✓ مكتملة" :
                  t.status === "in_progress" ? "جاري" :
                  t.status === "cancelled" ? "ملغاة" : "معلقة"
                }</span>
                {t.status !== "done" && (
                  <button onClick={async () => {
                    await supabase.from("tasks").update({ status: "done" }).eq("id", t.id);
                    setCaseTasks((xs) => xs.map((x) => x.id === t.id ? { ...x, status: "done" } : x));
                  }} className="text-xs text-gold hover:underline">إنهاء</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "time" && (
        <div className="space-y-6">
          <div>
            <h3 className="font-display text-lg text-gold mb-3">⏱️ الوقت</h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-surface border border-border rounded-xl p-3">
                <div className="text-xs text-foreground/60">إجمالي</div>
                <div className="font-bold text-lg">{(totalTimeMins / 60).toFixed(1)} س</div>
              </div>
              <div className="bg-surface border border-border rounded-xl p-3">
                <div className="text-xs text-foreground/60">قابل للفوترة</div>
                <div className="font-bold text-lg text-gold">{(billableTimeMins / 60).toFixed(1)} س</div>
              </div>
              <div className="bg-surface border border-border rounded-xl p-3">
                <div className="text-xs text-foreground/60">قيمة الساعات</div>
                <div className="font-bold text-lg text-gold">{Math.round(billableValue).toLocaleString("ar-EG")} ج.م</div>
              </div>
            </div>
            {caseTimeEntries.length === 0 ? (
              <div className="text-center py-6 text-foreground/50 text-sm">لا توجد إدخالات</div>
            ) : (
              <div className="space-y-1.5">
                {caseTimeEntries.slice(0, 10).map((e) => (
                  <div key={e.id} className="bg-surface border border-border rounded-lg p-2.5 flex items-center justify-between text-sm">
                    <div className="flex-1">
                      <div>{e.description}</div>
                      <div className="text-xs text-foreground/50">{new Date(e.created_at).toLocaleDateString("ar-EG")}</div>
                    </div>
                    <div className="text-left">
                      <div>{(Number(e.duration_minutes) / 60).toFixed(2)} س</div>
                      {e.is_billable && <div className="text-xs text-gold">{Number(e.billed_amount || 0).toFixed(0)} ج.م</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-display text-lg text-gold mb-3">💰 المصروفات</h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-surface border border-border rounded-xl p-3">
                <div className="text-xs text-foreground/60">إجمالي</div>
                <div className="font-bold text-lg">{totalExpenses.toFixed(0)} ج.م</div>
              </div>
              <div className="bg-surface border border-border rounded-xl p-3">
                <div className="text-xs text-foreground/60">مُستردة</div>
                <div className="font-bold text-lg text-green-400">{reimbursedExpenses.toFixed(0)} ج.م</div>
              </div>
              <div className="bg-surface border border-border rounded-xl p-3">
                <div className="text-xs text-foreground/60">معلقة</div>
                <div className="font-bold text-lg text-orange-300">{pendingExpenses.toFixed(0)} ج.م</div>
              </div>
            </div>
            {caseExpenses.length === 0 ? (
              <div className="text-center py-6 text-foreground/50 text-sm">لا توجد مصروفات</div>
            ) : (
              <div className="space-y-1.5">
                {caseExpenses.map((e) => (
                  <div key={e.id} className="bg-surface border border-border rounded-lg p-2.5 flex items-center justify-between text-sm">
                    <div className="flex-1">
                      <div>{e.description}</div>
                      <div className="text-xs text-foreground/50">{e.type}{e.paid_at && ` • ${new Date(e.paid_at).toLocaleDateString("ar-EG")}`}</div>
                    </div>
                    <div className="text-left">
                      <div>{Number(e.amount).toFixed(0)} ج.م</div>
                      <div className={`text-[10px] ${e.is_reimbursed ? "text-green-400" : "text-orange-300"}`}>{e.is_reimbursed ? "مُسترد" : "معلق"}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap pt-2 border-t border-border">
            <button onClick={() => setQuickExpenseOpen(true)} className="bg-gold-gradient text-primary-foreground font-semibold px-4 py-2 rounded-lg text-sm shadow-gold inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> مصروف جديد
            </button>
            <Link to="/dashboard/lawyer/time-tracking" className="bg-gold/15 border border-gold/40 text-gold px-4 py-2 rounded-lg text-sm hover:bg-gold/25">
              💰 إنشاء فاتورة من الوقت
            </Link>
            <Link to="/dashboard/lawyer/expenses" className="bg-gold/15 border border-gold/40 text-gold px-4 py-2 rounded-lg text-sm hover:bg-gold/25">
              📤 إرسال مصروفات للموكل
            </Link>
          </div>
        </div>
      )}

      {quickExpenseOpen && c && (
        <QuickExpenseDialog
          caseId={id}
          lawyerId={c.lawyer_id}
          onClose={() => setQuickExpenseOpen(false)}
          onSaved={() => { setQuickExpenseOpen(false); load(); }}
        />
      )}

      {quickDeadlineOpen && c && (
        <QuickDeadlineDialog
          caseId={id}
          court={c.court}
          onClose={() => setQuickDeadlineOpen(false)}
          onSaved={() => { setQuickDeadlineOpen(false); load(); }}
        />
      )}

      {quickTaskOpen && c && (
        <QuickTaskDialog
          caseId={id}
          onClose={() => setQuickTaskOpen(false)}
          onSaved={() => { setQuickTaskOpen(false); load(); }}
        />
      )}


      {tab === "notes" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-foreground/70">ملاحظات خاصة — لا تظهر للموكل</div>
            <div className="text-xs text-foreground/40">
              {notesSaving ? "جاري الحفظ..." : "يُحفظ تلقائياً"}
            </div>
          </div>
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="اكتب ملاحظاتك الخاصة عن القضية..."
            rows={12}
            className="w-full bg-surface border border-gold-soft/40 focus:border-gold rounded-xl px-4 py-3 text-foreground outline-none resize-none"
          />
        </div>
      )}

      {tab === "ai" && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-gold/10 to-transparent border border-gold/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="font-display text-lg text-gradient-gold font-bold">🧠 تحليل شامل للقضية بالذكاء الاصطناعي</div>
                <div className="text-xs text-foreground/60 mt-1">
                  يقرأ AI ملفات القضية ({docs.length}) + بياناتها ويقدّم استراتيجية دفاع مقترحة، نقاط القوة والضعف، والخطوات التالية.
                </div>
              </div>
              <button
                onClick={runCaseAnalysis}
                disabled={analyzing}
                className="bg-gold-gradient text-primary-foreground font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50 inline-flex items-center gap-2 shrink-0"
              >
                {analyzing ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري التحليل...</> : "🔍 حلّل القضية الآن"}
              </button>
            </div>
            {caseAnalysis && (
              <div className="bg-elevated border border-border rounded-xl p-4 mt-2 space-y-2">
                {caseAnalysis.included.length > 0 && (
                  <div className="text-[11px] text-green-400">✓ حُلّلت الملفات: {caseAnalysis.included.join("، ")}</div>
                )}
                {caseAnalysis.skipped.length > 0 && (
                  <div className="text-[11px] text-orange-300">⊘ تم تجاوز: {caseAnalysis.skipped.join("، ")}</div>
                )}
                <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 border-t border-border pt-3 mt-2">
                  {caseAnalysis.text}
                </div>
              </div>
            )}
          </div>

          <div className="text-sm text-foreground/60 pt-3 border-t border-border">
            💬 أو اطرح سؤالاً محدداً حول القضية:
          </div>
          <div className="bg-surface/60 border border-gold-soft/40 rounded-2xl p-4 space-y-3 min-h-[240px] max-h-[45vh] overflow-y-auto">
            {aiMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-gold/15 border border-gold/30" : "bg-elevated border border-border"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-end">
                <div className="bg-elevated border border-border rounded-xl px-4 py-3 inline-flex items-center gap-2 text-sm text-foreground/60">
                  <Loader2 className="h-4 w-4 animate-spin text-gold" /> يفكّر...
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAI(); } }}
              placeholder="اسأل عن القضية..."
              className="flex-1 bg-surface border border-gold-soft/50 focus:border-gold rounded-xl px-4 py-2.5 text-sm outline-none"
            />
            <button onClick={sendAI} disabled={aiLoading || !aiInput.trim()}
              className="bg-gold-gradient text-primary-foreground px-4 py-2.5 rounded-xl disabled:opacity-50">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        desc={confirmState.desc}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />

      {editMode && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-gold space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="font-display text-xl text-gradient-gold">تعديل القضية</h3>
              <button onClick={() => setEditMode(false)} className="text-foreground/60 hover:text-foreground">✕</button>
            </div>

            {[
              { k: "title", l: "العنوان *", required: true },
              { k: "court", l: "المحكمة" },
              { k: "court_department", l: "الدائرة" },
              { k: "judge", l: "القاضي" },
              { k: "opposing_party", l: "الطرف الآخر" },
              { k: "opposing_lawyer", l: "محامي الخصم" },
              { k: "total_fees", l: "إجمالي الأتعاب (ج.م)", type: "number" },
            ].map(({ k, l, required, type }) => (
              <div key={k}>
                <label className="block text-xs text-foreground/70 mb-1.5">{l}</label>
                <input
                  type={type ?? "text"}
                  value={editData[k] ?? ""}
                  onChange={(e) => setEditData({ ...editData, [k]: e.target.value })}
                  required={required}
                  className={inputCls}
                />
              </div>
            ))}

            <div>
              <label className="block text-xs text-foreground/70 mb-1.5">تاريخ الجلسة القادمة</label>
              <input type="date"
                value={editData.next_hearing ?? ""}
                onChange={(e) => setEditData({ ...editData, next_hearing: e.target.value })}
                className={inputCls} />
            </div>

            <div>
              <label className="block text-xs text-foreground/70 mb-1.5">الوقائع</label>
              <textarea
                rows={4}
                value={editData.facts ?? ""}
                onChange={(e) => setEditData({ ...editData, facts: e.target.value })}
                className={inputCls} />
            </div>

            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={editSaving || !editData.title}
                className="flex-1 bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-lg disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {editSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                حفظ التعديلات
              </button>
              <button onClick={() => setEditMode(false)}
                className="border border-border text-foreground/70 px-5 py-2.5 rounded-lg">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  if (!v) return null;
  return (
    <div className="flex justify-between gap-4 text-sm border-b border-border last:border-0 pb-2 last:pb-0">
      <span className="text-foreground/60 shrink-0">{k}</span>
      <span className="text-foreground font-medium">{v}</span>
    </div>
  );
}

function SuccessFeeBox({ percent, caseId, clientId, lawyerId }: { percent: number; caseId: string; clientId: string | null; lawyerId: string }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const amount = (Number(value) || 0) * (percent / 100);
  async function createInvoice() {
    if (amount <= 0 || busy) return;
    setBusy(true);
    const invoice_number = `SF-${Date.now().toString().slice(-8)}`;
    const { error } = await supabase.from("invoices").insert({
      lawyer_id: lawyerId,
      client_id: clientId,
      case_id: caseId,
      invoice_number,
      amount,
      total_amount: amount,
      status: "pending",
      notes: `أتعاب نجاح (${percent}%) على مبلغ ${Number(value).toLocaleString("ar-EG")} ج.م`,
    });
    setBusy(false);
    const { toast } = await import("sonner");
    if (error) toast.error("تعذر إنشاء الفاتورة: " + error.message);
    else { toast.success(`تم إنشاء فاتورة ${invoice_number} ✓`); setValue(""); }
  }
  return (
    <div className="bg-surface border border-gold-soft/40 rounded-2xl p-5 space-y-3">
      <div className="font-semibold text-gold">أتعاب النجاح ({percent}%)</div>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="أدخل قيمة الحكم أو التسوية (ج.م)"
        className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm"
      />
      {amount > 0 && (
        <div className="text-sm">
          أتعاب النجاح: <span className="text-gradient-gold font-bold text-lg">{amount.toLocaleString("ar-EG")} ج.م</span>
        </div>
      )}
      <button onClick={createInvoice} disabled={amount <= 0 || busy} className="bg-gold-gradient text-primary-foreground font-semibold px-5 py-2 rounded-lg text-sm disabled:opacity-50">
        {busy ? "جاري الإنشاء..." : "إنشاء فاتورة بأتعاب النجاح"}
      </button>
    </div>
  );
}

const EXPENSE_TYPES: { v: string; l: string }[] = [
  { v: "court_fees", l: "رسوم محكمة" },
  { v: "travel", l: "انتقالات" },
  { v: "experts", l: "خبراء" },
  { v: "copies", l: "نسخ ومستندات" },
  { v: "communications", l: "اتصالات" },
  { v: "other", l: "أخرى" },
];

function QuickExpenseDialog({
  caseId, lawyerId, onClose, onSaved,
}: { caseId: string; lawyerId: string; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState("court_fees");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!description.trim() || !amount || saving) return;
    setSaving(true);
    const { handleSupabaseError } = await import("@/lib/utils");
    const { error } = await supabase.from("case_expenses").insert({
      case_id: caseId,
      lawyer_id: lawyerId,
      type,
      description: description.trim(),
      amount: Number(amount),
      paid_at: paidAt || null,
      is_billable: true,
    });
    setSaving(false);
    if (error) {
      toast.error(handleSupabaseError(error, "تعذر حفظ المصروف"));
      return;
    }
    toast.success("تمت إضافة المصروف ✓");
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">مصروف جديد</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-foreground/60" /></button>
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
          {EXPENSE_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="الوصف *" className={inputCls} />
        <div className="grid grid-cols-2 gap-2">
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="المبلغ (ج.م) *" min="0" step="0.01" className={inputCls} />
          <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={inputCls} />
        </div>
        <button onClick={save} disabled={!description.trim() || !amount || saving} className="w-full bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-lg shadow-gold disabled:opacity-50">
          {saving ? "جاري الحفظ..." : "حفظ"}
        </button>
      </div>
    </div>
  );
}

function QuickDeadlineDialog({
  caseId,
  court,
  onClose,
  onSaved,
}: {
  caseId: string;
  court?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [courtName, setCourtName] = useState(court || "");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("high");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim() || !dueDate || saving) return;
    setSaving(true);
    const { error } = await supabase.from("deadlines").insert({
      case_id: caseId,
      title: title.trim(),
      court_name: courtName.trim() || undefined,
      due_date: dueDate,
      priority,
      notes: notes.trim() || undefined,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || "تعذر حفظ الأجل القانوني");
      return;
    }
    toast.success("تمت إضافة الأجل القانوني بنجاح ✓");
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">أجل قانوني جديد</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-foreground/60" /></button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="موضوع الأجل (مثال: الاستئناف، تقديم مذكرة) *" className={inputCls} />
        <input value={courtName} onChange={(e) => setCourtName(e.target.value)} placeholder="المحكمة / الدائرة المختصة" className={inputCls} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-foreground/60 mb-1 block">تاريخ الأجل *</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-foreground/60 mb-1 block">الأولوية</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
              <option value="urgent">حاسم / طارئ</option>
              <option value="high">مرتفع</option>
              <option value="medium">متوسط</option>
              <option value="low">عادي</option>
            </select>
          </div>
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات وتفاصيل إضافية..." rows={2} className={inputCls} />
        <button onClick={save} disabled={!title.trim() || !dueDate || saving} className="w-full bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-lg shadow-gold disabled:opacity-50">
          {saving ? "جاري الحفظ..." : "حفظ الأجل"}
        </button>
      </div>
    </div>
  );
}

function QuickTaskDialog({
  caseId,
  onClose,
  onSaved,
}: {
  caseId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim() || saving) return;
    setSaving(true);
    const { error } = await supabase.from("tasks").insert({
      case_id: caseId,
      title: title.trim(),
      description: description.trim() || undefined,
      due_date: dueDate || undefined,
      priority,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || "تعذر حفظ المهمة");
      return;
    }
    toast.success("تمت إضافة المهمة بنجاح ✓");
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">مهمة جديدة للقضية</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-foreground/60" /></button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المهمة *" className={inputCls} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="تفاصيل المهمة (اختياري)..." rows={2} className={inputCls} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-foreground/60 mb-1 block">تاريخ الإنجاز</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-foreground/60 mb-1 block">الأولوية</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
              <option value="urgent">طارئة</option>
              <option value="high">عالية</option>
              <option value="medium">متوسطة</option>
              <option value="low">منخفضة</option>
            </select>
          </div>
        </div>
        <button onClick={save} disabled={!title.trim() || saving} className="w-full bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-lg shadow-gold disabled:opacity-50">
          {saving ? "جاري الحفظ..." : "حفظ المهمة"}
        </button>
      </div>
    </div>
  );
}
