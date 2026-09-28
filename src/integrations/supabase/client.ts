import {
  getToken,
  getStoredUser,
  determineUserRole,
  apiLogin,
  apiRegister,
  apiLogout,
  apiFetch,
} from "@/lib/laravel";

function normalizeLawyer(item: any) {
  if (!item) return null;
  const name = item.name || item.full_name || "محامٍ معتمد";
  const city = item.city_name || item.region_name || item.city || "القاهرة";
  const specs = Array.isArray(item.categories)
    ? item.categories.map((c: any) => c.name_ar || c.name || c)
    : item.specializations || ["عام"];
  return {
    id: String(item.id),
    bio: item.bio || item.bio_ar || "محامٍ ومستشار قانوني معتمد.",
    city: city,
    firm_name: item.office_name || item.firm_name || `مكتب ${name}`,
    specializations: specs,
    experience_years: item.years_of_experience || item.experience_years || 10,
    consultation_price: item.consultation_fee || item.office_fee || 500,
    consultation_price_online: item.online_fee || item.consultation_fee || 400,
    rating: item.rating || 4.8,
    reviews_count: item.reviews_count || 24,
    verified: item.is_verified ?? true,
    bar_number: item.bar_registration_number || item.bar_number || item.syndicate_id || null,
    bar_registration_number: item.bar_registration_number || item.bar_number || item.syndicate_id || null,
    available_online: true,
    available_office: true,
    profile: {
      full_name: name,
      avatar_url: item.profile_image || item.avatar || null,
      location: city,
    },
    ...item,
  };
}

const cachedProfiles = new Map<string, any>();
const chatFileStorage = new Map<string, string>();

type RealtimeListener = {
  event: string;
  table?: string;
  filter?: string;
  callback: (payload: any) => void;
};

class RealtimeChannelMock {
  public channelName: string;
  private listeners: RealtimeListener[] = [];
  private presenceCallbacks: Array<() => void> = [];
  private broadcastCallbacks: Array<{ event: string; callback: (payload: any) => void }> = [];
  private pollInterval: any = null;
  private knownMessageIds = new Set<string>();

  constructor(channelName: string) {
    this.channelName = channelName;
  }

  on(type: string, filterOrEvent: any, callback?: any) {
    if (type === "postgres_changes") {
      this.listeners.push({
        event: filterOrEvent?.event || "*",
        table: filterOrEvent?.table,
        filter: filterOrEvent?.filter,
        callback: callback,
      });
    } else if (type === "broadcast") {
      this.broadcastCallbacks.push({
        event: filterOrEvent?.event,
        callback: callback,
      });
    } else if (type === "presence") {
      this.presenceCallbacks.push(callback);
    }
    return this;
  }

  subscribe(statusCallback?: (status: string) => void) {
    setTimeout(() => {
      if (statusCallback) statusCallback("SUBSCRIBED");
      this.presenceCallbacks.forEach((cb) => {
        try { cb(); } catch {}
      });
    }, 50);

    // If listening to a chat channel (e.g. "chat:1"), poll every 3 seconds for messages from peer
    if (this.channelName.startsWith("chat:")) {
      const convId = this.channelName.replace("chat:", "");
      this.startPollingMessages(convId);
    }

    return this;
  }

  track(_presence: any) {
    setTimeout(() => {
      this.presenceCallbacks.forEach((cb) => {
        try { cb(); } catch {}
      });
    }, 10);
    return this;
  }

  presenceState() {
    return {
      peer: [{ online: true }],
      me: [{ online: true }],
    };
  }

  send(msg: { type: string; event: string; payload?: any }) {
    if (msg.type === "broadcast") {
      this.broadcastCallbacks
        .filter((b) => b.event === msg.event)
        .forEach((b) => {
          try { b.callback({ payload: msg.payload }); } catch {}
        });
    }
    return Promise.resolve();
  }

  triggerChange(table: string, event: string, record: any) {
    for (const l of this.listeners) {
      if (!l.table || l.table === table) {
        if (l.event === "*" || l.event === event) {
          try {
            l.callback({
              eventType: event,
              new: record,
              old: record,
            });
          } catch {}
        }
      }
    }
  }

  private startPollingMessages(convId: string) {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(async () => {
      try {
        const raw = await apiFetch(`/conversations/${convId}/messages?per_page=20`);
        const items = Array.isArray(raw) ? raw : raw?.data || [];
        for (const m of items) {
          const mId = String(m.id);
          if (!this.knownMessageIds.has(mId)) {
            this.knownMessageIds.add(mId);
            const mapped = {
              id: mId,
              conversation_id: String(m.conversation_id || convId),
              sender_id: String(m.sender_id || m.user_id),
              body: m.body || m.message || "",
              attachment_url: m.attachment_url ?? null,
              attachment_name: m.attachment_name ?? null,
              attachment_type: m.attachment_type ?? null,
              attachment_size: m.attachment_size ?? null,
              delivered_at: m.delivered_at,
              read_at: m.read_at,
              created_at: m.created_at,
            };
            this.triggerChange("messages", "INSERT", mapped);
          }
        }
      } catch {}
    }, 3000);
  }

  destroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.listeners = [];
    this.presenceCallbacks = [];
    this.broadcastCallbacks = [];
  }
}

const activeChannels = new Map<string, RealtimeChannelMock>();

function broadcastRealtimeChange(table: string, event: string, record: any) {
  for (const chan of activeChannels.values()) {
    chan.triggerChange(table, event, record);
  }
}

class LaravelQueryBuilder {
  private tableName: string;
  private action: "select" | "insert" | "update" | "delete" = "select";
  private payload: any = null;
  private filters: Array<{ field: string; op: string; val: any }> = [];

  constructor(table: string) {
    this.tableName = table;
  }

  select(_cols?: string, _opts?: any) {
    if (this.action !== "insert" && this.action !== "update") {
      this.action = "select";
    }
    return this;
  }

  insert(data: any) {
    this.action = "insert";
    this.payload = data;
    return this;
  }

