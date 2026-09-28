import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { ArrowRight, Loader2, Search, X, Check, Phone, Mail, MapPin, User, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/dashboard/lawyer/cases/new")({
  head: () => ({ meta: [{ title: "قضية جديدة — الوكيل" }] }),
  component: NewCase,
});

const DEFAULT_TYPES = [
  { v: "criminal", l: "جنائي" },
  { v: "civil", l: "مدني" },
  { v: "real_estate", l: "عقاري" },
  { v: "commercial", l: "تجاري" },
  { v: "family", l: "أسرة" },
  { v: "administrative", l: "إداري" },
  { v: "labor", l: "عمالي" },
  { v: "other", l: "أخرى" },
];

function NewCase() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clientMode, setClientMode] = useState<"new" | "existing" | "manual">("manual");
  const [existingClients, setExistingClients] = useState<any[]>([]);
  const [manualClients, setManualClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedManualId, setSelectedManualId] = useState<string>("");
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [caseTypes, setCaseTypes] = useState<{ v: string; l: string }[]>(DEFAULT_TYPES);
  const [f, setF] = useState({
    case_number: "", title: "", type: "civil", court: "", court_department: "",
    next_hearing: "", facts: "", opposing_party: "", opposing_lawyer: "", judge: "",
    total_fees: "", paid_fees: "", client_name: "", client_phone: "",
  });

  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await supabase.from("categories").select("*");
        const list = res?.data ?? [];
        if (Array.isArray(list) && list.length > 0) {
          const types: { v: string; l: string }[] = [];
          list.forEach((cat: any) => {
            if (cat.name_ar) {
              types.push({ v: cat.slug || cat.name_ar, l: cat.name_ar });
            }
            if (Array.isArray(cat.children)) {
              cat.children.forEach((sub: any) => {
                if (sub.name_ar) {
                  types.push({ v: sub.slug || sub.name_ar, l: `— ${sub.name_ar}` });
                }
              });
            }
          });
          if (types.length > 0) {
            setCaseTypes(types);
            setF((prev) => ({ ...prev, type: types[0].v }));
          }
        }
      } catch {/* ignore */}
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      if (clientMode === "existing") {
        setLoadingClients(true);
        try {
          const { data } = await supabase.from("clients").select("*");
          setExistingClients(Array.isArray(data) ? data : []);
        } catch (err) {
          console.error("Failed to load clients", err);
          setExistingClients([]);
        } finally {
          setLoadingClients(false);
        }
      } else if (clientMode === "manual") {
        const { data } = await supabase
          .from("manual_clients")
          .select("id, full_name, phone")
          .eq("lawyer_id", userId)
          .order("created_at", { ascending: false });
        setManualClients(data ?? []);
      }
    })();
  }, [userId, clientMode]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!f.title.trim()) e.title = "عنوان القضية مطلوب";
    if (!f.type) e.type = "نوع القضية مطلوب";
    if (clientMode === "existing" && !selectedClientId) e.client = "اختر موكلاً من القائمة";
    if (clientMode === "manual" && !selectedManualId && !f.client_name.trim()) e.client = "اختر موكلاً خارجياً أو اكتب اسماً";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!userId) return;
    if (!validate()) return;
    setLoading(true);
    try {
      // Plan-limit enforcement (free plan = max 3 active cases)
      const { data: allowed, error: limitErr } = await supabase.rpc("check_plan_limit", { p_resource: "cases" });
      if (!limitErr && allowed === false) {
        toast.error("لقد بلغت الحد الأقصى لخطتك المجانية (3 قضايا نشطة). قم بالترقية للاستمرار.");
        setLoading(false);
        navigate({ to: "/pricing" });
        return;
      }

      // Auto-create a manual client if user typed a name without selecting one
      let manualId: string | null = selectedManualId || null;
      if (clientMode === "manual" && !manualId && f.client_name.trim()) {
        const { data: mc, error: mcErr } = await supabase
          .from("manual_clients")
          .insert({
            lawyer_id: userId,
            full_name: f.client_name.trim(),
            phone: f.client_phone.trim() || null,
          })
          .select("id")
          .single();
        if (mcErr) throw mcErr;
        manualId = mc?.id || null;
      }

      const { data, error } = await supabase
        .from("cases")
        .insert({
          lawyer_id: userId,
          client_id: clientMode === "existing" && selectedClientId ? selectedClientId : null,
          manual_client_id: clientMode === "manual" ? manualId : null,
          case_number: f.case_number || null,
          title: f.title,
          type: f.type,
          court: f.court || null,
          court_department: f.court_department || null,
          next_hearing: f.next_hearing || null,
          facts: f.facts || null,
          opposing_party: f.opposing_party || null,
          opposing_lawyer: f.opposing_lawyer || null,
          judge: f.judge || null,
          total_fees: Number(f.total_fees) || 0,
          paid_fees: Number(f.paid_fees) || 0,
          status: "active",
        })
        .select()
        .single();
      if (error) throw error;
      toast.success("تم حفظ القضية بنجاح ✓");
      const createdId = data?.id || data?.data?.id;
      if (createdId) {
        navigate({ to: "/dashboard/lawyer/cases/$id", params: { id: String(createdId) } });
      } else {
        navigate({ to: "/dashboard/lawyer/cases" });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const filteredExistingClients = existingClients.filter((c) => {
    if (!clientSearchTerm.trim()) return true;
    const term = clientSearchTerm.trim().toLowerCase();
    const name = String(c.full_name || c.name || "").toLowerCase();
    const phone = String(c.phone || "").toLowerCase();
    const email = String(c.email || "").toLowerCase();
    const city = String(c.city || "").toLowerCase();
    return name.includes(term) || phone.includes(term) || email.includes(term) || city.includes(term);
  });

  const selectedClient = existingClients.find(
    (c) => String(c.id) === String(selectedClientId) || String(c.user_id) === String(selectedClientId)
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-gradient-gold font-bold">قضية جديدة</h1>
        <Link to="/dashboard/lawyer/cases" className="text-sm text-foreground/70 hover:text-gold inline-flex items-center gap-2">
          العودة <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <form onSubmit={submit} className="bg-surface border border-gold-soft/40 rounded-2xl p-6 space-y-4">
        <Section title="بيانات القضية">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="رقم القضية" value={f.case_number} onChange={upd("case_number")} />
            <Field label="نوع القضية" required>
              <select value={f.type} onChange={upd("type")} className="w-full bg-elevated border border-gold-soft/40 rounded-lg px-3 py-2.5">
                {caseTypes.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </Field>
          </div>
          <div>
            <label className="block text-xs text-foreground/70 mb-1.5">
              عنوان / موضوع القضية <span className="text-destructive">*</span>
            </label>
            <input
              value={f.title}
              onChange={upd("title")}
              className={`w-full bg-elevated border rounded-lg px-3 py-2.5 text-sm outline-none transition ${
                errors.title ? "border-destructive focus:border-destructive" : "border-gold-soft/40 focus:border-gold"
              }`}
            />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="المحكمة" value={f.court} onChange={upd("court")} />
            <Field label="الدائرة" value={f.court_department} onChange={upd("court_department")} />
          </div>
          <Field label="تاريخ أول جلسة" type="date" value={f.next_hearing} onChange={upd("next_hearing")} />
          <Field label="وقائع القضية">
            <textarea value={f.facts} onChange={upd("facts")} rows={4} maxLength={3000} className="w-full bg-elevated border border-gold-soft/40 rounded-lg px-3 py-2.5" />
          </Field>
        </Section>

        <Section title="الموكل">
          <div className="flex gap-2 mb-3 flex-wrap">
            <button type="button" onClick={() => setClientMode("manual")}
              className={`px-3 py-1.5 rounded-lg text-xs border transition ${clientMode === "manual" ? "bg-gold/15 border-gold text-gold" : "border-border text-foreground/60"}`}>
              موكل خارجي
            </button>
            <button type="button" onClick={() => setClientMode("existing")}
              className={`px-3 py-1.5 rounded-lg text-xs border transition ${clientMode === "existing" ? "bg-gold/15 border-gold text-gold" : "border-border text-foreground/60"}`}>
              موكل مسجّل بالمنصة
            </button>
            <button type="button" onClick={() => setClientMode("new")}
              className={`px-3 py-1.5 rounded-lg text-xs border transition ${clientMode === "new" ? "bg-gold/15 border-gold text-gold" : "border-border text-foreground/60"}`}>
              بدون موكل
            </button>
          </div>

          {clientMode === "manual" && (
            <>
              <Field label="اختر من موكليك الخارجيين">
                <select value={selectedManualId} onChange={(e) => setSelectedManualId(e.target.value)}
                  className="w-full bg-elevated border border-gold-soft/40 rounded-lg px-3 py-2.5">
                  <option value="">— أو أنشئ موكلاً جديداً أدناه —</option>
                  {manualClients.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.full_name} {c.phone ? `(${c.phone})` : ""}</option>
                  ))}
                </select>
              </Field>
              {!selectedManualId && (
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  <Field label="اسم الموكل الجديد" value={f.client_name} onChange={upd("client_name")} placeholder="سيُحفظ تلقائياً" />
                  <Field label="هاتف الموكل" value={f.client_phone} onChange={upd("client_phone")} />
                </div>
              )}
              {errors.client && <p className="text-xs text-destructive mt-1">{errors.client}</p>}
              <p className="text-xs text-gold/70 bg-gold/5 border border-gold/20 rounded-lg px-3 py-2 mt-2">
                💡 الموكل الخارجي = شخص/شركة بدون حساب على المنصة. يمكنك إدارته من صفحة "الموكلون".
              </p>
            </>
          )}

          {clientMode === "existing" && (
            <div className="space-y-3">
              {selectedClient ? (
                <div>
                  <label className="block text-xs text-foreground/70 mb-1.5">
                    الموكل المختار <span className="text-destructive">*</span>
                  </label>
                  <div className="p-3.5 rounded-xl border border-gold/40 bg-gold/5 flex items-center justify-between gap-3 shadow-sm transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold/30 to-gold/10 text-gold flex items-center justify-center font-bold text-base border border-gold/30 shrink-0">
                        {selectedClient.full_name?.charAt(0) || <User className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground truncate">
                            {selectedClient.full_name}
                          </span>
                          <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium shrink-0">
                            <Check className="w-3 h-3" /> موكل مسجّل بالمنصة
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-foreground/60 mt-1 flex-wrap">
                          {selectedClient.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-gold/80" />
                              <span dir="ltr">{selectedClient.phone}</span>
                            </span>
                          )}
                          {selectedClient.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-gold/80" />
                              <span dir="ltr">{selectedClient.email}</span>
                            </span>
                          )}
                          {selectedClient.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-gold/80" />
                              {selectedClient.city}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClientId("");
                        setClientSearchTerm("");
                        setIsClientDropdownOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs border border-gold/30 hover:border-gold hover:bg-gold/10 text-gold transition shrink-0 flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3 h-3" /> تغيير الموكل
                    </button>
                  </div>
                </div>
              ) : (
                <div ref={clientDropdownRef} className="relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs text-foreground/70">
                      ابحث واختر الموكل <span className="text-destructive">*</span>
                    </label>
                    <span className="text-[11px] text-foreground/50">
                      {loadingClients
                        ? "جاري التحميل..."
                        : `(${existingClients.length} موكل مسجّل بالمنصة)`}
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={clientSearchTerm}
                      onChange={(e) => {
                        setClientSearchTerm(e.target.value);
                        setIsClientDropdownOpen(true);
                      }}
                      onFocus={() => setIsClientDropdownOpen(true)}
                      placeholder="ابحث باسم الموكل، رقم الهاتف، أو البريد الإلكتروني..."
                      className={`w-full bg-elevated border rounded-lg pr-9 pl-9 py-2.5 text-sm text-foreground outline-none transition ${
                        errors.client
                          ? "border-destructive focus:border-destructive ring-1 ring-destructive/30"
                          : "border-gold-soft/40 focus:border-gold focus:ring-1 focus:ring-gold/30"
                      }`}
                    />
                    <Search className="w-4 h-4 text-foreground/40 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />

                    {clientSearchTerm && (
                      <button
                        type="button"
                        onClick={() => {
                          setClientSearchTerm("");
                          setIsClientDropdownOpen(true);
                        }}
                        className="w-5 h-5 rounded-full hover:bg-white/10 flex items-center justify-center text-foreground/40 hover:text-foreground absolute left-3 top-1/2 -translate-y-1/2 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {errors.client && (
                    <p className="text-xs text-destructive mt-1">{errors.client}</p>
                  )}

                  {isClientDropdownOpen && (
                    <div className="absolute z-50 mt-1.5 w-full bg-card/95 backdrop-blur-md border border-gold-soft/40 rounded-xl shadow-2xl max-h-72 overflow-y-auto p-1.5 space-y-1">
                      {loadingClients ? (
                        <div className="p-4 text-center text-xs text-foreground/60 flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-gold" />
                          جاري تحميل قائمة الموكلين...
                        </div>
                      ) : filteredExistingClients.length === 0 ? (
                        <div className="p-4 text-center">
                          <p className="text-xs text-foreground/70 font-medium">
                            {clientSearchTerm
                              ? `لم يتم العثور على موكل يطابق "${clientSearchTerm}"`
                              : "لا يوجد موكلون مسجلون حالياً"}
                          </p>
                          <p className="text-[11px] text-foreground/50 mt-1">
                            يمكنك التبديل إلى "موكل خارجي" لإضافة بيانات الموكل يدوياً.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="px-2.5 py-1 text-[11px] text-foreground/40 font-medium flex items-center justify-between border-b border-border/40 mb-1">
                            <span>اختر موكلاً من القائمة أدناه</span>
                            <span>{filteredExistingClients.length} موكل</span>
                          </div>
                          {filteredExistingClients.map((client) => (
                            <button
                              type="button"
                              key={client.id}
                              onClick={() => {
                                setSelectedClientId(client.id);
                                setIsClientDropdownOpen(false);
                                setClientSearchTerm("");
                                if (errors.client) {
                                  setErrors((prev) => ({ ...prev, client: "" }));
                                }
                              }}
                              className="w-full text-right flex items-center justify-between p-2.5 rounded-lg hover:bg-gold/15 cursor-pointer transition border border-transparent hover:border-gold/20 group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-gold/10 text-gold flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-gold group-hover:text-primary-foreground transition">
                                  {client.full_name?.charAt(0) || <User className="w-4 h-4" />}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-foreground group-hover:text-gold transition truncate">
                                    {client.full_name}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-foreground/50 mt-0.5 flex-wrap">
                                    {client.phone && (
                                      <span className="flex items-center gap-1">
                                        <Phone className="w-3 h-3 text-foreground/40" />
                                        <span dir="ltr">{client.phone}</span>
                                      </span>
                                    )}
                                    {client.email && (
                                      <span className="flex items-center gap-1">
                                        <Mail className="w-3 h-3 text-foreground/40" />
                                        <span dir="ltr">{client.email}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {client.city && (
                                <span className="text-[11px] bg-elevated px-2 py-0.5 rounded border border-border text-foreground/60 shrink-0 mr-2">
                                  {client.city}
                                </span>
                              )}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {clientMode === "new" && (
            <p className="text-xs text-foreground/60 bg-elevated rounded-lg px-3 py-2">
              ستُحفظ القضية بدون موكل مرتبط، يمكنك إضافة موكل لاحقاً.
            </p>
          )}
        </Section>

        <Section title="الطرف الآخر">
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="الطرف الآخر" value={f.opposing_party} onChange={upd("opposing_party")} />
            <Field label="محامي الخصم" value={f.opposing_lawyer} onChange={upd("opposing_lawyer")} />
            <Field label="القاضي" value={f.judge} onChange={upd("judge")} />
          </div>
        </Section>

        <Section title="الأتعاب">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="إجمالي الأتعاب (ج.م)" type="number" value={f.total_fees} onChange={upd("total_fees")} />
            <Field label="المدفوع مقدماً (ج.م)" type="number" value={f.paid_fees} onChange={upd("paid_fees")} />
          </div>
        </Section>

        <button type="submit" disabled={loading || !f.title} className="w-full bg-gold-gradient text-primary-foreground font-semibold py-3 rounded-xl shadow-gold inline-flex items-center justify-center gap-2 disabled:opacity-50">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} حفظ القضية
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 pb-4 border-b border-border last:border-0 last:pb-0">
      <h3 className="font-display text-lg text-gold">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, required, children, ...rest }: { label: string; required?: boolean; children?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs text-foreground/70 mb-1.5">{label}{required && <span className="text-destructive"> *</span>}</label>
      {children ?? (
        <input {...rest} required={required} className="w-full bg-elevated border border-gold-soft/40 focus:border-gold rounded-lg px-3 py-2.5 text-foreground outline-none" />
      )}
    </div>
  );
}
