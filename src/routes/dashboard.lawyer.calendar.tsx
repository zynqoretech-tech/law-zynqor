import { createFileRoute, Link } from "@tanstack/react-router";
import { handleSupabaseError } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Loader2,
  Plus,
  Bell,
  Clock,
  Trash2,
  MapPin,
  User,
  Phone,
  Briefcase,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/dashboard/lawyer/calendar")({
  head: () => ({ meta: [{ title: "التقويم وجدول المواعيد — الوكيل" }] }),
  component: CalendarPage,
});

type EventKind = "hearing" | "consult" | "deadline" | "task";

type Event = {
  id: string;
  kind: EventKind;
  hearing_date?: string;
  session_date?: string;
  scheduled_at?: string;
  starts_at?: string;
  due_date?: string;
  deadline_date?: string;
  court?: string | null;
  court_name?: string | null;
  title?: string | null;
  notes?: string | null;
  description?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  priority?: string | null;
  status?: string | null;
  type?: string | null;
  case?: { id?: string | number; title?: string; case_number?: string } | null;
};

const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];
const DAYS_AR = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

function CalendarPage() {
  const { userId } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [events, setEvents] = useState<Map<string, Event[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<{ key: string; evs: Event[] } | null>(null);

  // Quick Add State
  const [quickAdd, setQuickAdd] = useState<{ date: string } | null>(null);
  const [addKind, setAddKind] = useState<EventKind>("hearing");
  const [addTitle, setAddTitle] = useState("");
  const [addCaseId, setAddCaseId] = useState("");
  const [addCourt, setAddCourt] = useState("");
  const [addTime, setAddTime] = useState("10:00");
  const [addNotes, setAddNotes] = useState("");
  const [addClientName, setAddClientName] = useState("");
  const [addClientPhone, setAddClientPhone] = useState("");
  const [addPriority, setAddPriority] = useState("medium");
  const [addConsultType, setAddConsultType] = useState<"office" | "online">("office");
  const [quickAdding, setQuickAdding] = useState(false);
  const [quickAddCases, setQuickAddCases] = useState<{ id: string; title: string; case_number?: string }[]>([]);

  // Deletion state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Upcoming alerts
  const [upcomingEvents, setUpcomingEvents] = useState<{ ev: Event; time: Date; dateStr: string }[]>([]);

  // Load cases for dropdown
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("cases")
      .select("id, title, case_number")
      .eq("lawyer_id", userId)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setQuickAddCases((data as any) ?? []));
  }, [userId]);

  // Load calendar events
  async function loadEvents() {
    if (!userId) return;
    setLoading(true);
    const start = new Date(year, month, 1).toISOString();
    const end = new Date(year, month + 1, 0, 23, 59).toISOString();

    const [casesRes, hearingsRes, consultsRes, deadlinesRes, tasksRes] = await Promise.all([
      supabase.from("cases").select("id, title, case_number").eq("lawyer_id", userId),
      supabase.from("hearings").select("*"),
      supabase.from("consultations").select("*"),
      supabase.from("deadlines").select("*"),
      supabase.from("tasks").select("*"),
    ]);

    const casesList = (casesRes.data ?? []) as any[];
    const casesMap: Record<string, any> = Object.fromEntries(
      casesList.map((c) => [String(c.id), c])
    );

    const map = new Map<string, Event[]>();
    const addEvent = (dateStr: string | null | undefined, ev: Event) => {
      if (!dateStr) return;
      const key = String(dateStr).split("T")[0];
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    };

    // 1. Hearings / Sessions
    (hearingsRes.data ?? []).forEach((h: any) => {
      const d = h.hearing_date || h.session_date;
      if (d) {
        const linkedCase = h.case_id ? casesMap[String(h.case_id)] || h.case : h.case;
        addEvent(d, {
          id: String(h.id),
          kind: "hearing",
          hearing_date: d,
          court: h.court_name || h.court || "المحكمة",
          title: h.title || (linkedCase ? `جلسة: ${linkedCase.title}` : "جلسة مرافعة"),
          notes: h.notes || null,
          status: h.status || "scheduled",
          case: linkedCase ? { id: linkedCase.id, title: linkedCase.title, case_number: linkedCase.case_number } : null,
        });
      }
    });

    // 2. Consultations / Appointments
    (consultsRes.data ?? []).forEach((c: any) => {
      const d = c.scheduled_at || c.starts_at;
      if (d) {
        const linkedCase = c.case_id ? casesMap[String(c.case_id)] || c.case : c.case;
        addEvent(d, {
          id: String(c.id),
          kind: "consult",
          scheduled_at: d,
          title: c.subject || c.title || (c.client_name ? `استشارة: ${c.client_name}` : "استشارة قانونية"),
          client_name: c.client_name || c.client?.user?.name || null,
          client_phone: c.client_phone || c.client?.user?.phone || null,
          court: c.court || (c.type === "office" ? "المكتب" : "أونلاين"),
          type: c.type || "office",
          notes: c.notes || null,
          status: c.status || "scheduled",
          case: linkedCase ? { id: linkedCase.id, title: linkedCase.title, case_number: linkedCase.case_number } : null,
        });
      }
    });

    // 3. Deadlines
    (deadlinesRes.data ?? []).forEach((dl: any) => {
      const d = dl.due_date || dl.deadline_date;
      if (d) {
        const linkedCase = dl.case_id ? casesMap[String(dl.case_id)] || dl.case : dl.case;
        addEvent(d, {
          id: String(dl.id),
          kind: "deadline",
          due_date: d,
          title: dl.title || "أجل قانوني",
          court: dl.court_name || dl.court || null,
          notes: dl.notes || null,
          priority: dl.priority || "high",
          status: dl.status || (dl.is_completed ? "completed" : "active"),
          case: linkedCase ? { id: linkedCase.id, title: linkedCase.title, case_number: linkedCase.case_number } : null,
        });
      }
    });

    // 4. Tasks
    (tasksRes.data ?? []).forEach((t: any) => {
      const d = t.due_date;
      if (d) {
        const linkedCase = t.case_id ? casesMap[String(t.case_id)] || t.case : t.case;
        addEvent(d, {
          id: String(t.id),
          kind: "task",
          due_date: d,
          title: t.title || "مهمة عمل",
          description: t.description || t.notes || null,
          notes: t.description || t.notes || null,
          priority: t.priority || "medium",
          status: t.status || "todo",
          case: linkedCase ? { id: linkedCase.id, title: linkedCase.title, case_number: linkedCase.case_number } : null,
        });
      }
    });

    // Compute upcoming events within 48h
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const upcoming: { ev: Event; time: Date; dateStr: string }[] = [];

    map.forEach((evList) => {
      evList.forEach((ev) => {
        const raw = ev.hearing_date || ev.scheduled_at || (ev.due_date ? `${ev.due_date}T09:00:00` : null);
        if (raw) {
          const t = new Date(raw);
          if (!isNaN(t.getTime()) && t >= new Date(now.getTime() - 2 * 60 * 60 * 1000) && t <= in48h) {
            upcoming.push({ ev, time: t, dateStr: raw });
          }
        }
      });
    });

    upcoming.sort((a, b) => a.time.getTime() - b.time.getTime());
    setUpcomingEvents(upcoming);

    setEvents(map);
    setLoading(false);
  }

  useEffect(() => {
    loadEvents();
  }, [userId, year, month]);

  // Handle Event Deletion / Trash
  async function handleDeleteEvent(ev: Event) {
    if (!ev.id) return;
    const confirmMsg =
      ev.kind === "hearing" ? "هل أنت متأكد من حذف هذه الجلسة ونقلها إلى سلة المهملات؟" :
      ev.kind === "consult" ? "هل أنت متأكد من حذف هذه الاستشارة؟" :
      ev.kind === "deadline" ? "هل أنت متأكد من حذف هذا الأجل القانوني؟" :
      "هل أنت متأكد من حذف هذه المهمة؟";

    if (!window.confirm(confirmMsg)) return;

    setDeletingId(ev.id);
    try {
      let table = "";
      if (ev.kind === "hearing") table = "hearings";
      else if (ev.kind === "consult") table = "consultations";
      else if (ev.kind === "deadline") table = "deadlines";
      else if (ev.kind === "task") table = "tasks";

      const { error } = await supabase.from(table as any).delete().eq("id", ev.id);
      if (error) throw error;

      toast.success("تم حذف الموعد بنجاح ✓");

      // Update events map
      const nextMap = new Map<string, Event[]>();
      events.forEach((list, key) => {
        const filtered = list.filter((item) => String(item.id) !== String(ev.id));
        if (filtered.length > 0) {
          nextMap.set(key, filtered);
        }
      });
      setEvents(nextMap);

      // Update selectedDay modal if open
      if (selectedDay) {
        const remaining = selectedDay.evs.filter((item) => String(item.id) !== String(ev.id));
        if (remaining.length === 0) {
          setSelectedDay(null);
        } else {
          setSelectedDay({ ...selectedDay, evs: remaining });
        }
      }

      // Update upcoming list
      setUpcomingEvents((prev) => prev.filter((item) => String(item.ev.id) !== String(ev.id)));
    } catch (err: any) {
      toast.error(handleSupabaseError(err) || "تعذر حذف الموعد");
    } finally {
      setDeletingId(null);
    }
  }

  // Submit Quick Add for any of the 4 kinds
  async function submitQuickAdd() {
    if (!quickAdd || !addTime) return;
    setQuickAdding(true);
    try {
      const dateTime = `${quickAdd.date}T${addTime}:00`;
      let insertedId = `tmp-${Date.now()}`;
      let createdEv: Event | null = null;
      const caseObj = quickAddCases.find((c) => String(c.id) === String(addCaseId));

      if (addKind === "hearing") {
        const finalTitle = addTitle.trim() || (caseObj ? `جلسة: ${caseObj.title}` : "جلسة قضائية");
        const { data: inserted, error } = await supabase.from("hearings").insert({
          case_id: addCaseId ? Number(addCaseId) : null,
          title: finalTitle,
          court: addCourt.trim() || "المحكمة",
          hearing_date: dateTime,
          notes: addNotes.trim() || null,
        }).select("id").single();
        if (error) throw error;
        insertedId = String(inserted?.id || insertedId);
        createdEv = {
          id: insertedId,
          kind: "hearing",
          title: finalTitle,
          court: addCourt.trim() || "المحكمة",
          hearing_date: dateTime,
          notes: addNotes.trim() || null,
          case: caseObj ? { id: caseObj.id, title: caseObj.title, case_number: caseObj.case_number } : null,
        };
      } else if (addKind === "consult") {
        const finalTitle = addTitle.trim() || (addClientName.trim() ? `استشارة: ${addClientName.trim()}` : "استشارة قانونية");
        const { data: inserted, error } = await supabase.from("consultations").insert({
          case_id: addCaseId ? Number(addCaseId) : null,
          title: finalTitle,
          client_name: addClientName.trim() || "الموكل",
          client_phone: addClientPhone.trim() || null,
          type: addConsultType,
          scheduled_at: dateTime,
          notes: addNotes.trim() || null,
        }).select("id").single();
        if (error) throw error;
        insertedId = String(inserted?.id || insertedId);
        createdEv = {
          id: insertedId,
          kind: "consult",
          title: finalTitle,
          client_name: addClientName.trim() || "الموكل",
          client_phone: addClientPhone.trim() || null,
          court: addConsultType === "office" ? "المكتب" : "أونلاين",
          type: addConsultType,
          scheduled_at: dateTime,
          notes: addNotes.trim() || null,
          case: caseObj ? { id: caseObj.id, title: caseObj.title, case_number: caseObj.case_number } : null,
        };
      } else if (addKind === "deadline") {
        const finalTitle = addTitle.trim() || "أجل قانوني";
        const { data: inserted, error } = await supabase.from("deadlines").insert({
          case_id: addCaseId ? Number(addCaseId) : null,
          title: finalTitle,
          court: addCourt.trim() || null,
          due_date: dateTime,
          notes: addNotes.trim() || null,
          priority: addPriority,
        }).select("id").single();
        if (error) throw error;
        insertedId = String(inserted?.id || insertedId);
        createdEv = {
          id: insertedId,
          kind: "deadline",
          title: finalTitle,
          court: addCourt.trim() || null,
          due_date: dateTime,
          notes: addNotes.trim() || null,
          priority: addPriority,
          case: caseObj ? { id: caseObj.id, title: caseObj.title, case_number: caseObj.case_number } : null,
        };
      } else if (addKind === "task") {
        const finalTitle = addTitle.trim() || "مهمة عمل";
        const { data: inserted, error } = await supabase.from("tasks").insert({
          case_id: addCaseId ? Number(addCaseId) : null,
          title: finalTitle,
          due_date: quickAdd.date,
          priority: addPriority,
          description: addNotes.trim() || null,
        }).select("id").single();
        if (error) throw error;
        insertedId = String(inserted?.id || insertedId);
        createdEv = {
          id: insertedId,
          kind: "task",
          title: finalTitle,
          due_date: dateTime,
          notes: addNotes.trim() || null,
          priority: addPriority,
          case: caseObj ? { id: caseObj.id, title: caseObj.title, case_number: caseObj.case_number } : null,
        };
      }

      toast.success("تمت إضافة الموعد بنجاح ✓");

      if (createdEv) {
        const key = quickAdd.date;
        const nextMap = new Map(events);
        const existing = nextMap.get(key) ?? [];
        nextMap.set(key, [...existing, createdEv]);
        setEvents(nextMap);
      }

      // Reset
      setQuickAdd(null);
      setAddTitle("");
      setAddCaseId("");
      setAddCourt("");
      setAddTime("10:00");
      setAddNotes("");
      setAddClientName("");
      setAddClientPhone("");
      setAddPriority("medium");
    } catch (e: any) {
      toast.error(handleSupabaseError(e) || "تعذر إضافة الموعد");
    } finally {
      setQuickAdding(false);
    }
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];
  const todayStr = today;

  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl text-gradient-gold font-bold">التقويم وجدول المواعيد</h1>
          <p className="text-xs text-foreground/60 mt-1">
            إدارة الجلسات، الاستشارات، الآجال القانونية، ومهام العمل
          </p>
        </div>
        <button
          onClick={() => {
            setQuickAdd({ date: todayStr });
            setAddKind("hearing");
          }}
          className="inline-flex items-center gap-2 text-xs text-primary-foreground font-semibold bg-gold-gradient px-4 py-2 rounded-xl shadow-gold hover:opacity-90 transition"
        >
          <Plus className="h-4 w-4" /> إضافة موعد جديد
        </button>
      </div>

      {/* Upcoming Alerts Banner */}
      {upcomingEvents.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/15 via-gold/10 to-amber-500/5 border border-amber-500/40 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <div className="font-semibold text-amber-300 text-sm flex items-center gap-1.5">
              <Bell className="h-4 w-4 text-amber-400" />
              تنبيه: لديك {upcomingEvents.length} مواعيد وشيكة خلال الـ 48 ساعة القادمة
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {upcomingEvents.map(({ ev, time }, idx) => {
              const lbl =
                ev.kind === "hearing" ? (ev.case?.title ? `جلسة: ${ev.case.title}` : ev.title ?? "جلسة قضائية") :
                ev.kind === "consult" ? (ev.title ?? "استشارة قانونية") :
                ev.kind === "deadline" ? (ev.title ?? "أجل قانوني") :
                (ev.title ?? "مهمة مستعجلة");
              const isToday = time.toDateString() === new Date().toDateString();
              return (
                <div
                  key={idx}
                  className="bg-background/80 border border-amber-500/20 rounded-xl p-3 flex flex-col justify-between hover:border-amber-500/50 transition group"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground truncate">{lbl}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${
                        isToday
                          ? "bg-red-500/20 text-red-300 border border-red-500/30"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {isToday ? "اليوم" : "غداً"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-foreground/60 mt-2">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-gold" />
                      <span>{time.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span>
                      {ev.court && <span className="truncate max-w-[120px]">• {ev.court}</span>}
                    </div>
                    {ev.id && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEvent(ev);
                        }}
                        disabled={deletingId === ev.id}
                        className="text-red-400/60 hover:text-red-400 p-1 transition"
                        title="حذف الموعد"
                      >
                        {deletingId === ev.id ? (
                          <Loader2 className="h-3 w-3 animate-spin text-red-400" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Calendar Card */}
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-5 shadow-sm">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg border border-border hover:border-gold text-foreground/70 hover:text-gold transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="font-display text-lg text-gold font-bold">
            {MONTHS_AR[month]} {year}
          </div>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg border border-border hover:border-gold text-foreground/70 hover:text-gold transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Days of week */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS_AR.map((d) => (
            <div key={d} className="text-xs text-foreground/60 text-center py-2 font-medium">
              {d}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[75px] sm:min-h-[85px] opacity-20" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayEvents = events.get(dateKey) ?? [];
            const isToday = dateKey === today;
            return (
              <div
                key={day}
                onClick={() => {
                  if (dayEvents.length > 0) {
                    setSelectedDay({ key: dateKey, evs: dayEvents });
                  } else {
                    setQuickAdd({ date: dateKey });
                    setAddKind("hearing");
                  }
                }}
                className={`min-h-[75px] sm:min-h-[85px] p-2 rounded-xl border transition cursor-pointer hover:border-gold/60 flex flex-col justify-between ${
                  isToday
                    ? "bg-gold/15 border-gold shadow-sm"
                    : "border-border/60 bg-elevated/20 hover:bg-elevated/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${isToday ? "text-gold" : "text-foreground/70"}`}>
                    {day}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] text-foreground/40 font-mono">
                      {dayEvents.length}
                    </span>
                  )}
                </div>
                <div className="space-y-1 mt-1">
                  {dayEvents.slice(0, 2).map((ev, j) => {
                    const styles =
                      ev.kind === "hearing" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                      ev.kind === "consult" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" :
                      ev.kind === "deadline" ? "bg-red-500/20 text-red-300 border border-red-500/30" :
                      "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
                    const lbl =
                      ev.kind === "hearing" ? (ev.case?.title ? `جلسة: ${ev.case.title}` : ev.title ?? "جلسة") :
                      ev.kind === "consult" ? (ev.title ?? "استشارة") :
                      ev.kind === "deadline" ? (ev.title ?? "أجل") :
                      (ev.title ?? "مهمة");
                    return (
                      <div
                        key={j}
                        className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium ${styles}`}
                        title={lbl}
                      >
                        {lbl}
                      </div>
                    );
                  })}
                  {dayEvents.length > 2 && (
                    <div className="text-[10px] text-foreground/50 text-center font-medium">
                      +{dayEvents.length - 2} مواعيد أخرى
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-foreground/60 flex-wrap bg-surface/50 border border-border/50 rounded-xl p-3">
        <div className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
          <span>🏛️ جلسات قضائية</span>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-purple-400" />
          <span>📞 استشارات واجتماعات</span>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span>🔴 آجال قانونية</span>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span>✅ مهام عمل</span>
        </div>
      </div>

      {/* Monthly Agenda List */}
      <div className="bg-surface border border-gold-soft/30 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-gradient-gold font-bold">
            مواعيد شهر {MONTHS_AR[month]} {year}
          </h2>
          <span className="text-xs text-foreground/50">
            إجمالي {Array.from(events.values()).flat().length} موعد
          </span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-elevated/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : events.size === 0 ? (
          <div className="text-foreground/50 text-sm text-center py-10 border border-dashed border-border/60 rounded-xl">
            لا توجد أي مواعيد أو جلسات مسجلة في هذا الشهر
          </div>
        ) : (
          <div className="space-y-2.5">
            {Array.from(events.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .flatMap(([_date, evs]) =>
                evs.map((ev, i) => {
                  const when =
                    ev.kind === "hearing" ? ev.hearing_date! :
                    ev.kind === "consult" ? ev.scheduled_at! :
                    ev.due_date!;
                  const dot =
                    ev.kind === "hearing" ? "bg-blue-400" :
                    ev.kind === "consult" ? "bg-purple-400" :
                    ev.kind === "deadline" ? "bg-red-400" : "bg-emerald-400";
                  const lbl =
                    ev.kind === "hearing" ? (ev.case?.title ? `جلسة: ${ev.case.title}` : ev.title ?? "جلسة") :
                    ev.kind === "consult" ? (ev.title ?? "استشارة") :
                    ev.kind === "deadline" ? (ev.title ?? "أجل قانوني") :
                    (ev.title ?? "مهمة");
                  const badge =
                    ev.kind === "hearing" ? "🏛️ جلسة" :
                    ev.kind === "consult" ? "📞 استشارة" :
                    ev.kind === "deadline" ? "🔴 أجل" : "✅ مهمة";

                  return (
                    <div
                      key={`${_date}-${i}`}
                      className="bg-elevated/30 border border-border/70 hover:border-gold/40 rounded-xl p-3.5 flex items-center justify-between gap-3 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${dot}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-foreground truncate">{lbl}</span>
                            {ev.case && (
                              <span className="text-[11px] px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20 truncate">
                                قضية: {ev.case.title}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-foreground/60 flex items-center gap-2 mt-1 flex-wrap">
                            <span>
                              {new Date(when).toLocaleString("ar-EG", {
                                month: "long",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {ev.court && <span>• {ev.court}</span>}
                            {ev.client_name && <span>• الموكل: {ev.client_name}</span>}
                            {ev.notes && <span className="text-foreground/40 truncate max-w-xs">• {ev.notes}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-foreground/50 bg-background/50 px-2 py-1 rounded-lg border border-border/50">
                          {badge}
                        </span>
                        {ev.id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEvent(ev);
                            }}
                            disabled={deletingId === ev.id}
                            className="p-1.5 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition"
                            title="حذف الموعد ونقله للمهملات"
                          >
                            {deletingId === ev.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-red-400" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
          </div>
        )}
      </div>

      {/* Selected Day Details Modal with Full Details and Delete/Trash */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="bg-surface border border-gold-soft/50 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-border/50 pb-3">
              <div>
                <h3 className="font-display text-lg text-gold font-bold">
                  {new Date(selectedDay.key).toLocaleDateString("ar-EG", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </h3>
                <span className="text-xs text-foreground/60">
                  {selectedDay.evs.length} مواعيد مسجلة لهذا اليوم
                </span>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="text-foreground/60 hover:text-foreground p-1 rounded-lg hover:bg-elevated transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {selectedDay.evs.map((ev, i) => {
                const when =
                  ev.kind === "hearing" ? ev.hearing_date! :
                  ev.kind === "consult" ? ev.scheduled_at! :
                  ev.due_date!;
                const box =
                  ev.kind === "hearing" ? "bg-blue-500/10 border-blue-500/30" :
                  ev.kind === "consult" ? "bg-purple-500/10 border-purple-500/30" :
                  ev.kind === "deadline" ? "bg-red-500/10 border-red-500/30" :
                  "bg-emerald-500/10 border-emerald-500/30";
                const icon =
                  ev.kind === "hearing" ? "🏛️" :
                  ev.kind === "consult" ? "📞" :
                  ev.kind === "deadline" ? "🔴" : "✅";
                const kindLabel =
                  ev.kind === "hearing" ? "جلسة قضائية" :
                  ev.kind === "consult" ? "استشارة قانونية" :
                  ev.kind === "deadline" ? "أجل قانوني" : "مهمة عمل";

                return (
                  <div key={i} className={`p-4 rounded-xl border ${box} space-y-2.5`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{icon}</span>
                        <div>
                          <span className="text-xs text-foreground/50 block font-medium">
                            {kindLabel}
                          </span>
                          <h4 className="text-sm font-bold text-foreground">
                            {ev.title || kindLabel}
                          </h4>
                        </div>
                      </div>

                      {/* Delete / Trash Button */}
                      {ev.id && (
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(ev)}
                          disabled={deletingId === ev.id}
                          className="inline-flex items-center gap-1 text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-2.5 py-1.5 rounded-lg transition shrink-0"
                          title="حذف هذا الموعد ونقله لسلة المهملات"
                        >
                          {deletingId === ev.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span>حذف</span>
                        </button>
                      )}
                    </div>

                    {/* Case details if linked */}
                    {ev.case && (
                      <div className="bg-background/60 border border-border/50 rounded-lg p-2 text-xs flex items-center gap-2 text-foreground/80">
                        <Briefcase className="h-3.5 w-3.5 text-gold shrink-0" />
                        <span className="font-semibold text-gold truncate">
                          القضية: {ev.case.title}
                        </span>
                        {ev.case.case_number && (
                          <span className="text-foreground/50 text-[11px]">
                            ({ev.case.case_number})
                          </span>
                        )}
                      </div>
                    )}

                    {/* Specific details */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-foreground/70">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-gold shrink-0" />
                        <span>
                          {new Date(when).toLocaleTimeString("ar-EG", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {ev.court && (
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="h-3.5 w-3.5 text-gold shrink-0" />
                          <span className="truncate">{ev.court}</span>
                        </div>
                      )}

                      {ev.client_name && (
                        <div className="flex items-center gap-1.5 col-span-2">
                          <User className="h-3.5 w-3.5 text-gold shrink-0" />
                          <span>الموكل: {ev.client_name}</span>
                          {ev.client_phone && (
                            <span className="text-foreground/50 dir-ltr text-[11px]">
                              ({ev.client_phone})
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    {ev.notes && (
                      <div className="text-xs text-foreground/60 bg-surface/80 rounded-lg p-2 border border-border/40">
                        <span className="font-semibold text-foreground/80 block mb-0.5">
                          ملاحظات:
                        </span>
                        <p className="whitespace-pre-line">{ev.notes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add another event on this day */}
            <div className="pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => {
                  const key = selectedDay.key;
                  setSelectedDay(null);
                  setQuickAdd({ date: key });
                  setAddKind("hearing");
                }}
                className="w-full py-2 px-3 rounded-xl border border-gold/40 text-gold text-xs font-semibold hover:bg-gold/10 transition flex items-center justify-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                إضافة موعد جديد في هذا اليوم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Add Modal: Hearing, Consult, Deadline, or Task */}
      {quickAdd && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setQuickAdd(null)}
        >
          <div
            className="bg-surface border border-gold-soft/50 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-border/50 pb-3">
              <div>
                <h3 className="font-display text-lg text-gold font-bold">إضافة موعد للتقويم</h3>
                <span className="text-xs text-foreground/60">
                  {new Date(quickAdd.date).toLocaleDateString("ar-EG", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <button
                onClick={() => setQuickAdd(null)}
                className="text-foreground/60 hover:text-foreground p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Event Kind Selector Tabs */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-elevated/40 rounded-xl border border-border/50">
              <button
                type="button"
                onClick={() => setAddKind("hearing")}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition ${
                  addKind === "hearing"
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm"
                    : "text-foreground/60 hover:text-foreground"
                }`}
              >
                🏛️ جلسة
              </button>
              <button
                type="button"
                onClick={() => setAddKind("consult")}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition ${
                  addKind === "consult"
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                    : "text-foreground/60 hover:text-foreground"
                }`}
              >
                📞 استشارة
              </button>
              <button
                type="button"
                onClick={() => setAddKind("deadline")}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition ${
                  addKind === "deadline"
                    ? "bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm"
                    : "text-foreground/60 hover:text-foreground"
                }`}
              >
                🔴 أجل قانوني
              </button>
              <button
                type="button"
                onClick={() => setAddKind("task")}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition ${
                  addKind === "task"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-foreground/60 hover:text-foreground"
                }`}
              >
                ✅ مهمة
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-3">
              {/* Title / Subject */}
              <div>
                <label className="block text-xs text-foreground/70 mb-1 font-medium">
                  {addKind === "hearing" ? "عنوان الجلسة / موضوع المرافعة" :
                   addKind === "consult" ? "موضوع الاستشارة القانونية *" :
                   addKind === "deadline" ? "عنوان الأجل القانوني *" :
                   "عنوان المهمة *"}
                </label>
                <input
                  type="text"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder={
                    addKind === "hearing" ? "مثال: جلسة مرافعة ختامية وتقديم مستندات" :
                    addKind === "consult" ? "مثال: استشارة عقد بيع عقار تجاري" :
                    addKind === "deadline" ? "مثال: آخر موعد لتقديم الطعن بالاستئناف" :
                    "مثال: مراجعة وإعداد حافظة المستندات"
                  }
                  className="w-full bg-elevated border border-border/80 focus:border-gold rounded-xl px-3 py-2 text-sm text-foreground transition outline-none"
                />
              </div>

              {/* Case Dropdown (Optional for all kinds!) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-foreground/70 font-medium">
                    القضية المرتبطة (اختياري)
                  </label>
                  <span className="text-[11px] text-foreground/40">غير إلزامي</span>
                </div>
                <select
                  value={addCaseId}
                  onChange={(e) => setAddCaseId(e.target.value)}
                  className="w-full bg-elevated border border-border/80 focus:border-gold rounded-xl px-3 py-2 text-sm text-foreground transition outline-none"
                >
                  <option value="">— بدون ارتباط بقضية معينة —</option>
                  {quickAddCases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} {c.case_number ? `(${c.case_number})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Court / Authority (For Hearings and Deadlines) */}
              {(addKind === "hearing" || addKind === "deadline") && (
                <div>
                  <label className="block text-xs text-foreground/70 mb-1 font-medium">
                    المحكمة أو الدائرة القضائية
                  </label>
                  <input
                    type="text"
                    value={addCourt}
                    onChange={(e) => setAddCourt(e.target.value)}
                    placeholder="مثال: محكمة القاهرة الاقتصادية - الدائرة الخامسة"
                    className="w-full bg-elevated border border-border/80 focus:border-gold rounded-xl px-3 py-2 text-sm text-foreground transition outline-none"
                  />
                </div>
              )}

              {/* Client Info (For Consultations) */}
              {addKind === "consult" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs text-foreground/70 mb-1 font-medium">
                      اسم الموكل / العميل
                    </label>
                    <input
                      type="text"
                      value={addClientName}
                      onChange={(e) => setAddClientName(e.target.value)}
                      placeholder="اسم العميل"
                      className="w-full bg-elevated border border-border/80 focus:border-gold rounded-xl px-3 py-2 text-sm text-foreground transition outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-foreground/70 mb-1 font-medium">
                      رقم الهاتف
                    </label>
                    <input
                      type="tel"
                      value={addClientPhone}
                      onChange={(e) => setAddClientPhone(e.target.value)}
                      placeholder="010XXXXXXXX"
                      className="w-full bg-elevated border border-border/80 focus:border-gold rounded-xl px-3 py-2 text-sm text-foreground transition outline-none dir-ltr"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-foreground/70 mb-1 font-medium">
                      مكان الانعقاد
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAddConsultType("office")}
                        className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition ${
                          addConsultType === "office"
                            ? "border-gold bg-gold/15 text-gold"
                            : "border-border text-foreground/60"
                        }`}
                      >
                        🏢 بمقر المكتب
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddConsultType("online")}
                        className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition ${
                          addConsultType === "online"
                            ? "border-gold bg-gold/15 text-gold"
                            : "border-border text-foreground/60"
                        }`}
                      >
                        🌐 أونلاين / عن بعد
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Priority (For Deadlines and Tasks) */}
              {(addKind === "deadline" || addKind === "task") && (
                <div>
                  <label className="block text-xs text-foreground/70 mb-1 font-medium">
                    درجة الأهمية / الأولوية
                  </label>
                  <select
                    value={addPriority}
                    onChange={(e) => setAddPriority(e.target.value)}
                    className="w-full bg-elevated border border-border/80 focus:border-gold rounded-xl px-3 py-2 text-sm text-foreground transition outline-none"
                  >
                    <option value="low">منخفضة</option>
                    <option value="medium">متوسطة</option>
                    <option value="high">عالية / مستعجلة</option>
                    <option value="urgent">طارئة جداً (أجل نهائي)</option>
                  </select>
                </div>
              )}

              {/* Time */}
              <div>
                <label className="block text-xs text-foreground/70 mb-1 font-medium">الوقت</label>
                <input
                  type="time"
                  value={addTime}
                  onChange={(e) => setAddTime(e.target.value)}
                  min="07:00"
                  max="22:00"
                  className="w-full bg-elevated border border-border/80 focus:border-gold rounded-xl px-3 py-2 text-sm text-foreground transition outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs text-foreground/70 mb-1 font-medium">
                  ملاحظات وتفاصيل إضافية
                </label>
                <textarea
                  rows={2}
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  placeholder="أي تفاصيل أو طلبات للموكل أو المستندات المطلوبة..."
                  className="w-full bg-elevated border border-border/80 focus:border-gold rounded-xl px-3 py-2 text-sm text-foreground transition outline-none resize-none"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={submitQuickAdd}
                disabled={quickAdding}
                className="flex-1 bg-gold-gradient text-primary-foreground font-semibold py-2.5 rounded-xl shadow-gold disabled:opacity-50 flex items-center justify-center gap-2 transition"
              >
                {quickAdding && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>
                  {addKind === "hearing" ? "حفظ الجلسة" :
                   addKind === "consult" ? "حفظ الاستشارة" :
                   addKind === "deadline" ? "حفظ الأجل القانوني" :
                   "حفظ المهمة"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setQuickAdd(null)}
                className="border border-border text-foreground/70 hover:text-foreground px-4 py-2.5 rounded-xl transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
