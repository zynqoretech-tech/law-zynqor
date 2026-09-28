import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CreditCard, Sparkles, Star, Plus, RefreshCw, Trash2, Edit3, CheckCircle2,
  AlertCircle, Clock, Users, ArrowUpRight, Search, Filter, ShieldCheck,
  Check, X, Megaphone, DollarSign, Layers, ChevronLeft, ChevronRight,
  TrendingUp, Award, Building2, Smartphone, FileText
} from "lucide-react";
import { apiFetch } from "@/lib/laravel";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from "@/components/ui/dialog";

export const Route = createFileRoute("/dashboard/admin/subscriptions")({
  head: () => ({
    meta: [
      { title: "بناء وإدارة الباقات والاشتراكات — الإدارة" },
      { name: "description", content: "بناء الباقات وإدارة اشتراكات المستخدمين وطلبات السداد." },
    ],
  }),
  component: AdminSubscriptionsPage,
});

type TabType = "plans" | "subscriptions" | "requests";

interface PlanItem {
  id: number | string;
  name: string;
  name_ar?: string;
  description?: string;
  price: number;
  currency: string;
  billing_interval: string;
  target_audience?: string;
  features?: string[];
  ai_enabled?: boolean;
  voice_enabled?: boolean;
  monthly_ai_limit?: number;
  status: boolean;
  is_popular?: boolean;
  sort_order?: number;
  max_cases?: number | null;
  max_documents?: number | null;
  badge_text?: string | null;
  subscriptions_count?: number;
}

interface SubscriptionItem {
  id: number | string;
  user_id: number | string;
  subscription_plan_id: number | string;
  status: string;
  starts_at?: string;
  ends_at?: string;
  provider?: string;
  notes?: string;
  created_at?: string;
  user?: {
    id: number | string;
    name: string;
    email: string;
    phone?: string;
    role?: string;
  };
  plan?: {
    id: number | string;
    name: string;
    name_ar?: string;
    price: number;
    currency: string;
    billing_interval: string;
  };
}

interface PaymentRequestItem {
  id: number | string;
  user_id: number | string;
  subscription_plan_id: number | string;
  amount: number;
  currency: string;
  billing_interval?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  payment_method_name?: string;
  payment_method_key?: string;
  transaction_reference?: string;
  client_message?: string;
  admin_notes?: string;
  created_at: string;
  user?: {
    id: number | string;
    name: string;
    email: string;
    phone?: string;
  };
  plan?: {
    id: number | string;
    name: string;
    name_ar?: string;
  };
}

function AdminSubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("plans");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_subscriptions: 0,
    active_subscriptions: 0,
    mrr_estimate: 0,
    total_plans: 0,
    active_plans: 0,
    pending_requests: 0,
  });

  // Plans state
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<number | string | null>(null);
  const [planForm, setPlanForm] = useState({
    name: "",
    name_ar: "",
    description: "",
    price: 350,
    currency: "EGP",
    billing_interval: "monthly",
    target_audience: "all",
    features_text: "استشارات قانونية متخصصة ومباشرة\nمراجعة وصياغة العقود والاتفاقيات\nاستعلامات المساعد الذكي AI القانوني\nدعم فني واستشاري متواصل 24/7",
    ai_enabled: true,
    voice_enabled: true,
    monthly_ai_limit: 1000,
    status: true,
    is_popular: false,
    sort_order: 0,
    max_cases: "",
    max_documents: "",
    badge_text: "",
  });
  const [savingPlan, setSavingPlan] = useState(false);

  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [subSearch, setSubSearch] = useState("");
  const [subStatusFilter, setSubStatusFilter] = useState("all");
  const [subPlanFilter, setSubPlanFilter] = useState("all");
  const [subPage, setSubPage] = useState(1);
  const [subTotalPages, setSubTotalPages] = useState(1);

  // Manual Add Subscription Modal
  const [showSubModal, setShowSubModal] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [subForm, setSubForm] = useState({
    user_id: "",
    subscription_plan_id: "",
    status: "active",
    starts_at: new Date().toISOString().split("T")[0],
    ends_at: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    provider: "manual_admin",
    notes: "",
  });
  const [savingSub, setSavingSub] = useState(false);

  // Payment Requests state
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequestItem[]>([]);
  const [requestFilter, setRequestFilter] = useState("pending");
  const [processingRequestId, setProcessingRequestId] = useState<string | number | null>(null);

  // Fetch Stats
  const fetchStats = async () => {
    try {
      const res = await apiFetch("/admin/subscriptions/stats");
      if (res?.data) {
        setStats(res.data);
      }
    } catch {
      // Fallback stats calculation if needed
    }
  };

  // Fetch Plans
  const fetchPlans = async () => {
    try {
      const res = await apiFetch("/admin/plans");
      const list = Array.isArray(res) ? res : res?.data || [];
      setPlans(list);
    } catch (err: any) {
      toast.error(err?.message || "تعذر تحميل قائمة الباقات");
    }
  };

  // Fetch Subscriptions
  const fetchSubscriptions = async (page = 1) => {
    try {
      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("per_page", "15");
      if (subSearch) params.append("search", subSearch);
      if (subStatusFilter !== "all") params.append("status", subStatusFilter);
      if (subPlanFilter !== "all") params.append("plan_id", subPlanFilter);

      const res = await apiFetch(`/admin/subscriptions?${params.toString()}`);
      const list = Array.isArray(res) ? res : res?.data || [];
      setSubscriptions(list);
      if (res?.meta?.last_page) {
        setSubTotalPages(res.meta.last_page);
      }
    } catch (err: any) {
      toast.error(err?.message || "تعذر تحميل قائمة الاشتراكات");
    }
  };

  // Fetch Payment Requests
  const fetchPaymentRequests = async () => {
    try {
      const res = await apiFetch(`/admin/plan-payment-requests?status=${requestFilter}`);
      const list = Array.isArray(res) ? res : res?.data || [];
      setPaymentRequests(list);
    } catch (err: any) {
      toast.error(err?.message || "تعذر تحميل طلبات السداد");
    }
  };

  // Fetch Users for manual subscription
  const fetchUsers = async () => {
    try {
      const res = await apiFetch("/admin/users?per_page=100");
      const list = Array.isArray(res) ? res : res?.data || [];
      setUsersList(list);
    } catch {
      setUsersList([]);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchPlans(), fetchSubscriptions(subPage), fetchPaymentRequests()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (activeTab === "subscriptions") {
      fetchSubscriptions(subPage);
    } else if (activeTab === "requests") {
      fetchPaymentRequests();
    }
  }, [activeTab, subStatusFilter, subPlanFilter, subPage, requestFilter]);

  // Handle plan modal open
  const openCreatePlanModal = () => {
    setEditingPlanId(null);
    setPlanForm({
      name: "",
      name_ar: "",
      description: "",
      price: 350,
      currency: "EGP",
      billing_interval: "monthly",
      target_audience: "all",
      features_text: "استشارات قانونية متخصصة ومباشرة\nمراجعة وصياغة العقود والاتفاقيات\nاستعلامات المساعد الذكي AI القانوني\nدعم فني واستشاري متواصل 24/7",
      ai_enabled: true,
      voice_enabled: true,
      monthly_ai_limit: 1000,
      status: true,
      is_popular: false,
      sort_order: 0,
      max_cases: "",
      max_documents: "",
      badge_text: "",
    });
    setShowPlanModal(true);
  };

  const openEditPlanModal = (plan: PlanItem) => {
    setEditingPlanId(plan.id);
    const featuresArr = Array.isArray(plan.features) ? plan.features : [];
    setPlanForm({
      name: plan.name,
      name_ar: plan.name_ar || plan.name,
      description: plan.description || "",
      price: plan.price,
      currency: plan.currency || "EGP",
      billing_interval: plan.billing_interval || "monthly",
      target_audience: plan.target_audience || "all",
      features_text: featuresArr.join("\n"),
      ai_enabled: plan.ai_enabled ?? true,
      voice_enabled: plan.voice_enabled ?? false,
      monthly_ai_limit: plan.monthly_ai_limit ?? 1000,
      status: plan.status,
      is_popular: plan.is_popular ?? false,
      sort_order: plan.sort_order ?? 0,
      max_cases: plan.max_cases !== null && plan.max_cases !== undefined ? String(plan.max_cases) : "",
      max_documents: plan.max_documents !== null && plan.max_documents !== undefined ? String(plan.max_documents) : "",
      badge_text: plan.badge_text || "",
    });
    setShowPlanModal(true);
  };

  // Save Plan
  const handleSavePlan = async () => {
    if (!planForm.name.trim()) {
      toast.error("يرجى إدخال اسم الباقة");
      return;
    }

    setSavingPlan(true);
    try {
      const featuresArray = planForm.features_text
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean);

      const payload = {
        name: planForm.name.trim(),
        name_ar: planForm.name_ar.trim() || planForm.name.trim(),
        description: planForm.description.trim(),
        price: Number(planForm.price) || 0,
        currency: planForm.currency,
        billing_interval: planForm.billing_interval,
        target_audience: planForm.target_audience,
        features: featuresArray,
        ai_enabled: planForm.ai_enabled,
        voice_enabled: planForm.voice_enabled,
        monthly_ai_limit: planForm.monthly_ai_limit ? Number(planForm.monthly_ai_limit) : null,
        status: planForm.status,
        is_popular: planForm.is_popular,
        sort_order: Number(planForm.sort_order) || 0,
        max_cases: planForm.max_cases !== "" ? Number(planForm.max_cases) : null,
        max_documents: planForm.max_documents !== "" ? Number(planForm.max_documents) : null,
        badge_text: planForm.badge_text.trim() || null,
      };

      if (editingPlanId) {
        await apiFetch(`/admin/plans/${editingPlanId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("تم تحديث الباقة بنجاح ✓");
      } else {
        await apiFetch("/admin/plans", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("تم إنشاء الباقة بنجاح ✓");
      }

      setShowPlanModal(false);
      await Promise.all([fetchPlans(), fetchStats()]);
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ أثناء حفظ الباقة");
    } finally {
      setSavingPlan(false);
    }
  };

  // Toggle Plan Status
  const handleTogglePlanStatus = async (planId: number | string) => {
    try {
      await apiFetch(`/admin/plans/${planId}/toggle-status`, { method: "PUT" });
      toast.success("تم تغيير حالة الباقة بنجاح");
      await Promise.all([fetchPlans(), fetchStats()]);
    } catch (err: any) {
      toast.error(err?.message || "تعذر تغيير حالة الباقة");
    }
  };

  // Delete Plan
  const handleDeletePlan = async (plan: PlanItem) => {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف باقة "${plan.name_ar || plan.name}"؟`)) return;
    try {
      await apiFetch(`/admin/plans/${plan.id}`, { method: "DELETE" });
      toast.success("تم حذف الباقة بنجاح");
      await Promise.all([fetchPlans(), fetchStats()]);
    } catch (err: any) {
      toast.error(err?.message || "تعذر حذف الباقة (قد تكون مرتبطة باشتراكات نشطة)");
    }
  };

  // Broadcast Plan to users
  const handleBroadcastPlan = async (plan: PlanItem) => {
    if (!confirm(`هل تريد إرسال إشعار ترويجي وتنبيه للمستخدمين عن باقة "${plan.name_ar || plan.name}"؟`)) return;
    try {
      await apiFetch(`/admin/plans/${plan.id}/broadcast`, { method: "POST" });
      toast.success("تم إرسال إشعار الإعلان عن الباقة لجميع المستخدمين المستهدفين ✓");
    } catch (err: any) {
      toast.error(err?.message || "تعذر إرسال الإشعار");
    }
  };

  // Preset Plan Creation
  const handleCreatePreset = async (presetType: "vip" | "annual" | "free") => {
    const presets = {
      vip: {
        name: "VIP Lawyer Gold Plan",
        name_ar: "الباقة الذهبـية للمحامين VIP",
        description: "باقة شاملة للمحامين والمكاتب القانونية تشمل استشارات ذكاء اصطناعي مفتوحة وظهور مميز في الدليل.",
        price: 499,
        currency: "EGP",
        billing_interval: "monthly",
        target_audience: "lawyers",
        features: [
          "إدارة غير محدودة للقضايا والآجال",
          "مساعد الذكاء الاصطناعي القانوني 5,000 استعلام/شهر",
          "الظهور المميز في صدارة دليل المحامين",
          "إصدار الفواتير وتسجيل المصروفات والمدفوعات",
          "دعم فني هاتفي مخصص VIP",
        ],
        ai_enabled: true,
        voice_enabled: true,
        monthly_ai_limit: 5000,
        status: true,
        is_popular: true,
        badge_text: "الأكثر طلباً",
      },
      annual: {
        name: "Annual Pro Corporate Plan",
        name_ar: "الباقة السنوية الاحترافية (Annual Pro)",
        description: "باقة سنوية موفرة 20% تشمل جميع خدمات المنصة وتخصيص نماذج العقود والتحليلات وإدارة الفريق.",
        price: 3999,
        currency: "EGP",
        billing_interval: "yearly",
        target_audience: "corporate",
        features: [
          "خصم سنوي 20% على الاشتراك الإجمالي",
          "إضافة أعضاء الفريق وإدارة الصلاحيات",
          "20,000 استعلام ذكاء اصطناعي قانوني سنوياً",
          "تقارير مالية وقضائية متقدمة وتصدير مالي",
          "صياغة ومراجعة العقود بواسطة AI غير محدودة",
        ],
        ai_enabled: true,
        voice_enabled: true,
        monthly_ai_limit: 20000,
        status: true,
        is_popular: false,
        badge_text: "توفير سنوي 20%",
      },
      free: {
        name: "Starter Trial Plan",
        name_ar: "الباقة المجانية الاستكشافية",
        description: "باقة مجانية للموكلين للبحث عن المحامين وحجز الاستشارات ومتابعة قضاياهم.",
        price: 0,
        currency: "EGP",
        billing_interval: "monthly",
        target_audience: "clients",
        features: [
          "تصفح سوق المحامين وحجز المواعيد",
          "الاطلاع على مستندات القضايا والفواتير",
          "محادثة مباشرة مع المحامي الوكيل",
        ],
        ai_enabled: false,
        voice_enabled: false,
        monthly_ai_limit: 0,
        status: true,
        is_popular: false,
      },
    };

    try {
      await apiFetch("/admin/plans", {
        method: "POST",
        body: JSON.stringify(presets[presetType]),
      });
      toast.success("تمت إضافة النموذج الجاهز بنجاح ✓");
      await Promise.all([fetchPlans(), fetchStats()]);
    } catch (err: any) {
      toast.error(err?.message || "تعذر إضافة الباقة الجاهزة");
    }
  };

  // Toggle user subscription status
  const handleToggleSubStatus = async (subId: number | string) => {
    try {
      await apiFetch(`/admin/subscriptions/${subId}/toggle-status`, { method: "PUT" });
      toast.success("تم تغيير حالة الاشتراك بنجاح");
      await Promise.all([fetchSubscriptions(subPage), fetchStats()]);
    } catch (err: any) {
      toast.error(err?.message || "تعذر تعديل حالة الاشتراك");
    }
  };

  // Delete subscription
  const handleDeleteSub = async (subId: number | string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الاشتراك؟")) return;
    try {
      await apiFetch(`/admin/subscriptions/${subId}`, { method: "DELETE" });
      toast.success("تم حذف سجل الاشتراك بنجاح");
      await Promise.all([fetchSubscriptions(subPage), fetchStats()]);
    } catch (err: any) {
      toast.error(err?.message || "تعذر حذف الاشتراك");
    }
  };

  // Open Add Subscription Modal
  const openAddSubModal = async () => {
    if (plans.length > 0) {
      setSubForm({
        user_id: "",
        subscription_plan_id: String(plans[0].id),
        status: "active",
        starts_at: new Date().toISOString().split("T")[0],
        ends_at: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        provider: "manual_admin",
        notes: "تم إضافة الاشتراك يدوياً بواسطة إدارة المنصة.",
      });
    }
    await fetchUsers();
    setShowSubModal(true);
  };

  // Save manual subscription
  const handleSaveSub = async () => {
    if (!subForm.user_id) {
      toast.error("يرجى اختيار المستخدم المراد تعيين الاشتراك له");
      return;
    }
    if (!subForm.subscription_plan_id) {
      toast.error("يرجى اختيار الباقة");
      return;
    }

    setSavingSub(true);
    try {
      await apiFetch("/admin/subscriptions", {
        method: "POST",
        body: JSON.stringify(subForm),
      });
      toast.success("تم تعيين وتفعيل الاشتراك للمستخدم بنجاح ✓");
      setShowSubModal(false);
      await Promise.all([fetchSubscriptions(subPage), fetchStats()]);
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ أثناء حفظ الاشتراك");
    } finally {
      setSavingSub(false);
    }
  };

  // Approve Payment Request
  const handleApproveRequest = async (requestId: number | string) => {
    setProcessingRequestId(requestId);
    try {
      await apiFetch(`/admin/plan-payment-requests/${requestId}/approve`, {
        method: "PUT",
        body: JSON.stringify({ admin_notes: "تم التحقق من التحويل وتفعيل الباقة بنجاح." }),
      });
      toast.success("تم اعتماد الطلب وتفعيل اشتراك المستخدم بنجاح ✓");
      await Promise.all([fetchPaymentRequests(), fetchStats()]);
    } catch (err: any) {
      toast.error(err?.message || "تعذر اعتماد طلب السداد");
    } finally {
      setProcessingRequestId(null);
    }
  };

  // Reject Payment Request
  const handleRejectRequest = async (requestId: number | string) => {
    const reason = prompt("يرجى كتابة سبب رفض طلب السداد للمستخدم:", "تعذر التحقق من صحة التحويل البنكي أو رقم المرجع.");
    if (reason === null) return;

    setProcessingRequestId(requestId);
    try {
      await apiFetch(`/admin/plan-payment-requests/${requestId}/reject`, {
        method: "PUT",
        body: JSON.stringify({ reason }),
      });
      toast.success("تم تسجيل رفض الطلب وإشعار المستخدم بالسبب");
      await Promise.all([fetchPaymentRequests(), fetchStats()]);
    } catch (err: any) {
      toast.error(err?.message || "تعذر رفض الطلب");
    } finally {
      setProcessingRequestId(null);
    }
  };

  return (
    <div className="space-y-6 pb-16" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-gradient-gold font-bold flex items-center gap-2.5">
            <CreditCard className="h-8 w-8 text-gold" />
            بناء وإدارة الباقات والاشتراكات
          </h1>
          <p className="text-foreground/60 text-sm mt-1">
            صانع الباقات الذكي (Plan Builder)، سجل اشتراكات المستخدمين، ومراجعة طلبات التحويل
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs border border-gold-soft/40 px-3.5 py-2 rounded-xl text-foreground/80 hover:text-gold hover:border-gold transition bg-surface"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-gold" : ""}`} /> تحديث البيانات
          </button>

          {activeTab === "plans" && (
            <button
              type="button"
              onClick={openCreatePlanModal}
              className="inline-flex items-center gap-2 bg-gold-gradient text-primary-foreground font-bold px-4 py-2 rounded-xl shadow-gold hover:opacity-95 transition text-xs"
            >
              <Plus className="h-4 w-4" /> إضافة باقة جديدة
            </button>
          )}

          {activeTab === "subscriptions" && (
            <button
              type="button"
              onClick={openAddSubModal}
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-md transition text-xs"
            >
              <Plus className="h-4 w-4" /> إضافة اشتراك لمستخدم
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-surface border border-gold-soft/30 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-foreground/60 mb-2">
            <span>إجمالي الاشتراكات</span>
            <div className="h-7 w-7 rounded-lg bg-gold/15 text-gold flex items-center justify-center font-bold">💳</div>
          </div>
          <div className="font-display text-2xl font-bold text-foreground font-mono">{stats.total_subscriptions}</div>
          <p className="text-[11px] text-foreground/50 mt-1">سجلات الاشتراكات بالمنصة</p>
        </div>

        <div className="bg-surface border border-emerald-500/30 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-emerald-400 mb-2">
            <span>الاشتراكات السارية</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">✓</div>
          </div>
          <div className="font-display text-2xl font-bold text-emerald-400 font-mono">{stats.active_subscriptions}</div>
          <p className="text-[11px] text-foreground/50 mt-1">متمتعون بالمزايا حالياً</p>
        </div>

        <div className="bg-surface border border-cyan-500/30 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-cyan-400 mb-2">
            <span>الإيراد الشهري (MRR)</span>
            <div className="h-7 w-7 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center font-bold">📈</div>
          </div>
          <div className="font-display text-2xl font-bold text-cyan-400 font-mono">
            {Math.round(stats.mrr_estimate).toLocaleString("ar-EG")} <span className="text-xs font-sans">ج.م</span>
          </div>
          <p className="text-[11px] text-foreground/50 mt-1">تقدير الإيراد الشهري المتكرر</p>
        </div>

        <div className="bg-surface border border-purple-500/30 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-purple-400 mb-2">
            <span>باقات المنصة</span>
            <div className="h-7 w-7 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center font-bold">⭐</div>
          </div>
          <div className="font-display text-2xl font-bold text-purple-400 font-mono">{stats.total_plans}</div>
          <p className="text-[11px] text-foreground/50 mt-1">({stats.active_plans} باقة معروضة ونشطة)</p>
        </div>

        <div className="bg-surface border border-amber-500/30 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-amber-400 mb-2">
            <span>طلبات السداد المعلقة</span>
            <div className="h-7 w-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">⏳</div>
          </div>
          <div className="font-display text-2xl font-bold text-amber-400 font-mono">{stats.pending_requests}</div>
          <p className="text-[11px] text-foreground/50 mt-1">بانتظار مراجعة التحويل</p>
        </div>
      </div>

      {/* Main Tabs Navigation Bar */}
      <div className="flex gap-2 p-1.5 bg-surface border border-gold-soft/30 rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveTab("plans")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 ${
            activeTab === "plans"
              ? "bg-gold text-primary-foreground shadow-gold"
              : "text-foreground/70 hover:text-foreground hover:bg-elevated/40"
          }`}
        >
          <Star className="h-4 w-4" />
          <span>⭐ بناء وإدارة الباقات (Plan Builder)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/20 text-current">{plans.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("subscriptions")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 ${
            activeTab === "subscriptions"
              ? "bg-gold text-primary-foreground shadow-gold"
              : "text-foreground/70 hover:text-foreground hover:bg-elevated/40"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>👥 سجل اشتراكات المستخدمين</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/20 text-current">{stats.total_subscriptions}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("requests")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 ${
            activeTab === "requests"
              ? "bg-gold text-primary-foreground shadow-gold"
              : "text-foreground/70 hover:text-foreground hover:bg-elevated/40"
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>💳 طلبات سداد الباقات المعلقة</span>
          {stats.pending_requests > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 font-mono">
              {stats.pending_requests}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: PLAN BUILDER */}
      {activeTab === "plans" && (
        <div className="space-y-6">
          {/* Quick Preset Templates */}
          <div className="bg-surface border border-gold-soft/30 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span>⚡ إضافة باقة جاهزة بنقرة واحدة (Plan Templates)</span>
                </h3>
                <p className="text-xs text-foreground/50 mt-0.5">
                  نماذج جاهزة مجهزة بالميزات والأسعار يمكنك إضافتها فوراً والتعديل عليها
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleCreatePreset("vip")}
                className="p-3.5 rounded-xl bg-elevated/70 border border-gold-soft/20 hover:border-gold text-right transition group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground group-hover:text-gold">الباقة الذهبية للمحامين VIP</span>
                  <span className="text-[11px] font-mono text-gold font-bold">499 ج/شهر</span>
                </div>
                <p className="text-[11px] text-foreground/50 mt-1 line-clamp-1">5,000 استعلام AI + ظهور بصدارة الدليل</p>
              </button>

              <button
                type="button"
                onClick={() => handleCreatePreset("annual")}
                className="p-3.5 rounded-xl bg-elevated/70 border border-gold-soft/20 hover:border-gold text-right transition group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground group-hover:text-gold">الباقة السنوية الاحترافية (Pro)</span>
                  <span className="text-[11px] font-mono text-cyan-400 font-bold">3,999 ج/سنة</span>
                </div>
                <p className="text-[11px] text-foreground/50 mt-1 line-clamp-1">خصم 20% + إدارة الفريق + 20,000 استعلام</p>
              </button>

              <button
                type="button"
                onClick={() => handleCreatePreset("free")}
                className="p-3.5 rounded-xl bg-elevated/70 border border-gold-soft/20 hover:border-gold text-right transition group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground group-hover:text-gold">الباقة المجانية الاستكشافية</span>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">مجاناً</span>
                </div>
                <p className="text-[11px] text-foreground/50 mt-1 line-clamp-1">تصفح السوق وحجز الاستشارات الأساسية</p>
              </button>
            </div>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {plans.map((p) => {
              const features = Array.isArray(p.features) ? p.features : [];
              return (
                <div
                  key={p.id}
                  className={`bg-surface border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                    p.status ? "border-gold-soft/40 shadow-sm" : "border-border opacity-70"
                  }`}
                >
                  <div>
                    {/* Badge & Status Top Row */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {p.badge_text && (
                          <span className="text-[10px] bg-gold/15 text-gold border border-gold/30 px-2 py-0.5 rounded-full font-bold">
                            {p.badge_text}
                          </span>
                        )}
                        <span className="text-[10px] bg-elevated px-2 py-0.5 rounded-full text-foreground/60 border border-gold-soft/10">
                          {p.target_audience === "lawyers"
                            ? "المحامين والمكاتب"
                            : p.target_audience === "clients"
                            ? "الموكلين والعملاء"
                            : p.target_audience === "corporate"
                            ? "الشركات"
                            : "جميع المستخدمين"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTogglePlanStatus(p.id)}
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold transition ${
                          p.status
                            ? "bg-green-500/10 text-green-400 border border-green-500/30"
                            : "bg-red-500/10 text-red-400 border border-red-500/30"
                        }`}
                        title="انقر لتغيير حالة التفعيل"
                      >
                        {p.status ? "✓ مفعلة" : "✕ معطلة"}
                      </button>
                    </div>

                    <h3 className="font-display text-lg font-bold text-foreground">
                      {p.name_ar || p.name}
                    </h3>
                    {p.name_ar && p.name !== p.name_ar && (
                      <div className="text-[11px] text-foreground/40 font-mono">{p.name}</div>
                    )}
                    <p className="text-xs text-foreground/60 mt-1.5 line-clamp-2">{p.description || "بدون وصف"}</p>

                    <div className="mt-4 flex items-baseline gap-1.5">
                      <span className="font-display text-3xl font-bold text-gold font-mono">
                        {Math.round(Number(p.price))}
                      </span>
                      <span className="text-xs text-foreground/60">
                        {p.currency} / {p.billing_interval === "yearly" ? "سنوياً" : p.billing_interval === "quarterly" ? "كل 3 أشهر" : "شهرياً"}
                      </span>
                    </div>

                    {/* Feature highlights */}
                    <div className="mt-4 pt-3 border-t border-gold-soft/15 space-y-2">
                      <div className="flex items-center justify-between text-xs text-foreground/70">
                        <span>مساعد الذكاء الاصطناعي:</span>
                        <span className="font-bold text-foreground">
                          {p.ai_enabled ? `${p.monthly_ai_limit || "مفتوح"} استعلام` : "غير متاح"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-foreground/70">
                        <span>الاشتراكات الحالية:</span>
                        <span className="font-bold text-gold font-mono">{p.subscriptions_count || 0} مشترك</span>
                      </div>

                      {features.length > 0 && (
                        <div className="pt-2 space-y-1.5">
                          {features.slice(0, 4).map((f, i) => (
                            <div key={i} className="text-[11px] text-foreground/80 flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-gold shrink-0" />
                              <span className="truncate">{f}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-6 pt-4 border-t border-gold-soft/20 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleBroadcastPlan(p)}
                      className="p-2 rounded-lg bg-gold/10 hover:bg-gold/20 text-gold transition"
                      title="إرسال إشعار ترويجي للمستخدمين بالباقة"
                    >
                      <Megaphone className="h-3.5 w-3.5" />
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditPlanModal(p)}
                        className="inline-flex items-center gap-1 text-xs border border-gold-soft/40 hover:border-gold px-3 py-1.5 rounded-lg text-foreground/80 hover:text-gold transition bg-elevated/50"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePlan(p)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition"
                        title="حذف الباقة"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: USER SUBSCRIPTIONS REGISTRY */}
      {activeTab === "subscriptions" && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface border border-gold-soft/30 p-4 rounded-2xl">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
              <input
                type="text"
                value={subSearch}
                onChange={(e) => setSubSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchSubscriptions(1)}
                placeholder="ابحث بالاسم، البريد الإلكتروني، أو الهاتف..."
                className="w-full bg-elevated border border-gold-soft/30 focus:border-gold rounded-xl pr-9 pl-4 py-2 text-xs text-foreground placeholder:text-foreground/40 outline-none"
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-foreground/60">الحالة:</span>
                <select
                  value={subStatusFilter}
                  onChange={(e) => setSubStatusFilter(e.target.value)}
                  style={{ colorScheme: "dark" }}
                  className="bg-elevated border border-gold-soft/30 rounded-xl px-3 py-1.5 text-xs text-foreground outline-none cursor-pointer"
                >
                  <option value="all">كافة الحالات</option>
                  <option value="active">نشط (ساري)</option>
                  <option value="trial">فترة تجريبية</option>
                  <option value="cancelled">ملغي</option>
                  <option value="expired">منتهي</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-foreground/60">الباقة:</span>
                <select
                  value={subPlanFilter}
                  onChange={(e) => setSubPlanFilter(e.target.value)}
                  style={{ colorScheme: "dark" }}
                  className="bg-elevated border border-gold-soft/30 rounded-xl px-3 py-1.5 text-xs text-foreground outline-none cursor-pointer"
                >
                  <option value="all">كافة الباقات</option>
                  {plans.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name_ar || p.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => fetchSubscriptions(1)}
                className="text-xs bg-gold/10 text-gold border border-gold/30 hover:bg-gold hover:text-primary-foreground px-3.5 py-1.5 rounded-xl transition"
              >
                تطبيق البحث
              </button>
            </div>
          </div>

          {/* Subscriptions Table */}
          <div className="bg-surface border border-gold-soft/30 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-elevated/70 text-foreground/70 border-b border-gold-soft/20 font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">المستخدم</th>
                    <th className="py-3.5 px-4">الباقة المشترك بها</th>
                    <th className="py-3.5 px-4">السعر والدورة</th>
                    <th className="py-3.5 px-4">تاريخ البدء</th>
                    <th className="py-3.5 px-4">تاريخ الانتهاء</th>
                    <th className="py-3.5 px-4">الحالة</th>
                    <th className="py-3.5 px-4 text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-soft/10">
                  {subscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-foreground/40">
                        لا توجد اشتراكات مسجلة وفقاً لمعايير البحث
                      </td>
                    </tr>
                  ) : (
                    subscriptions.map((s) => (
                      <tr key={s.id} className="hover:bg-elevated/40 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-foreground">{s.user?.name || "مستخدم"}</div>
                          <div className="text-[11px] text-foreground/50 font-mono mt-0.5">
                            {s.user?.email || s.user?.phone || `ID: ${s.user_id}`}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-foreground">
                            {s.plan?.name_ar || s.plan?.name || "باقة غير معروفة"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-mono text-gold font-bold">
                            {s.plan?.price ? `${Math.round(s.plan.price)} ${s.plan.currency || "ج.م"}` : "مجاناً"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-foreground/70 font-mono text-[11px]">
                          {s.starts_at ? new Date(s.starts_at).toLocaleDateString("ar-EG") : "—"}
                        </td>

                        <td className="py-3.5 px-4 text-foreground/70 font-mono text-[11px]">
                          {s.ends_at ? (
                            <span className={new Date(s.ends_at) < new Date() ? "text-red-400" : "text-foreground"}>
                              {new Date(s.ends_at).toLocaleDateString("ar-EG")}
                            </span>
                          ) : (
                            "مفتوح"
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-sans font-medium ${
                              s.status === "active"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : s.status === "trial"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                : s.status === "cancelled"
                                ? "bg-red-500/10 text-red-400 border border-red-500/30"
                                : "bg-elevated text-foreground/60 border border-border"
                            }`}
                          >
                            {s.status === "active"
                              ? "✓ ساري ونشط"
                              : s.status === "trial"
                              ? "⏳ تجريبي"
                              : s.status === "cancelled"
                              ? "✕ ملغي"
                              : "منتهي"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-left">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleSubStatus(s.id)}
                              className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                                s.status === "active"
                                  ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                                  : "border-green-500/30 text-green-400 hover:bg-green-500/10"
                              }`}
                            >
                              {s.status === "active" ? "إلغاء الاشتراك" : "تفعيل"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSub(s.id)}
                              className="p-1 text-foreground/40 hover:text-red-400 transition"
                              title="حذف السجل"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {subTotalPages > 1 && (
              <div className="p-3 border-t border-gold-soft/20 flex items-center justify-between text-xs text-foreground/60">
                <span>صفحة {subPage} من {subTotalPages}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={subPage <= 1}
                    onClick={() => setSubPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded-lg border border-border hover:border-gold disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={subPage >= subTotalPages}
                    onClick={() => setSubPage((p) => p + 1)}
                    className="p-1 rounded-lg border border-border hover:border-gold disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PENDING PLAN PAYMENT REQUESTS */}
      {activeTab === "requests" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-surface border border-gold-soft/30 p-4 rounded-2xl">
            <div>
              <h2 className="text-sm font-bold text-foreground">طلبات السداد والترقية المحولة من المستخدمين</h2>
              <p className="text-xs text-foreground/50 mt-0.5">
                راجع أرقام الحوالات والتحويلات عبر إنستاباي والمحافظ الإلكترونية واعتمد التفعيل بنقرة واحدة
              </p>
            </div>

            <div className="flex gap-1.5 bg-elevated p-1 rounded-xl border border-gold-soft/20 text-xs">
              {(["pending", "approved", "rejected", "all"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setRequestFilter(st)}
                  className={`px-3 py-1 rounded-lg transition font-medium ${
                    requestFilter === st
                      ? "bg-gold text-primary-foreground font-bold"
                      : "text-foreground/70 hover:text-foreground"
                  }`}
                >
                  {st === "pending"
                    ? "قيد المراجعة"
                    : st === "approved"
                    ? "معتمدة"
                    : st === "rejected"
                    ? "مرفوضة"
                    : "الكل"}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface border border-gold-soft/30 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-elevated/70 text-foreground/70 border-b border-gold-soft/20 font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">المستخدم الطالب</th>
                    <th className="py-3.5 px-4">الباقة المطلوبة</th>
                    <th className="py-3.5 px-4">المبلغ وطريقة الدفع</th>
                    <th className="py-3.5 px-4">رقم العملية / المرجع</th>
                    <th className="py-3.5 px-4">تاريخ الطلب</th>
                    <th className="py-3.5 px-4">الحالة</th>
                    <th className="py-3.5 px-4 text-left">الإجراء والاعتماد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-soft/10">
                  {paymentRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-foreground/40">
                        لا توجد طلبات سداد مطابقة للحالة المختارة
                      </td>
                    </tr>
                  ) : (
                    paymentRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-elevated/40 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-foreground">{req.user?.name || "مستخدم"}</div>
                          <div className="text-[11px] text-foreground/50 font-mono mt-0.5">
                            {req.user?.phone || req.user?.email || `ID: ${req.user_id}`}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-foreground">
                            {req.plan?.name_ar || req.plan?.name || "باقة غير محددة"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-mono text-gold font-bold">
                            {Math.round(req.amount)} {req.currency}
                          </div>
                          <div className="text-[10px] text-foreground/50 mt-0.5">
                            {req.payment_method_name || req.payment_method_key || "تحويل"}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[11px] text-cyan-400 font-bold">
                          {req.transaction_reference || "—"}
                        </td>

                        <td className="py-3.5 px-4 text-foreground/70 font-mono text-[11px]">
                          {new Date(req.created_at).toLocaleDateString("ar-EG")}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-sans font-medium ${
                              req.status === "approved"
                                ? "bg-green-500/10 text-green-400 border border-green-500/30"
                                : req.status === "rejected"
                                ? "bg-red-500/10 text-red-400 border border-red-500/30"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {req.status === "approved"
                              ? "✓ معتمد ومفعل"
                              : req.status === "rejected"
                              ? "✕ مرفوض"
                              : "⏳ بانتظار المراجعة"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-left">
                          {req.status === "pending" ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={processingRequestId === req.id}
                                onClick={() => handleApproveRequest(req.id)}
                                className="inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition disabled:opacity-50"
                              >
                                <Check className="h-3.5 w-3.5" /> اعتماد وتفعيل
                              </button>
                              <button
                                type="button"
                                disabled={processingRequestId === req.id}
                                onClick={() => handleRejectRequest(req.id)}
                                className="inline-flex items-center gap-1 border border-red-500/40 text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg text-xs transition disabled:opacity-50"
                              >
                                <X className="h-3.5 w-3.5" /> رفض
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-foreground/40 font-sans">
                              {req.admin_notes || "تمت المعالجة"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT PLAN */}
      <Dialog open={showPlanModal} onOpenChange={setShowPlanModal}>
        <DialogContent className="max-w-2xl bg-surface border border-gold-soft/40 text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-gradient-gold">
              {editingPlanId ? "تعديل باقة الاشتراك" : "إنشاء باقة اشتراك جديدة (Plan Builder)"}
            </DialogTitle>
            <DialogDescription className="text-foreground/60 text-xs">
              حدد خصائص الباقة، الأسعار، الحدود المتاحة للذكاء الاصطناعي، والجمهور المستهدف.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[65vh] overflow-y-auto pl-1 pr-1">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-foreground/70 mb-1.5">اسم الباقة (بالإنجليزية) *</label>
                <input
                  type="text"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  placeholder="مثال: Professional Lawyer"
                  className="w-full bg-elevated border border-gold-soft/30 rounded-lg px-3 py-2 text-foreground text-xs outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="block text-xs text-foreground/70 mb-1.5">اسم الباقة (بالعربية) *</label>
                <input
                  type="text"
                  value={planForm.name_ar}
                  onChange={(e) => setPlanForm({ ...planForm, name_ar: e.target.value })}
                  placeholder="مثال: باقة المحامي المحترف"
                  className="w-full bg-elevated border border-gold-soft/30 rounded-lg px-3 py-2 text-foreground text-xs outline-none focus:border-gold"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-foreground/70 mb-1.5">السعر *</label>
                <input
                  type="number"
                  value={planForm.price}
                  onChange={(e) => setPlanForm({ ...planForm, price: Number(e.target.value) })}
                  className="w-full bg-elevated border border-gold-soft/30 rounded-lg px-3 py-2 text-foreground text-xs outline-none focus:border-gold font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-foreground/70 mb-1.5">العملة</label>
                <input
                  type="text"
                  value={planForm.currency}
                  onChange={(e) => setPlanForm({ ...planForm, currency: e.target.value })}
                  className="w-full bg-elevated border border-gold-soft/30 rounded-lg px-3 py-2 text-foreground text-xs outline-none focus:border-gold font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-foreground/70 mb-1.5">دورة الفوترة *</label>
                <select
                  value={planForm.billing_interval}
                  onChange={(e) => setPlanForm({ ...planForm, billing_interval: e.target.value })}
                  style={{ colorScheme: "dark" }}
                  className="w-full bg-elevated border border-gold-soft/30 rounded-lg px-3 py-2 text-foreground text-xs outline-none focus:border-gold cursor-pointer"
                >
                  <option value="monthly">شهرياً (Monthly)</option>
                  <option value="quarterly">كل 3 أشهر (Quarterly)</option>
                  <option value="yearly">سنوياً (Yearly)</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-foreground/70 mb-1.5">الجمهور المستهدف</label>
                <select
                  value={planForm.target_audience}
                  onChange={(e) => setPlanForm({ ...planForm, target_audience: e.target.value })}
                  style={{ colorScheme: "dark" }}
                  className="w-full bg-elevated border border-gold-soft/30 rounded-lg px-3 py-2 text-foreground text-xs outline-none focus:border-gold cursor-pointer"
                >
                  <option value="all">الجميع (All Users)</option>
                  <option value="lawyers">المحامون والمكاتب (Lawyers)</option>
                  <option value="clients">العملاء والموكلون (Clients)</option>
                  <option value="corporate">الشركات والمؤسسات (Corporate)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-foreground/70 mb-1.5">شارة مميزة (Badge Text)</label>
                <input
                  type="text"
                  value={planForm.badge_text}
                  onChange={(e) => setPlanForm({ ...planForm, badge_text: e.target.value })}
                  placeholder="مثال: الأكثر طلباً أو خصم 20%"
                  className="w-full bg-elevated border border-gold-soft/30 rounded-lg px-3 py-2 text-foreground text-xs outline-none focus:border-gold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-foreground/70 mb-1.5">الوصف التسويقي للباقة</label>
              <textarea
                value={planForm.description}
                onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                rows={2}
                placeholder="نبذة مختصرة عن الباقة وتناسب من..."
                className="w-full bg-elevated border border-gold-soft/30 rounded-lg px-3 py-2 text-foreground text-xs outline-none focus:border-gold"
              />
            </div>

            <div>
              <label className="block text-xs text-foreground/70 mb-1.5">
                مزايا الباقة (سطر واحد لكل ميزة)
              </label>
              <textarea
                value={planForm.features_text}
                onChange={(e) => setPlanForm({ ...planForm, features_text: e.target.value })}
                rows={4}
                className="w-full bg-elevated border border-gold-soft/30 rounded-lg px-3 py-2 text-foreground text-xs outline-none focus:border-gold font-mono"
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-4 border-t border-gold-soft/15 pt-3">
              <div>
                <label className="block text-xs text-foreground/70 mb-1.5">استعلامات AI شهرياً</label>
                <input
                  type="number"
                  value={planForm.monthly_ai_limit}
                  onChange={(e) => setPlanForm({ ...planForm, monthly_ai_limit: Number(e.target.value) })}
                  className="w-full bg-elevated border border-gold-soft/30 rounded-lg px-3 py-2 text-foreground text-xs outline-none focus:border-gold font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-foreground/70 mb-1.5">الحد الأقصى للقضايا</label>
                <input
                  type="number"
                  value={planForm.max_cases}
                  onChange={(e) => setPlanForm({ ...planForm, max_cases: e.target.value })}
                  placeholder="اتركه فارغاً لغير محدود"
                  className="w-full bg-elevated border border-gold-soft/30 rounded-lg px-3 py-2 text-foreground text-xs outline-none focus:border-gold font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-foreground/70 mb-1.5">ترتيب الظهور</label>
                <input
                  type="number"
                  value={planForm.sort_order}
                  onChange={(e) => setPlanForm({ ...planForm, sort_order: Number(e.target.value) })}
                  className="w-full bg-elevated border border-gold-soft/30 rounded-lg px-3 py-2 text-foreground text-xs outline-none focus:border-gold font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 border-t border-gold-soft/15 pt-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={planForm.status}
                  onChange={(e) => setPlanForm({ ...planForm, status: e.target.checked })}
                  className="rounded border-border text-gold focus:ring-gold"
                />
                <span>تفعيل الباقة وعرضها للجمهور</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={planForm.is_popular}
                  onChange={(e) => setPlanForm({ ...planForm, is_popular: e.target.checked })}
                  className="rounded border-border text-gold focus:ring-gold"
                />
                <span>إبراز كباقة شائعة (Popular)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={planForm.ai_enabled}
                  onChange={(e) => setPlanForm({ ...planForm, ai_enabled: e.target.checked })}
                  className="rounded border-border text-gold focus:ring-gold"
                />
                <span>تفعيل الذكاء الاصطناعي</span>
              </label>
            </div>
          </div>

          <DialogFooter className="border-t border-gold-soft/20 pt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setShowPlanModal(false)}
              className="px-4 py-2 rounded-xl border border-border text-xs text-foreground/70 hover:text-foreground"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSavePlan}
              disabled={savingPlan}
              className="bg-gold-gradient text-primary-foreground font-bold px-6 py-2 rounded-xl shadow-gold hover:opacity-95 text-xs transition disabled:opacity-50"
            >
              {savingPlan ? "جاري الحفظ..." : editingPlanId ? "تحديث الباقة" : "إنشاء الباقة"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: MANUAL ADD SUBSCRIPTION TO USER */}
      <Dialog open={showSubModal} onOpenChange={setShowSubModal}>
        <DialogContent className="max-w-lg bg-surface border border-gold-soft/40 text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-gradient-gold">
              إضافة وتفعيل اشتراك لمستخدم
            </DialogTitle>
            <DialogDescription className="text-foreground/60 text-xs">
              اختر المستخدم والباقة المراد تفعيلها وتحديد مدة الاشتراك يدوياً.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-foreground/70 mb-1.5">اختر المستخدم *</label>
              <select
                value={subForm.user_id}
                onChange={(e) => setSubForm({ ...subForm, user_id: e.target.value })}
                style={{ colorScheme: "dark" }}
                className="w-full bg-elevated border border-gold-soft/30 rounded-lg px-3 py-2 text-foreground text-xs outline-none focus:border-gold cursor-pointer"
              >
                <option value="">— اختر المستخدم —</option>
                {usersList.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.name || u.full_name} ({u.email || u.phone}) • {u.role === "lawyer" ? "محامٍ" : "عميل"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-foreground/70 mb-1.5">اختر الباقة *</label>
              <select
                value={subForm.subscription_plan_id}
                onChange={(e) => setSubForm({ ...subForm, subscription_plan_id: e.target.value })}
                style={{ colorScheme: "dark" }}
                className="w-full bg-elevated border border-gold-soft/30 rounded-lg px-3 py-2 text-foreground text-xs outline-none focus:border-gold cursor-pointer"
              >
                <option value="">— اختر الباقة —</option>
                {plans.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name_ar || p.name} ({Math.round(p.price)} {p.currency})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-foreground/70 mb-1.5">تاريخ البدء</label>
                <input
                  type="date"
                  value={subForm.starts_at}
                  onChange={(e) => setSubForm({ ...subForm, starts_at: e.target.value })}
                  style={{ colorScheme: "dark" }}
                  className="w-full bg-elevated border border-gold-soft/30 rounded-lg px-3 py-2 text-foreground text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-foreground/70 mb-1.5">تاريخ الانتهاء</label>
                <input
                  type="date"
                  value={subForm.ends_at}
                  onChange={(e) => setSubForm({ ...subForm, ends_at: e.target.value })}
                  style={{ colorScheme: "dark" }}
                  className="w-full bg-elevated border border-gold-soft/30 rounded-lg px-3 py-2 text-foreground text-xs outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-foreground/70 mb-1.5">حالة الاشتراك</label>
              <select
                value={subForm.status}
                onChange={(e) => setSubForm({ ...subForm, status: e.target.value })}
                style={{ colorScheme: "dark" }}
                className="w-full bg-elevated border border-gold-soft/30 rounded-lg px-3 py-2 text-foreground text-xs outline-none cursor-pointer"
              >
                <option value="active">نشط وساري (Active)</option>
                <option value="trial">فترة تجريبية (Trial)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-foreground/70 mb-1.5">ملاحظات الإدارة</label>
              <input
                type="text"
                value={subForm.notes}
                onChange={(e) => setSubForm({ ...subForm, notes: e.target.value })}
                placeholder="سبب التفعيل اليدوي..."
                className="w-full bg-elevated border border-gold-soft/30 rounded-lg px-3 py-2 text-foreground text-xs outline-none"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-gold-soft/20 pt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setShowSubModal(false)}
              className="px-4 py-2 rounded-xl border border-border text-xs text-foreground/70 hover:text-foreground"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSaveSub}
              disabled={savingSub}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-6 py-2 rounded-xl text-xs transition disabled:opacity-50"
            >
              {savingSub ? "جاري التفعيل..." : "تفعيل الاشتراك للمستخدم"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
