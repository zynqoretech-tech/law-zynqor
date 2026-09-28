import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, X, CheckSquare, AlertTriangle, Trash2 } from "lucide-react";
import { apiGetLawyerTasks, apiCreateLawyerTask, apiUpdateLawyerTask, apiDeleteLawyerTask } from "@/lib/laravel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/lawyer/tasks")({
  head: () => ({ meta: [{ title: "المهام — الوكيل" }] }),
  component: TasksPage,
});

type Task = {
  id: string;
  title: string;
  description: string | null;
  case_id: string | null;
  assigned_to: string | null;
  status: "pending" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  is_billable: boolean;
  estimated_hours: number;
  case?: { id: number | string; title: string } | null;
};
type TeamMember = { member_profile_id: string; full_name: string };

const COLUMNS: { v: Task["status"]; l: string; color: string }[] = [
  { v: "pending", l: "معلقة", color: "border-yellow-500/40" },
  { v: "in_progress", l: "جاري التنفيذ", color: "border-blue-500/40" },
  { v: "done", l: "مكتملة", color: "border-green-500/40" },
  { v: "cancelled", l: "ملغاة", color: "border-red-500/40" },
];

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-foreground/10 text-foreground/60",
  normal: "bg-blue-500/15 text-blue-300",
  medium: "bg-blue-500/15 text-blue-300",
  high: "bg-orange-500/15 text-orange-300",
  urgent: "bg-red-500/20 text-red-300",
};
const PRIORITY_LABEL: Record<string, string> = {
  low: "منخفضة",
  normal: "متوسطة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "طارئة",
};

function TasksPage() {
  const { userId } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [cases, setCases] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function loadTasks() {
    setLoading(true);
    try {
      const res: any = await apiGetLawyerTasks();
      const list = Array.isArray(res) ? res : res?.data || [];
      const mapped: Task[] = list.map((item: any) => ({
        id: String(item.id),
        title: item.title,
        description: item.description || item.notes || null,
        case_id: item.case_id ? String(item.case_id) : null,
        assigned_to: null,
        status: item.status === "completed" ? "done" : item.status || "pending",
        priority: item.priority === "normal" ? "medium" : item.priority || "medium",
        due_date: item.due_date || null,
        is_billable: false,
        estimated_hours: 0,
        case: item.case || null,
      }));
      setTasks(mapped);
    } catch (e: any) {
      toast.error(e?.message || "تعذر تحميل المهام");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
    if (userId) {
      supabase.from("cases").select("id, title").eq("lawyer_id", userId)
        .then(({ data }) => setCases(data ?? []));
    }
  }, [userId]);

  async function changeStatus(id: string, status: Task["status"]) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      await apiUpdateLawyerTask(id, { status: status === "done" ? "completed" : status });
    } catch {
      toast.error("تعذر تحديث حالة المهمة");
    }
  }

  const pendingCount = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length;
  const overdue = tasks.filter(
    (t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done" && t.status !== "cancelled",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-gradient-gold font-bold inline-flex items-center gap-2">
            <CheckSquare className="h-7 w-7" /> المهام
          </h1>
          <p className="text-foreground/60 text-sm mt-1">{pendingCount} مهمة معلقة</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 bg-gold-gradient text-primary-foreground font-semibold px-4 py-2.5 rounded-lg shadow-gold">
          <Plus className="h-4 w-4" /> مهمة جديدة
        </button>
      </div>

      {overdue.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-red-300">لديك {overdue.length} مهمة متأخرة</div>
            <div className="text-xs text-red-200/70 mt-1">{overdue.slice(0, 3).map((t) => t.title).join("، ")}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-4 animate-pulse h-64" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const list = tasks.filter((t) => t.status === col.v);
            return (
              <div key={col.v} className={`bg-surface/60 border-2 ${col.color} rounded-xl p-3 min-h-[300px]`}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="font-semibold text-sm">{col.l}</div>
                  <div className="text-xs text-foreground/50 bg-elevated px-2 py-0.5 rounded-full">{list.length}</div>
                </div>
                <div className="space-y-2">
                  {list.map((t) => (
                    <div key={t.id} className="bg-elevated border border-border rounded-lg p-3 text-sm relative group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium mb-1 flex-1">{t.title}</div>
                        <button
                          onClick={async () => {
                            try {
                              await apiDeleteLawyerTask(t.id);
                              setTasks((xs) => xs.filter((x) => x.id !== t.id));
                              toast.success("تم حذف المهمة ✓");
                            } catch {
                              toast.error("تعذر حذف المهمة");
                            }
                          }}
                          className="text-foreground/30 hover:text-red-400 p-0.5 transition"
                          title="حذف المهمة"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {t.description && (
                        <div className="text-xs text-foreground/60 mb-2 whitespace-pre-wrap">{t.description}</div>
                      )}
                      {t.case && (
                        <div className="text-[11px] text-gold/90 bg-gold/10 px-2 py-0.5 rounded border border-gold/20 mb-2 inline-block">
                          ⚖️ {t.case.title}
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded ${PRIORITY_BADGE[t.priority] || "bg-foreground/10"}`}>{PRIORITY_LABEL[t.priority] || t.priority}</span>
                        {t.due_date && <span className="text-foreground/50">{new Date(t.due_date).toLocaleDateString("ar-EG")}</span>}
                      </div>
                      <div className="mt-2.5 flex gap-1 flex-wrap pt-2 border-t border-border/50">
                        {COLUMNS.filter((c) => c.v !== t.status).map((c) => (
                          <button key={c.v} onClick={() => changeStatus(t.id, c.v)} className="text-[10px] bg-surface hover:bg-gold/15 text-foreground/60 hover:text-gold border border-border rounded px-1.5 py-0.5">
                            → {c.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {list.length === 0 && (
                    <div className="text-center text-xs text-foreground/30 py-6">لا توجد مهام</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <NewTaskDialog
          cases={cases}
          onClose={() => setOpen(false)}
          onCreated={() => { setOpen(false); loadTasks(); }}
        />
      )}
    </div>
  );
}

function NewTaskDialog({
  cases,
  onClose,
  onCreated,
}: {
  cases: { id: string; title: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [caseId, setCaseId] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await apiCreateLawyerTask({
        case_id: caseId ? Number(caseId) : undefined,
        title: title.trim(),
        notes: description.trim() || undefined,
        priority,
        due_date: dueDate || undefined,
      });
      toast.success("تم إنشاء المهمة ✓");
      onCreated();
    } catch {
      toast.error("تعذر إنشاء المهمة");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">مهمة جديدة</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-foreground/60" /></button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المهمة *" className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm" />
        <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm">
          <option value="">— ربط بقضية (اختياري) —</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="تفاصيل (اختياري)" rows={2} className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <select value={priority} onChange={(e) => setPriority(e.target.value as any)} className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm">
            <option value="low">منخفضة</option>
            <option value="medium">متوسطة</option>
            <option value="high">عالية</option>
            <option value="urgent">طارئة</option>
          </select>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={save} disabled={!title.trim() || saving} className="w-full bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-lg shadow-gold disabled:opacity-50">
          {saving ? "جاري الحفظ..." : "حفظ"}
        </button>
      </div>
    </div>
  );
}

