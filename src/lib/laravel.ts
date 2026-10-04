export function getBaseUrl(): string {
  let url = "";

  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) {
    url = (import.meta.env.VITE_API_URL as string).trim();
  } else if (typeof process !== "undefined" && process.env && process.env.VITE_API_URL) {
    url = (process.env.VITE_API_URL as string).trim();
  } else if (typeof window !== "undefined") {
    if (window.location.port === "8009") {
      url = `${window.location.origin}/api/v1`;
    } else if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      url = `http://${window.location.hostname}:8009/api/v1`;
    } else {
      url = "https://api-law.mr-zynqor.lat/api/v1";
    }
  } else {
    url = "https://api-law.mr-zynqor.lat/api/v1";
  }

  url = url.replace(/\/+$/, "");
  if (!url.endsWith("/api/v1") && !url.endsWith("/api")) {
    url = `${url}/api/v1`;
  }
  return url;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sanctum_token");
}

export function setToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("sanctum_token", token);
  }
}

export function removeToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("sanctum_token");
    localStorage.removeItem("user_data");
  }
}

export function getStoredUser(): any | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user_data");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.data?.user || parsed?.data || parsed?.user || parsed;
  } catch {
    return null;
  }
}

export function setStoredUser(user: any): void {
  if (typeof window !== "undefined") {
    const cleanUser = user?.data?.user || user?.data || user?.user || user;
    localStorage.setItem("user_data", JSON.stringify(cleanUser));
  }
}

export function determineUserRole(user: any): "lawyer" | "client" | "admin" {
  if (!user) return "client";
  const u = user?.data?.user || user?.data || user?.user || user;

  const roles: string[] = Array.isArray(u.roles)
    ? u.roles.map((r: any) => (typeof r === "string" ? r : r.name || "")).filter(Boolean)
    : [];

  const roleStr = typeof u.role === "string" ? u.role : (roles[0] || "");

  if (
    roleStr === "admin" ||
    roleStr === "platform_admin" ||
    roleStr === "firm_admin" ||
    roles.includes("admin") ||
    roles.includes("platform_admin") ||
    roles.includes("firm_admin") ||
    u.email?.startsWith("admin@")
  ) {
    return "admin";
  }

  if (
    roleStr === "lawyer" ||
    roles.includes("lawyer") ||
    !!u.lawyer_profile ||
    !!u.lawyer ||
    u.email?.startsWith("lawyer@") ||
    u.email === "ahmed.mahmoud@zynqor-law.com" ||
    u.email?.endsWith("@zynqor-law.com")
  ) {
    return "lawyer";
  }

  return "client";
}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${getBaseUrl()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.message || data.error || `HTTP error ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

// Auth API
export async function apiRegister(payload: any) {
  const res: any = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const token = res.token || res.access_token || res.data?.token || res.data?.access_token;
  const user = res.user || res.data?.user || res.data;
  if (token) setToken(token);
  if (user) setStoredUser(user);
  return { user, access_token: token, ...res };
}

export async function apiLogin(credentials: { email: string; password: string }) {
  const res: any = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
  const token = res.token || res.access_token || res.data?.token || res.data?.access_token;
  const user = res.user || res.data?.user || res.data;
  if (token) setToken(token);
  if (user) setStoredUser(user);
  return { user, access_token: token, ...res };
}

export async function apiLogout() {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    // Ignore network error on logout
  } finally {
    removeToken();
  }
}

export async function apiGetMe() {
  const res: any = await apiFetch("/auth/me");
  const user = res?.data?.user || res?.data || res?.user || res;
  if (user) {
    setStoredUser(user);
  }
  return user;
}

// Lawyer Profile
export async function apiGetLawyerProfile() {
  return apiFetch("/lawyer/profile");
}

export async function apiUpdateLawyerProfile(data: any) {
  return apiFetch("/lawyer/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// Public Lawyers & Search
export async function apiGetLawyers(params?: Record<string, string>) {
  const query = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch(`/lawyers${query}`);
}

export async function apiGetLawyer(id: string | number) {
  return apiFetch(`/lawyers/${id}`);
}

// Tasks
export async function apiGetLawyerTasks() {
  return apiFetch("/lawyer/tasks");
}

export async function apiCreateLawyerTask(data: { title: string; due_date?: string; priority?: string; notes?: string; description?: string; case_id?: string | number | null }) {
  return apiFetch("/lawyer/tasks", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      description: data.description || data.notes,
    }),
  });
}

export async function apiUpdateLawyerTask(id: number | string, data: any) {
  return apiFetch(`/lawyer/tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function apiDeleteLawyerTask(id: number | string) {
  return apiFetch(`/lawyer/tasks/${id}`, { method: "DELETE" });
}

// Deadlines
export async function apiGetLawyerDeadlines() {
  return apiFetch("/lawyer/deadlines");
}

export async function apiCreateLawyerDeadline(data: { title: string; due_date: string; court_name?: string; priority?: string; notes?: string; case_id?: string | number | null }) {
  return apiFetch("/lawyer/deadlines", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      deadline_date: data.due_date,
    }),
  });
}

export async function apiUpdateLawyerDeadline(id: number | string, data: any) {
  return apiFetch(`/lawyer/deadlines/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function apiDeleteLawyerDeadline(id: number | string) {
  return apiFetch(`/lawyer/deadlines/${id}`, { method: "DELETE" });
}

// Time Logs
export async function apiGetLawyerTimeLogs() {
  return apiFetch("/lawyer/timelogs");
}

export async function apiCreateLawyerTimeLog(data: { case_id?: number | string; duration_minutes: number; description: string; date: string }) {
  return apiFetch("/lawyer/timelogs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiDeleteLawyerTimeLog(id: number | string) {
  return apiFetch(`/lawyer/timelogs/${id}`, { method: "DELETE" });
}

// Expenses
export async function apiGetLawyerExpenses() {
  return apiFetch("/lawyer/expenses");
}

export async function apiCreateLawyerExpense(data: { case_id?: number | string; amount: number; description: string; date: string; category?: string }) {
  return apiFetch("/lawyer/expenses", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiDeleteLawyerExpense(id: number | string) {
  return apiFetch(`/lawyer/expenses/${id}`, { method: "DELETE" });
}

// Power of Attorney Requests
export async function apiGetPoaRequests() {
  return apiFetch("/lawyer/poa-requests");
}

export async function apiCreatePoaRequest(data: { lawyer_id: number | string; details?: string }) {
  return apiFetch("/poa-requests", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiUpdatePoaStatus(id: number | string, status: string) {
  return apiFetch(`/lawyer/poa-requests/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

// Court Sessions
export async function apiGetLawyerSessions() {
  return apiFetch("/lawyer/sessions");
}

export async function apiCreateLawyerSession(data: { title: string; court_name?: string; session_date: string; case_number?: string; notes?: string }) {
  return apiFetch("/lawyer/sessions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiUpdateLawyerSession(id: number | string, data: any) {
  return apiFetch(`/lawyer/sessions/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function apiDeleteLawyerSession(id: number | string) {
  return apiFetch(`/lawyer/sessions/${id}`, { method: "DELETE" });
}

// Regions / Master Data
export async function apiGetProvinces() {
  return apiFetch("/provinces");
}

export async function apiGetCategories() {
  return apiFetch("/categories");
}

export async function apiGetCities() {
  return apiFetch("/cities");
}

// Legal Pages (Privacy, Terms, etc.)
export async function apiGetPage(slug: string) {
  const res: any = await apiFetch(`/pages/${slug}`);
  return res?.data || res;
}

