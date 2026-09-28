import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { translateAuthError } from "./translate-error";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CASE_TYPES: Record<string, string> = {
  criminal: "جنائي",
  civil: "مدني",
  real_estate: "عقاري",
  commercial: "تجاري",
  family: "أسرة",
  administrative: "إداري",
  labor: "عمالي",
  other: "أخرى",
};

export function caseTypeLabel(type: string): string {
  return CASE_TYPES[type] ?? type;
}

/**
 * Unified Supabase error → Arabic user message.
 * Use instead of `toast.error((e as Error).message)`.
 */
export function handleSupabaseError(error: unknown, fallback = "حدث خطأ غير متوقع"): string {
  if (!error) return fallback;
  const e = error as { code?: string; message?: string; details?: string };
  if (e.code === "23505") return "هذا الإدخال موجود بالفعل";
  if (e.code === "23503") return "لا يمكن الحذف — هناك سجلات مرتبطة";
  if (e.code === "23502") return "حقل مطلوب مفقود";
  if (e.code === "42501") return "ليس لديك صلاحية تنفيذ هذا الإجراء";
  if (e.code === "PGRST301") return "ليس لديك صلاحية الوصول";
  if (e.code === "P0001" && e.message) return e.message;
  if (e.message) {
    if (/permission denied/i.test(e.message)) return "ليس لديك صلاحية تنفيذ هذا الإجراء";
    if (/rate limit/i.test(e.message)) return "تجاوزت الحد المسموح، حاول لاحقاً";
    if (/network|fetch/i.test(e.message)) return "تعذر الاتصال بالخادم، تحقق من الإنترنت";
    return translateAuthError(e.message);
  }
  return fallback;
}