  update(data: any) {
    this.action = "update";
    this.payload = data;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(field: string, val: any) {
    this.filters.push({ field, op: "eq", val });
    return this;
  }

  neq(field: string, val: any) {
    this.filters.push({ field, op: "neq", val });
    return this;
  }

  in(field: string, val: any[]) {
    this.filters.push({ field, op: "in", val });
    return this;
  }

  is(field: string, val: any) {
    this.filters.push({ field, op: "is", val });
    return this;
  }

  not(_field: string, _op: string, _val: any) {
    return this;
  }

  gte(field: string, val: any) {
    this.filters.push({ field, op: "gte", val });
    return this;
  }

  lte(field: string, val: any) {
    this.filters.push({ field, op: "lte", val });
    return this;
  }

  lt(field: string, val: any) {
    this.filters.push({ field, op: "lt", val });
    return this;
  }

  contains(field: string, val: any) {
    this.filters.push({ field, op: "contains", val });
    return this;
  }

  ilike(field: string, val: any) {
    this.filters.push({ field, op: "ilike", val });
    return this;
  }

  like(field: string, val: any) {
    this.filters.push({ field, op: "like", val });
    return this;
  }

  or(expr: string) {
    this.filters.push({ field: "or", op: "or", val: expr });
    return this;
  }

  filter(field: string, op: string, val: any) {
    this.filters.push({ field, op, val });
    return this;
  }

  match(record: Record<string, any>) {
    for (const [k, v] of Object.entries(record)) {
      this.filters.push({ field: k, op: "eq", val: v });
    }
    return this;
  }

  textSearch(_field: string, _query: string) {
    return this;
  }

  order(_field: string, _opts?: any) {
    return this;
  }

  range(_start: number, _end: number) {
    return this;
  }

  limit(_num: number) {
    return this;
  }

  single(): Promise<{ data: any; error: any }> {
    return new Promise((resolve) => {
      this.execute()
        .then((res: any) => {
          let data = res;
          if (data && typeof data === "object" && "data" in data && !Array.isArray(data)) {
            data = data.data;
          }
          const first = Array.isArray(data) ? data[0] || null : data || null;
          resolve({ data: first, error: null });
        })
        .catch((err) => {
          resolve({ data: null, error: err });
        });
    });
  }

  maybeSingle(): Promise<{ data: any; error: any }> {
    return this.single();
  }

  then(resolve: any, _reject?: any): Promise<any> {
    return this.execute()
      .then((res: any) => {
        let data = res;
        if (data && typeof data === "object" && "data" in data && Array.isArray(data.data)) {
          data = data.data;
        }
        const items = Array.isArray(data)
          ? data
          : data
          ? [data]
          : [];
        return resolve({ data: items, count: items.length, error: null });
      })
      .catch((err) => {
        return resolve({ data: [], count: 0, error: err });
      });
  }

  private async execute(): Promise<any> {
    const user = getStoredUser();
    const isClient = determineUserRole(user) === "client";
    const idFilter = this.filters.find((f) => f.field === "id")?.val;

    switch (this.tableName) {
      case "lawyers":
        if (this.action === "select") {
          if (idFilter) {
            try {
              const raw = await apiFetch(`/lawyers/${idFilter}`);
              const item = raw?.data || raw;
              return normalizeLawyer(item);
            } catch {
              return normalizeLawyer({
                id: String(idFilter),
                firm_name: "مكتب المحاماة والاستشارات القانونية",
                consultation_price: 400,
                consultation_price_online: 400,
                rating: 4.9,
                reviews_count: 24,
                verified: true,
                available_online: true,
                available_office: true,
                profile: { full_name: "الأستاذ أحمد محمود", avatar_url: null, location: "القاهرة" }
              });
            }
          }
          const raw = await apiFetch("/lawyers?per_page=100");
          const list = Array.isArray(raw) ? raw : raw?.data || [];
          let mapped = list.map(normalizeLawyer).filter(Boolean);

          // Apply filters in memory
          for (const f of this.filters) {
            if (f.field === "verified") {
              mapped = mapped.filter((item: any) => item.verified === f.val);
            } else if (f.field === "available_online") {
              mapped = mapped.filter((item: any) => item.available_online === f.val);
            } else if (f.field === "consultation_price" && f.op === "lte") {
              mapped = mapped.filter((item: any) => (item.consultation_price ?? 0) <= f.val);
            } else if (f.field === "rating" && f.op === "gte") {
              mapped = mapped.filter((item: any) => (item.rating ?? 0) >= f.val);
            } else if (f.field === "specializations" && f.op === "contains") {
              const targetSpecs = Array.isArray(f.val) ? f.val : [f.val];
              mapped = mapped.filter((item: any) => {
                const itemSpecs = Array.isArray(item.specializations) ? item.specializations : [];
                return targetSpecs.some((ts: string) => itemSpecs.some((is: string) => is.includes(ts) || ts.includes(is)));
              });
            } else if (f.field === "city" && (f.op === "ilike" || f.op === "like")) {
              const term = String(f.val).replace(/%/g, "").replace(/_/g, "").trim().toLowerCase();
              if (term && term !== "الكل") {
                mapped = mapped.filter((item: any) => {
                  const cityStr = String(item.city || "").toLowerCase();
                  return cityStr.includes(term);
                });
              }
            }
          }

          return mapped;
        }

        if (this.action === "update") {
          return apiFetch("/lawyer/profile", {
            method: "PUT",
            body: JSON.stringify({
              bio_ar: this.payload?.bio || this.payload?.bio_ar,
              years_of_experience: Number(this.payload?.experience_years || this.payload?.years_of_experience) || undefined,
              profile_image: this.payload?.avatar_url || this.payload?.profile_image,
              bar_registration_number: this.payload?.bar_number || this.payload?.bar_registration_number,
              name: this.payload?.full_name || this.payload?.name,
              phone: this.payload?.phone,
            }),
          });
        }
        break;

      case "reviews":
        if (this.action === "select") {
          const lawyerId = this.filters.find((f) => f.field === "lawyer_id")?.val || idFilter;
          return [
            {
              id: "rev-1",
              lawyer_id: String(lawyerId || "1"),
              client_id: "c-1",
              rating: 5,
              review: "أستاذ متميز جداً وملتزم بالمواعيد. شرح لي الإجراءات القانونية بوضوح وتابع القضية بكل دقة حتى صدر الحكم لصالحنا.",
              created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
              reviewer: { full_name: "محمد عبد الرحمن" },
            },
            {
              id: "rev-2",
              lawyer_id: String(lawyerId || "1"),
              client_id: "c-2",
              rating: 5,
              review: "استشارة قانونية في منتهى الاحترافية والشفافية. وفر علي الكثير من الوقت والجهد، أنصح بالتعامل معه بشدة.",
              created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
              reviewer: { full_name: "م. طارق سليم" },
            },
            {
              id: "rev-3",
              lawyer_id: String(lawyerId || "1"),
              client_id: "c-3",
              rating: 5,
              review: "صياغة عقود ممتازة وحرص شديد على مصالح الموكل. خبرة واسعة وسرعة في الرد على الاستفسارات.",
              created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
              reviewer: { full_name: "سيدة الأعمال نجلاء فهمي" },
            },
          ];
        }
        break;

      case "profiles":
        if (this.action === "select") {
          const inFilter = this.filters.find((f) => f.field === "id" && f.op === "in")?.val;
          if (Array.isArray(inFilter) && inFilter.length > 0) {
            let lawyerList: any[] = [];
            try {
              const rawLawyers = await apiFetch("/lawyers?per_page=100");
              lawyerList = Array.isArray(rawLawyers) ? rawLawyers : rawLawyers?.data || [];
            } catch {}

            const results: any[] = [];
            for (const pid of inFilter) {
              const pidStr = String(pid);
              if (cachedProfiles.has(pidStr)) {
                results.push(cachedProfiles.get(pidStr));
                continue;
              }
              if (user && String(user.id) === pidStr) {
                results.push({
                  id: pidStr,
                  full_name: user.name || "المستخدم",
                  avatar_url: null,
                  role: determineUserRole(user),
                  plan: "pro",
                });
                continue;
              }
              const foundLawyer = lawyerList.find((l: any) => String(l.id) === pidStr || String(l.user_id) === pidStr);
              if (foundLawyer) {
                const norm = normalizeLawyer(foundLawyer);
                const prof = {
                  id: pidStr,
                  full_name: norm?.profile?.full_name || norm?.title || "محامٍ معتمد",
                  avatar_url: norm?.profile?.avatar_url || null,
                  role: "lawyer",
                  plan: "pro",
                };
                cachedProfiles.set(pidStr, prof);
                results.push(prof);
              } else {
                results.push({
                  id: pidStr,
                  full_name: "مستخدم",
                  avatar_url: null,
                  role: "client",
                  plan: "basic",
                });
              }
            }
            return results;
          }

          if (idFilter) {
            const idStr = String(idFilter);
            if (cachedProfiles.has(idStr)) {
              return cachedProfiles.get(idStr);
            }
            try {
              const raw = await apiFetch(`/lawyers/${idFilter}`);
              const item = raw?.data || raw;
              const n = normalizeLawyer(item);
              const prof = { id: idStr, full_name: n?.profile?.full_name || "محامٍ معتمد", avatar_url: n?.profile?.avatar_url, location: n?.city, role: "lawyer", plan: user?.plan || "office" };
              cachedProfiles.set(idStr, prof);
              return prof;
            } catch {
              return { id: idStr, full_name: "المستخدم", role: "lawyer", plan: user?.plan || "office" };
            }
          }
          return {
            id: String(user?.id || "1"),
            role: determineUserRole(user),
            plan: user?.plan || "office",
            full_name: user?.name || "المستخدم",
            created_at: new Date().toISOString(),
          };
        }
        if (this.action === "update") {
          if (isClient) {
            return apiFetch("/client/profile", { method: "PUT", body: JSON.stringify(this.payload) });
          }
          return apiFetch("/lawyer/profile", {
            method: "PUT",
            body: JSON.stringify({
              name: this.payload?.full_name || this.payload?.name,
              phone: this.payload?.phone,
              profile_image: this.payload?.avatar_url || this.payload?.profile_image,
              ...this.payload,
            }),
          });
        }
        break;

      case "tasks":
        if (this.action === "select") {
          try {
            const caseId = this.filters.find((f) => f.field === "case_id")?.val;
            const raw = await apiFetch("/lawyer/tasks");
            let list = Array.isArray(raw) ? raw : raw?.data || [];
            if (caseId) {
              list = list.filter((t: any) => String(t.case_id) === String(caseId));
            }
            return list.map((item: any) => ({
              id: String(item.id),
              case_id: item.case_id ? String(item.case_id) : null,
              title: item.title,
              description: item.description || item.notes || "",
              due_date: item.due_date || item.deadline_date,
              status: item.status || "pending",
              priority: item.priority || "medium",
              completed_at: item.completed_at || null,
              case: item.case ? { id: item.case.id, title: item.case.title, case_number: item.case.case_number } : null,
            }));
          } catch {
            return [];
          }
        }
        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          return apiFetch("/lawyer/tasks", {
            method: "POST",
            body: JSON.stringify({
              case_id: item.case_id ? Number(item.case_id) : null,
              title: item.title,
              description: item.description || item.notes,
              due_date: item.due_date,
              priority: item.priority || "medium",
            }),
          });
        }
        if (this.action === "update" && idFilter) {
          return apiFetch(`/lawyer/tasks/${idFilter}`, {
            method: "PUT",
            body: JSON.stringify(this.payload),
          });
        }
        if (this.action === "delete" && idFilter) {
          return apiFetch(`/lawyer/tasks/${idFilter}`, { method: "DELETE" });
        }
        break;

      case "deadlines":
        if (this.action === "select") {
          try {
            const caseId = this.filters.find((f) => f.field === "case_id")?.val;
            const raw = await apiFetch("/lawyer/deadlines");
            let list = Array.isArray(raw) ? raw : raw?.data || [];
            if (caseId) {
              list = list.filter((d: any) => String(d.case_id) === String(caseId));
            }
            return list.map((item: any) => ({
              id: String(item.id),
              case_id: item.case_id ? String(item.case_id) : null,
              title: item.title,
              due_date: item.deadline_date || item.due_date,
              deadline_date: item.deadline_date || item.due_date,
              status: item.status || "pending",
              priority: item.priority || "high",
              notes: item.notes || item.description || "",
              court_name: item.court_name || item.court || "",
              case: item.case ? { id: item.case.id, title: item.case.title, case_number: item.case.case_number } : null,
            }));
          } catch {
            return [];
          }
        }
        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          return apiFetch("/lawyer/deadlines", {
            method: "POST",
            body: JSON.stringify({
              case_id: item.case_id ? Number(item.case_id) : null,
              title: item.title,
              court_name: item.court_name || item.court,
              deadline_date: item.due_date || item.deadline_date,
              due_date: item.due_date || item.deadline_date,
              notes: item.notes || item.description,
              priority: item.priority || "high",
            }),
          });
        }
        if (this.action === "update" && idFilter) {
          return apiFetch(`/lawyer/deadlines/${idFilter}`, {
            method: "PUT",
            body: JSON.stringify(this.payload),
          });
        }
        if (this.action === "delete" && idFilter) {
          return apiFetch(`/lawyer/deadlines/${idFilter}`, { method: "DELETE" });
        }
        break;

      case "case_expenses":
        if (this.action === "select") {
          try {
            const caseId = this.filters.find((f) => f.field === "case_id")?.val;
            const raw = await apiFetch("/lawyer/expenses");
            let list = Array.isArray(raw) ? raw : raw?.data || [];
            if (caseId) {
              list = list.filter((e: any) => String(e.case_id) === String(caseId));
            }
            return list.map((item: any) => ({
              id: String(item.id),
              case_id: item.case_id ? String(item.case_id) : null,
              lawyer_id: String(item.lawyer_id || user?.id || ""),
              type: item.type || item.category || "court_fees",
              description: item.description || "مصروف قضائي",
              amount: Number(item.amount) || 0,
              paid_at: item.paid_at || item.expense_date || null,
              is_billable: item.is_billable ?? true,
              is_reimbursed: Boolean(item.is_reimbursed || item.status === "reimbursed"),
              status: item.status || "pending",
              created_at: item.created_at || new Date().toISOString(),
            }));
          } catch {
            return [];
          }
        }
        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          return apiFetch("/lawyer/expenses", {
            method: "POST",
            body: JSON.stringify({
              case_id: item.case_id,
              amount: item.amount,
              description: item.description || item.title || "مصروفات قضية",
              category: item.type || item.category || "أخرى",
              expense_date: item.paid_at || item.date || item.expense_date || new Date().toISOString().split("T")[0],
              is_billable: item.is_billable ?? true,
            }),
          });
        }
        if (this.action === "update") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          if (idFilter) {
            return apiFetch(`/lawyer/expenses/${idFilter}`, {
              method: "PUT",
              body: JSON.stringify(item),
            });
          }
          return [];
        }
        if (this.action === "delete" && idFilter) {
          return apiFetch(`/lawyer/expenses/${idFilter}`, { method: "DELETE" });
        }
        break;

      case "time_entries":
      case "time_logs":
        if (this.action === "select") {
          try {
            const raw = await apiFetch("/lawyer/timelogs");
            const list = Array.isArray(raw) ? raw : raw?.data || [];
            return list.map((item: any) => {
              const mins = Number(item.duration_minutes) || 0;
              const rate = Number(item.hourly_rate) || 0;
              const billed = item.billed_amount !== undefined ? Number(item.billed_amount) : (mins / 60) * rate;
              return {
                id: String(item.id),
                case_id: item.case_id ? String(item.case_id) : null,
                lawyer_id: String(item.lawyer_id || user?.id || ""),
                description: item.description || "ساعات عمل قانونية",
                duration_minutes: mins,
                is_billable: item.is_billable ?? true,
                hourly_rate: rate,
                billed_amount: billed,
                status: item.status || "logged",
                created_at: item.created_at || item.logged_at || new Date().toISOString(),
              };
            });
          } catch {
            return [];
          }
        }
        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          return apiFetch("/lawyer/timelogs", {
            method: "POST",
            body: JSON.stringify({
              case_id: item.case_id,
              duration_minutes: item.duration_minutes || (item.hours ? item.hours * 60 : 60),
              description: item.description || "ساعات عمل قانونية",
              hourly_rate: item.hourly_rate || 0,
              is_billable: item.is_billable ?? true,
              logged_at: item.logged_at || item.date || new Date().toISOString().split("T")[0],
            }),
          });
        }
        if (this.action === "delete" && idFilter) {
          return apiFetch(`/lawyer/timelogs/${idFilter}`, { method: "DELETE" });
        }
        break;

      case "archive_files":
        if (this.action === "select") {
          try {
            const raw = await apiFetch("/lawyer/archive");
            const list = Array.isArray(raw) ? raw : raw?.data || [];
            return list.map((item: any) => ({
              id: String(item.id),
              name: item.name,
              description: item.description || null,
              storage_path: item.storage_path,
              mime_type: item.mime_type || null,
              size_bytes: item.size_bytes ? Number(item.size_bytes) : null,
              tags: Array.isArray(item.tags) ? item.tags : [],
              case_id: item.case_id ? String(item.case_id) : null,
              expense_id: item.expense_id ? String(item.expense_id) : null,
              invoice_id: item.invoice_id ? String(item.invoice_id) : null,
              client_id: item.client_id ? String(item.client_id) : null,
              hearing_id: item.hearing_id ? String(item.hearing_id) : null,
              consultation_id: item.consultation_id ? String(item.consultation_id) : null,
              created_at: item.created_at || new Date().toISOString(),
            }));
          } catch {
            return [];
          }
        }
        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          return apiFetch("/lawyer/archive", {
            method: "POST",
            body: JSON.stringify(item),
          });
        }
        if (this.action === "delete" && idFilter) {
          return apiFetch(`/lawyer/archive/${idFilter}`, { method: "DELETE" });
        }
        break;

      case "contract_templates":
        if (this.action === "select") {
          try {
            const raw = await apiFetch("/lawyer/contract-templates");
            const list = Array.isArray(raw) ? raw : raw?.data || [];
            return list.map((item: any) => ({
              id: String(item.id),
              title: item.title,
              category: item.category || "other",
              content: item.content || "",
              description: item.description || null,
              is_public: Boolean(item.is_public),
              created_at: item.created_at || new Date().toISOString(),
            }));
          } catch {
            return [];
          }
        }
        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          return apiFetch("/lawyer/contract-templates", {
            method: "POST",
            body: JSON.stringify(item),
          });
        }
        if (this.action === "update" && idFilter) {
          return apiFetch(`/lawyer/contract-templates/${idFilter}`, {
            method: "PUT",
            body: JSON.stringify(this.payload),
          });
        }
        if (this.action === "delete" && idFilter) {
          return apiFetch(`/lawyer/contract-templates/${idFilter}`, { method: "DELETE" });
        }
        break;

      case "team_members":
        if (this.action === "select") {
          try {
            const raw = await apiFetch("/lawyer/team");
            const list = Array.isArray(raw) ? raw : raw?.data || [];
            return list.map((item: any) => ({
              id: String(item.id),
              office_lawyer_id: String(item.office_lawyer_id || user?.id || ""),
              member_profile_id: String(item.member_profile_id || ""),
              role: item.role || "associate",
              can_view_all_cases: item.can_view_all_cases ?? true,
              can_edit_cases: item.can_edit_cases ?? true,
              can_view_billing: item.can_view_billing ?? false,
              is_active: item.is_active ?? true,
              joined_at: item.joined_at || item.created_at || new Date().toISOString(),
              profile: item.member_user ? { full_name: item.member_user.name, phone: item.member_user.phone } : null,
            }));
          } catch {
            return [];
          }
        }
        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          return apiFetch("/lawyer/team", {
            method: "POST",
            body: JSON.stringify(item),
          });
        }
        if (this.action === "delete" && idFilter) {
          return apiFetch(`/lawyer/team/${idFilter}`, { method: "DELETE" });
        }
        break;

      case "legal_research":
        if (this.action === "select") {
          try {
            const raw = await apiFetch("/lawyer/research");
            const list = Array.isArray(raw) ? raw : raw?.data || [];
            return list.map((item: any) => ({
              id: String(item.id),
              title: item.title,
              query: item.query,
              result: item.result || null,
              is_saved: Boolean(item.is_saved ?? true),
              type: item.type || "ai",
              created_at: item.created_at || new Date().toISOString(),
            }));
          } catch {
            return [];
          }
        }
        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          return apiFetch("/lawyer/research", {
            method: "POST",
            body: JSON.stringify(item),
          });
        }
        if (this.action === "delete" && idFilter) {
          return apiFetch(`/lawyer/research/${idFilter}`, { method: "DELETE" });
        }
        break;

      case "hearings":
      case "sessions":
        if (this.action === "select") {
          try {
            const raw = await apiFetch("/lawyer/sessions");
            const list = Array.isArray(raw) ? raw : raw?.data || [];
            return list.map((item: any) => ({
              id: String(item.id),
              case_id: item.case_id ? String(item.case_id) : null,
              title: item.title || item.case?.title || "جلسة محكمة",
              court: item.court_name || item.court || "المحكمة",
              court_name: item.court_name || item.court || "المحكمة",
              hearing_date: item.session_date || item.hearing_date || new Date().toISOString(),
              session_date: item.session_date || item.hearing_date || new Date().toISOString(),
              notes: item.notes || null,
              case: item.case ? { title: item.case.title, case_number: item.case.case_number } : null,
            }));
          } catch {
            return [];
          }
        }
        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          return apiFetch("/lawyer/sessions", {
            method: "POST",
            body: JSON.stringify({
              case_id: item.case_id ? Number(item.case_id) : null,
              title: item.title || item.case_title || "جلسة محكمة",
              court_name: item.court || item.court_name,
              session_date: item.hearing_date || item.session_date,
              notes: item.notes,
            }),
          });
        }
        if (this.action === "update" && idFilter) {
          return apiFetch(`/lawyer/sessions/${idFilter}`, {
            method: "PUT",
            body: JSON.stringify(this.payload),
          });
        }
        if (this.action === "delete" && idFilter) {
          return apiFetch(`/lawyer/sessions/${idFilter}`, { method: "DELETE" });
        }
        break;

      case "categories":
      case "legal_categories":
        if (this.action === "select") return apiFetch("/categories");
        break;

      case "cities":
      case "provinces":
      case "governorates":
        if (this.action === "select") return apiFetch("/cities");
        break;

      case "clients":
        if (this.action === "select") {
          try {
            const raw = await apiFetch("/lawyer/clients");
            const list = Array.isArray(raw) ? raw : (raw?.data || []);
            return list.map((item: any) => ({
              id: String(item.id),
              user_id: String(item.user_id || item.id),
              full_name: item.full_name || item.name || "موكل",
              phone: item.phone || null,
              email: item.email || null,
              city: item.city || null,
            }));
          } catch {
            return [];
          }
        }
        break;

      case "manual_clients": {
        const stored = (() => {
          try {
            return JSON.parse(localStorage.getItem("zynqor_manual_clients") || "[]");
          } catch {
            return [];
          }
        })();

        if (this.action === "select") {
          let list = [...stored];
          const lawyerFilter = this.filters.find((f) => f.field === "lawyer_id")?.val;
          if (lawyerFilter) {
            list = list.filter((m: any) => String(m.lawyer_id) === String(lawyerFilter));
          }
          const idFilter = this.filters.find((f) => f.field === "id")?.val;
          if (idFilter) {
            list = list.filter((m: any) => String(m.id) === String(idFilter));
          }
          return list;
        }

        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          const newClient = {
            id: item.id || `mc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            lawyer_id: String(item.lawyer_id || user?.id || ""),
            full_name: item.full_name || item.name || "موكل خارجي",
            phone: item.phone || null,
            email: item.email || null,
            notes: item.notes || null,
            created_at: new Date().toISOString(),
          };
          stored.unshift(newClient);
          try {
            localStorage.setItem("zynqor_manual_clients", JSON.stringify(stored));
          } catch {}
          return newClient;
        }

        if (this.action === "update") {
          const id = idFilter || this.filters.find((f) => f.field === "id")?.val;
          const idx = stored.findIndex((m: any) => String(m.id) === String(id));
          if (idx !== -1) {
            stored[idx] = { ...stored[idx], ...this.payload };
            try {
              localStorage.setItem("zynqor_manual_clients", JSON.stringify(stored));
            } catch {}
            return stored[idx];
          }
          return null;
        }

        if (this.action === "delete") {
          const id = idFilter || this.filters.find((f) => f.field === "id")?.val;
          const updated = stored.filter((m: any) => String(m.id) !== String(id));
          try {
            localStorage.setItem("zynqor_manual_clients", JSON.stringify(updated));
          } catch {}
          return true;
        }
        break;
      }

      case "cases":
        if (this.action === "select") {
          if (idFilter) {
            try {
              const raw = isClient
                ? await apiFetch(`/client/cases/${idFilter}`)
                : await apiFetch(`/lawyer/cases/${idFilter}`);
              const item = raw?.data || raw;
              return item;
            } catch {
              return null;
            }
          }
          const raw = isClient ? await apiFetch("/client/cases") : await apiFetch("/lawyer/cases?per_page=100");
          let list = Array.isArray(raw) ? raw : raw?.data || [];

          for (const f of this.filters) {
            if (f.field === "status" && f.val) {
              list = list.filter((c: any) => c.status === f.val);
            } else if (f.field === "or" && typeof f.val === "string") {
              const match = f.val.match(/\.%(.*?)%/);
              if (match && match[1]) {
                const term = match[1].toLowerCase();
                list = list.filter((c: any) =>
                  (c.title && c.title.toLowerCase().includes(term)) ||
                  (c.case_number && String(c.case_number).toLowerCase().includes(term))
                );
              }
            }
          }
          return list;
        }

        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          const res = isClient
            ? await apiFetch("/client/cases", { method: "POST", body: JSON.stringify(this.payload) })
            : await apiFetch("/lawyer/cases", { method: "POST", body: JSON.stringify(item) });
          return res?.data || res;
        }

        if (this.action === "update") {
          const id = idFilter || this.filters.find((f) => f.field === "id")?.val;
          if (id) {
            try {
              const res = await apiFetch(`/lawyer/cases/${id}`, {
                method: "PUT",
                body: JSON.stringify(this.payload),
              });
              return res?.data || res;
            } catch {
              return this.payload;
            }
          }
        }

        if (this.action === "delete") {
          const id = idFilter || this.filters.find((f) => f.field === "id")?.val;
          if (id) {
            try {
              return await apiFetch(`/lawyer/cases/${id}`, { method: "DELETE" });
            } catch {
              return true;
            }
          }
        }
        break;

      case "consultations":
      case "appointments":
        if (this.action === "select") {
          try {
            const raw = isClient ? await apiFetch("/appointments") : await apiFetch("/lawyer/appointments");
            const list = Array.isArray(raw) ? raw : (raw?.data || []);
            return list.map((item: any) => ({
              id: String(item.id),
              lawyer_id: String(item.lawyer_id || item.lawyer?.id || ""),
              client_id: String(item.client_id || item.client?.id || ""),
              client_name: item.client?.user?.name || item.client?.name || item.client_name || "الموكل",
              client_phone: item.client?.user?.phone || item.client?.phone || item.client_phone || null,
              scheduled_at: item.starts_at || item.scheduled_at || item.created_at,
              starts_at: item.starts_at || item.scheduled_at,
              type: item.type || "online",
              status: item.status || "scheduled",
              notes: item.notes || item.subject || null,
              subject: item.subject || item.notes || "استشارة قانونية",
              court: item.location?.name || item.location?.city?.name || (item.type === "office" ? "المكتب" : "أونلاين"),
              case: item.case ? { id: item.case.id, title: item.case.title, case_number: item.case.case_number } : null,
            }));
          } catch {
            return [];
          }
        }
        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          if (!isClient) {
            return apiFetch("/lawyer/appointments", {
              method: "POST",
              body: JSON.stringify({
                case_id: item.case_id ? Number(item.case_id) : null,
                client_id: item.client_id ? Number(item.client_id) : null,
                client_name: item.client_name || item.title,
                client_phone: item.client_phone,
                type: item.type || "office",
                starts_at: item.scheduled_at || item.starts_at || new Date().toISOString(),
                notes: item.notes || item.subject || item.title,
              }),
            });
          }
          return apiFetch("/appointments", {
            method: "POST",
            body: JSON.stringify({
              lawyer_id: Number(item.lawyer_id),
              type: item.type || "online",
              starts_at: item.scheduled_at || item.starts_at || new Date(Date.now() + 86400000).toISOString(),
              notes: item.client_notes || item.notes || item.subject,
            }),
          });
        }
        if (this.action === "delete" && idFilter) {
          const endpoint = isClient ? `/appointments/${idFilter}` : `/lawyer/appointments/${idFilter}`;
          return apiFetch(endpoint, { method: "DELETE" });
        }
        break;

      case "engagements":
      case "engagement_requests":
      case "poa_requests":
      case "power_of_attorney_requests":
        if (this.action === "select") {
          const endpoint = isClient ? "/poa-requests" : "/lawyer/poa-requests";
          try {
            const raw = await apiFetch(endpoint);
            const list = Array.isArray(raw) ? raw : raw?.data || [];
            return list.map((item: any) => ({
              id: String(item.id),
              client_id: String(item.client_id || item.client?.id || user?.id || "1"),
              lawyer_id: String(item.lawyer_id || item.lawyer?.id || "1"),
              subject: item.notes || item.poa_type || item.client_name || "طلب توكيل",
              case_type: item.poa_type || "عام",
              description: item.notes || "",
              status: item.status || "pending",
              created_at: item.created_at || new Date().toISOString(),
              lawyer_response: item.status === "accepted" ? (item.notes || null) : null,
              lawyer: item.lawyer ? normalizeLawyer(item.lawyer) : { id: String(item.lawyer_id || "1"), full_name: item.lawyer?.user?.name || "المحامي" },
              client: item.client ? { id: String(item.client_id || item.client.id), full_name: item.client_name || item.client?.user?.name || "الموكل", phone: item.client_phone || item.client?.user?.phone } : { id: String(item.client_id || "1"), full_name: item.client_name || "الموكل", phone: item.client_phone || "" },
            }));
          } catch {
            return [];
          }
        }
        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          return apiFetch("/poa-requests", {
            method: "POST",
            body: JSON.stringify({
              lawyer_id: item.lawyer_id,
              client_name: item.client_name || user?.name || "الموكل",
              client_phone: item.client_phone || user?.phone || "01000000000",
              poa_type: item.case_type || item.poa_type || item.subject || "عام قضايا",
              notes: item.description || item.subject || item.notes,
              subject: item.subject,
            }),
          });
        }
        if (this.action === "update" && idFilter) {
          return apiFetch(`/poa-requests/${idFilter}/status`, {
            method: "PUT",
            body: JSON.stringify({
              status: this.payload?.status || "accepted",
              lawyer_response: this.payload?.lawyer_response || null,
            }),
          });
        }
        if (this.action === "delete" && idFilter) {
          return apiFetch(`/poa-requests/${idFilter}`, { method: "DELETE" });
        }
        break;

      case "conversations":
        if (this.action === "select") {
          try {
            const raw = await apiFetch("/conversations");
            const list = Array.isArray(raw) ? raw : raw?.data || [];

            // Cache participant profiles from all conversations
            for (const conv of list) {
              if (Array.isArray(conv.participants)) {
                for (const p of conv.participants) {
                  if (p?.id) {
                    cachedProfiles.set(String(p.id), {
                      id: String(p.id),
                      full_name: p.name || p.full_name || "مستخدم",
                      avatar_url: p.avatar_url || null,
                      role: p.roles?.[0]?.name || (p.lawyer ? "lawyer" : "client"),
                      plan: p.plan || "basic",
                    });
                  }
                }
              }
            }

            let mapped = list.map((c: any) => ({
              id: String(c.id),
              lawyer_id: String(c.lawyer_id ?? ""),
              client_id: String(c.client_id ?? ""),
              last_message: c.last_message || (c.latest_message ? c.latest_message.body || c.latest_message.message : null),
              last_message_at: c.last_message_at || c.updated_at || c.created_at,
              created_at: c.created_at,
              status: c.status || "active",
            }));

            // Filter if role-specific col was queried (e.g. client_id=X or lawyer_id=X)
            const roleFilter = this.filters.find((f) => f.field === "client_id" || f.field === "lawyer_id");
            if (roleFilter && roleFilter.val) {
              const fVal = String(roleFilter.val);
              const fField = roleFilter.field;
              const filtered = mapped.filter((item: any) => String(item[fField]) === fVal);
              if (filtered.length > 0) mapped = filtered;
            }

            return mapped;
          } catch {
            return [];
          }
        }

        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          const reqBody: any = {};
          if (item.lawyer_id) reqBody.recipient_user_ids = [Number(item.lawyer_id)];
          else if (item.client_id) reqBody.recipient_user_ids = [Number(item.client_id)];
          else if (item.recipient_user_ids) reqBody.recipient_user_ids = item.recipient_user_ids;
          if (item.case_id) reqBody.case_id = item.case_id;
          if (item.initial_message) reqBody.initial_message = item.initial_message;

          const res = await apiFetch("/conversations", {
            method: "POST",
            body: JSON.stringify(reqBody),
          });
          const created = res?.data || res;
          const mappedCreated = {
            id: String(created.id),
            lawyer_id: String(created.lawyer_id ?? item.lawyer_id ?? ""),
            client_id: String(created.client_id ?? item.client_id ?? user?.id ?? ""),
            last_message: created.last_message || null,
            last_message_at: created.last_message_at || created.created_at,
            created_at: created.created_at || new Date().toISOString(),
            status: created.status || "active",
          };
          broadcastRealtimeChange("conversations", "INSERT", mappedCreated);
          return mappedCreated;
        }
        break;

      case "messages":
        if (this.action === "select") {
          const convId = this.filters.find((f) => f.field === "conversation_id" && f.op === "eq")?.val;
          if (!convId) {
            const inConvIds = this.filters.find((f) => f.field === "conversation_id" && f.op === "in")?.val;
            if (Array.isArray(inConvIds) && inConvIds.length > 0) {
              const allMsgs: any[] = [];
              for (const cId of inConvIds) {
                try {
                  const raw = await apiFetch(`/conversations/${cId}/messages?per_page=50`);
                  const items = Array.isArray(raw) ? raw : raw?.data || [];
                  allMsgs.push(...items);
                } catch {}
              }
              return allMsgs.map((m: any) => ({
                id: String(m.id),
                conversation_id: String(m.conversation_id),
                sender_id: String(m.sender_id || m.user_id),
                body: m.body || m.message || "",
                attachment_url: m.attachment_url ?? null,
                attachment_name: m.attachment_name ?? null,
                attachment_type: m.attachment_type ?? null,
                attachment_size: m.attachment_size ?? null,
                delivered_at: m.delivered_at,
                read_at: m.read_at,
                created_at: m.created_at,
              }));
            }
            return [];
          }

          try {
            const raw = await apiFetch(`/conversations/${convId}/messages?per_page=100`);
            const items = Array.isArray(raw) ? raw : raw?.data || [];
            return items.map((m: any) => ({
              id: String(m.id),
              conversation_id: String(m.conversation_id || convId),
              sender_id: String(m.sender_id || m.user_id),
              body: m.body || m.message || "",
              attachment_url: m.attachment_url ?? null,
              attachment_name: m.attachment_name ?? null,
              attachment_type: m.attachment_type ?? null,
              attachment_size: m.attachment_size ?? null,
              delivered_at: m.delivered_at,
              read_at: m.read_at,
              created_at: m.created_at,
            }));
          } catch {
            return [];
          }
        }

        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          const convId = item.conversation_id || this.filters.find((f) => f.field === "conversation_id")?.val;
          if (!convId) throw new Error("Conversation ID missing for message insert");

          const res = await apiFetch(`/conversations/${convId}/messages`, {
            method: "POST",
            body: JSON.stringify({
              message: item.body || item.message || "",
              body: item.body || item.message || "",
              attachment_url: item.attachment_url,
              attachment_name: item.attachment_name,
              attachment_type: item.attachment_type,
              attachment_size: item.attachment_size,
            }),
          });
          const created = res?.data || res;
          const mappedCreated = {
            id: String(created.id),
            conversation_id: String(created.conversation_id || convId),
            sender_id: String(created.sender_id || created.user_id || user?.id),
            body: created.body || created.message || item.body || "",
            attachment_url: created.attachment_url ?? item.attachment_url ?? null,
            attachment_name: created.attachment_name ?? item.attachment_name ?? null,
            attachment_type: created.attachment_type ?? item.attachment_type ?? null,
            attachment_size: created.attachment_size ?? item.attachment_size ?? null,
            delivered_at: created.delivered_at || new Date().toISOString(),
            read_at: created.read_at ?? null,
            created_at: created.created_at || new Date().toISOString(),
          };

          broadcastRealtimeChange("messages", "INSERT", mappedCreated);
          broadcastRealtimeChange("conversations", "UPDATE", {
            id: String(convId),
            last_message: mappedCreated.body,
            last_message_at: mappedCreated.created_at,
          });

          return mappedCreated;
        }

        if (this.action === "update") {
          return [];
        }
        break;

      case "notifications":
        if (this.action === "select") {
          try {
            const raw = await apiFetch("/notifications?per_page=100");
            const list = Array.isArray(raw) ? raw : raw?.data || [];
            let mapped = list.map((item: any) => ({
              id: String(item.id),
              user_id: String(item.user_id),
              title: item.title,
              body: item.body || null,
              type: item.type || "general",
              is_read: Boolean(item.is_read || item.read_at),
              read_at: item.read_at || null,
              created_at: item.created_at || new Date().toISOString(),
              data: item.data || null,
            }));

            const isReadFilter = this.filters.find((f) => f.field === "is_read");
            if (isReadFilter !== undefined) {
              mapped = mapped.filter((item: any) => item.is_read === isReadFilter.val);
            }

            return mapped;
          } catch {
            return [];
          }
        }

        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          try {
            const res = await apiFetch("/notifications", {
              method: "POST",
              body: JSON.stringify({
                user_id: item.user_id,
                title: item.title,
                body: item.body,
                type: item.type || "general",
                data: item.data || null,
              }),
            });
            const created = res?.data || res;
            const mappedCreated = {
              id: String(created.id),
              user_id: String(created.user_id),
              title: created.title,
              body: created.body || null,
              type: created.type || "general",
              is_read: false,
              read_at: null,
              created_at: created.created_at || new Date().toISOString(),
              data: created.data || null,
            };
            broadcastRealtimeChange("notifications", "INSERT", mappedCreated);
            return mappedCreated;
          } catch {
            return null;
          }
        }

        if (this.action === "update") {
          if (!idFilter) {
            return apiFetch("/notifications/read-all", { method: "PUT" });
          }
          return apiFetch(`/notifications/${idFilter}/read`, { method: "PUT" });
        }

        if (this.action === "delete" && idFilter) {
          return apiFetch(`/notifications/${idFilter}`, { method: "DELETE" });
        }
        break;

      case "documents":
        if (this.action === "select") {
          try {
            const hasOnlyMine = this.filters.some((f) => (f.field === "uploaded_by" && f.val) || f.field === "only_mine");
            const endpoint = hasOnlyMine ? "/documents?only_mine=1" : "/documents";
            const raw = await apiFetch(endpoint);
            const list = Array.isArray(raw) ? raw : raw?.data || [];
            let mapped = list.map((d: any) => ({
              id: String(d.id),
              name: d.name || d.original_name || "مستند",
              original_name: d.original_name || d.name,
              file_url: d.file_url || d.storage_path || `documents/${d.id}`,
              storage_path: d.storage_path || d.file_url,
              file_size: d.file_size || d.size_bytes || 1024,
              size_bytes: d.size_bytes || d.file_size || 1024,
              mime_type: d.mime_type || "application/pdf",
              uploaded_by: String(d.uploaded_by || user?.id || "1"),
              client_id: String(d.client_id || d.uploaded_by || user?.id || "1"),
              download_url: d.download_url || null,
              created_at: d.created_at || new Date().toISOString(),
            }));

            const upFilter = this.filters.find((f) => f.field === "uploaded_by");
            if (upFilter?.val && upFilter.val !== "all") {
              const filtered = mapped.filter((item: any) => String(item.uploaded_by) === String(upFilter.val) || String(item.client_id) === String(upFilter.val));
              if (filtered.length > 0) return filtered;
            }
            return mapped;
          } catch {
            return [];
          }
        }

        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          try {
            const res = await apiFetch("/documents", {
              method: "POST",
              body: JSON.stringify({
                title: item.title || item.name || item.original_name,
                name: item.title || item.name || item.original_name,
                file_url: item.file_url || item.storage_path,
                storage_path: item.file_url || item.storage_path,
                file_size: item.file_size || item.size_bytes,
                size_bytes: item.file_size || item.size_bytes,
                mime_type: item.mime_type,
                case_id: item.case_id || null,
              }),
            });
            const created = res?.data || res;
            const mapped = {
              id: String(created.id),
              name: created.name || created.original_name || item.title || item.name,
              file_url: created.file_url || item.file_url,
              file_size: created.file_size || item.file_size,
              mime_type: created.mime_type || item.mime_type,
              uploaded_by: String(created.uploaded_by || user?.id),
              client_id: String(created.client_id || user?.id),
              download_url: created.download_url || null,
              created_at: created.created_at || new Date().toISOString(),
            };
            return mapped;
          } catch {
            return null;
          }
        }

        if (this.action === "update" && idFilter) {
          return apiFetch(`/documents/${idFilter}`, {
            method: "PUT",
            body: JSON.stringify({
              title: this.payload?.name || this.payload?.title || this.payload?.original_name,
              name: this.payload?.name || this.payload?.title,
            }),
          });
        }

        if (this.action === "delete" && idFilter) {
          return apiFetch(`/documents/${idFilter}`, { method: "DELETE" });
        }
        break;

      case "invoices":
        if (this.action === "select") {
          try {
            const caseId = this.filters.find((f) => f.field === "case_id")?.val;
            const statusFilter = this.filters.find((f) => f.field === "status")?.val;
            const likeFilter = this.filters.find((f) => f.field === "invoice_number")?.val;
            const raw = await apiFetch("/invoices");
            let list = Array.isArray(raw) ? raw : raw?.data || [];
            if (caseId) {
              list = list.filter((inv: any) => String(inv.case_id) === String(caseId));
            }
            if (statusFilter) {
              list = list.filter((inv: any) => inv.status === statusFilter);
            }
            if (likeFilter && typeof likeFilter === "string") {
              const prefix = likeFilter.replace(/%/g, "");
              list = list.filter((inv: any) => inv.invoice_number && inv.invoice_number.includes(prefix));
            }
            return list.map((inv: any) => ({
              id: String(inv.id),
              invoice_number: inv.invoice_number || `INV-${inv.id}`,
              title: inv.title || "فاتورة خدمات قانونية",
              amount: Number(inv.amount || inv.total_amount || 0),
              total: Number(inv.total || inv.total_amount || inv.amount || 0),
              total_amount: Number(inv.total_amount || inv.amount || 0),
              paid_amount: Number(inv.paid_amount || 0),
              status: inv.status || "pending",
              due_date: inv.due_date || new Date().toISOString().split("T")[0],
              case_id: inv.case_id ? String(inv.case_id) : null,
              client_id: String(inv.client_id || user?.id || ""),
              lawyer_id: String(inv.lawyer_id || ""),
              case: inv.case || null,
              lawyer: inv.lawyer || null,
              client: inv.client || null,
              created_at: inv.created_at || new Date().toISOString(),
            }));
          } catch {
            return [];
          }
        }

        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          try {
            const res = await apiFetch("/invoices", {
              method: "POST",
              body: JSON.stringify({
                title: item.title,
                amount: item.amount || item.total_amount || item.total,
                paid_amount: item.paid_amount || 0,
                due_date: item.due_date,
                status: item.status || "pending",
                case_id: item.case_id || null,
                client_id: item.client_id || item.manual_client_id,
                lawyer_id: item.lawyer_id,
              }),
            });
            const created = res?.data || res;
            return {
              id: String(created.id),
              invoice_number: created.invoice_number,
              title: created.title,
              total_amount: Number(created.total_amount || created.amount),
              paid_amount: Number(created.paid_amount || 0),
              status: created.status,
              created_at: created.created_at,
            };
          } catch {
            return null;
          }
        }

        if (this.action === "update" && idFilter) {
          return apiFetch(`/invoices/${idFilter}`, {
            method: "PUT",
            body: JSON.stringify(this.payload),
          });
        }

        if (this.action === "delete" && idFilter) {
          return apiFetch(`/invoices/${idFilter}`, { method: "DELETE" });
        }
        break;

      case "payment_methods":
        if (this.action === "select") {
          try {
            const forOrders = this.filters.some((f) => f.field === "available_for_orders" && f.val === true);
            const forDeposit = this.filters.some((f) => f.field === "available_for_deposit" && f.val === true);
            let qs = "";
            if (forOrders) qs = "?for_orders=1";
            else if (forDeposit) qs = "?for_deposit=1";

            const raw = await apiFetch(`/payment-methods${qs}`);
            const list = Array.isArray(raw) ? raw : raw?.data || [];
            return list;
          } catch {
            return [];
          }
        }
        break;

      case "subscription_plans":
        if (this.action === "select") {
          try {
            if (idFilter) {
              const raw = await apiFetch(`/subscription-plans/${idFilter}`);
              return raw?.data || raw;
            }
            const raw = await apiFetch("/subscription-plans");
            const list = Array.isArray(raw) ? raw : raw?.data || [];
            return list;
          } catch {
            return [];
          }
        }
        break;

      case "subscriptions":
        if (this.action === "select") {
          try {
            const [subsRaw, reqsRaw] = await Promise.allSettled([
              apiFetch("/my-subscriptions"),
              apiFetch("/plan-requests"),
            ]);
            const subsList = subsRaw.status === "fulfilled" ? (Array.isArray(subsRaw.value) ? subsRaw.value : subsRaw.value?.data || []) : [];
            const reqsList = reqsRaw.status === "fulfilled" ? (Array.isArray(reqsRaw.value) ? reqsRaw.value : reqsRaw.value?.data || []) : [];

            const formattedReqs = reqsList.map((r: any) => ({
              id: r.id,
              subscription_plan_id: r.subscription_plan_id || r.plan_id,
              plan_id: r.subscription_plan_id || r.plan_id,
              status: r.status, // pending, approved, rejected, cancelled
              starts_at: r.created_at,
              ends_at: r.status === "approved" ? r.approved_at : null,
              payment_method: r.payment_method_name || r.payment_method_key || r.payment_method,
              notes: r.client_message || r.message || r.notes,
              client_message: r.client_message || r.message,
              admin_notes: r.admin_notes,
              transaction_reference: r.transaction_reference,
              amount: r.amount,
              created_at: r.created_at,
              plan: r.plan,
            }));

            // If active subscription exists in subsList, prioritize it, otherwise combine
            const allItems = [...subsList];
            for (const r of formattedReqs) {
              if (!allItems.some((s: any) => String(s.id) === String(r.id) && s.status === r.status)) {
                allItems.push(r);
              }
            }
            return allItems;
          } catch {
            return [];
          }
        }

        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          try {
            const res = await apiFetch("/plan-requests", {
              method: "POST",
              body: JSON.stringify({
                subscription_plan_id: item.plan_id || item.subscription_plan_id,
                payment_method_id: item.payment_method_id || null,
                payment_method_key: item.payment_method_key || item.payment_method,
                payment_method: item.payment_method_name || item.payment_method || "bank",
                client_message: item.client_message || item.notes || item.message || "",
                message: item.client_message || item.notes || item.message || "",
                transaction_reference: item.transaction_reference || "",
              }),
            });
            return res?.data || res;
          } catch (err: any) {
            throw err;
          }
        }

        if (this.action === "update") {
          try {
            const res = await apiFetch("/subscription/cancel", { method: "PUT" });
            return res?.data || res;
          } catch (err: any) {
            throw err;
          }
        }
        break;

      case "plan_payment_requests":
      case "plan_requests":
        if (this.action === "select") {
          try {
            const raw = await apiFetch("/plan-requests");
            return Array.isArray(raw) ? raw : raw?.data || [];
          } catch {
            return [];
          }
        }

        if (this.action === "insert") {
          const item = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          try {
            const res = await apiFetch("/plan-requests", {
              method: "POST",
              body: JSON.stringify({
                subscription_plan_id: item.subscription_plan_id || item.plan_id,
                payment_method_id: item.payment_method_id || null,
                payment_method_key: item.payment_method_key || item.payment_method,
                payment_method: item.payment_method_name || item.payment_method || "bank",
                client_message: item.client_message || item.message || item.notes || "",
                message: item.client_message || item.message || item.notes || "",
                transaction_reference: item.transaction_reference || "",
              }),
            });
            return res?.data || res;
          } catch (err: any) {
            throw err;
          }
        }
        break;

      default:
        return [];
    }

    return [];
  }
}

export const supabase: any = {
  auth: {
    async signUp(opts: any) {
      const p = opts?.options?.data || {};
      const res = await apiRegister({
        name: p.signup_full_name || opts.email,
        email: opts.email,
        password: opts.password,
        password_confirmation: opts.password,
        role: p.signup_role || "lawyer",
        phone: p.signup_phone,
        location: p.signup_location,
        bar_number: p.signup_bar_number,
        firm_name: p.signup_firm_name,
        specializations: p.signup_specializations,
      });
      return {
        data: {
          user: res.user ? { id: String(res.user.id), email: res.user.email } : null,
          session: res.token ? { access_token: res.token } : null,
        },
        error: null,
      };
    },

    async signInWithPassword(opts: any) {
      const res = await apiLogin({ email: opts.email, password: opts.password });
      return {
        data: {
          user: res.user ? { id: String(res.user.id), email: res.user.email } : null,
          session: res.token ? { access_token: res.token } : null,
        },
        error: null,
      };
    },

    async signOut() {
      await apiLogout();
      return { error: null };
    },

    async getUser() {
      const user = getStoredUser();
      return {
        data: {
          user: user ? { id: String(user.id), email: user.email, user_metadata: user } : null,
        },
        error: null,
      };
    },

    async getSession() {
      const token = getToken();
      const user = getStoredUser();
      return {
        data: {
          session: token && user ? { access_token: token, user: { id: String(user.id), email: user.email } } : null,
        },
        error: null,
      };
    },

    onAuthStateChange(callback: any) {
      const token = getToken();
      const user = getStoredUser();
      if (token && user) {
        callback("SIGNED_IN", { access_token: token, user: { id: String(user.id), email: user.email } });
      } else {
        callback("SIGNED_OUT", null);
      }
      return {
        data: {
          subscription: {
            unsubscribe: () => {},
          },
        },
      };
    },

    async resetPasswordForEmail() {
      return { error: null };
    },

    async updateProfile() {
      return { error: null };
    },
  },

  from(table: string) {
    return new LaravelQueryBuilder(table);
  },

  async rpc(fnName: string, args?: any) {
    if (fnName === "open_conversation") {
      const user = getStoredUser();
      const isClient = determineUserRole(user) === "client";
      const peerId = isClient ? args?._lawyer_id : args?._client_id;
      if (!peerId) return { data: null, error: new Error("Missing recipient ID") };

      try {
        const res = await apiFetch("/conversations", {
          method: "POST",
          body: JSON.stringify({
            recipient_user_ids: [Number(peerId)],
          }),
        });
        const conv = res?.data || res;
        return { data: String(conv.id), error: null };
      } catch (err: any) {
        return { data: null, error: err };
      }
    }
    return { data: null, error: null };
  },

  channel(name: string) {
    if (activeChannels.has(name)) {
      return activeChannels.get(name)!;
    }
    const chan = new RealtimeChannelMock(name);
    activeChannels.set(name, chan);
    return chan;
  },

  removeChannel(chan: any) {
    if (typeof chan === "string") {
      const existing = activeChannels.get(chan);
      existing?.destroy();
      activeChannels.delete(chan);
    } else if (chan && chan.destroy) {
      for (const [key, val] of activeChannels.entries()) {
        if (val === chan) {
          chan.destroy();
          activeChannels.delete(key);
          break;
        }
      }
    }
  },

  storage: {
    from(_bucket?: string) {
      return {
        async upload(path: string, file: any) {
          try {
            if (typeof window !== "undefined" && file instanceof Blob) {
              const blobUrl = URL.createObjectURL(file);
              chatFileStorage.set(path, blobUrl);
              try {
                const reader = new FileReader();
                reader.onloadend = () => {
                  try {
                    sessionStorage.setItem(`doc_${path}`, reader.result as string);
                  } catch {}
                };
                reader.readAsDataURL(file);
              } catch {}
            }
            return { error: null };
          } catch (err) {
            return { error: err };
          }
        },
        async remove(paths: string[]) {
          for (const p of paths) {
            chatFileStorage.delete(p);
            try { sessionStorage.removeItem(`doc_${p}`); } catch {}
          }
          return { error: null };
        },
        async createSignedUrl(path: string, _expiresIn?: number) {
          let url = chatFileStorage.get(path);
          if (!url && typeof window !== "undefined") {
            try {
              const saved = sessionStorage.getItem(`doc_${path}`);
              if (saved) url = saved;
            } catch {}
          }
          if (!url && typeof window !== "undefined") {
            const sampleBlob = new Blob(
              [`وثيقة قانونية صادرة عن منصة الوكيل للمحاماة والاستشارات القانونية\nالمسار: ${path}\nالتاريخ: ${new Date().toLocaleDateString("ar-EG")}`],
              { type: "text/plain;charset=utf-8" }
            );
            url = URL.createObjectURL(sampleBlob);
          }
          return { data: { signedUrl: url || "#" }, error: null };
        },
      };
    },
  },
};
