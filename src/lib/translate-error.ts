export function translateAuthError(msg: string): string {
  const map: Record<string, string> = {
    "New password should be different from the old password": "كلمة المرور الجديدة يجب أن تختلف عن القديمة",
    "Password should be at least 6 characters": "يجب أن تكون كلمة المرور 6 أحرف على الأقل",
    "Auth session missing": "انتهت جلستك، يرجى تسجيل الدخول مجدداً",
    "Invalid login credentials": "بيانات الدخول غير صحيحة",
    "Email not confirmed": "يرجى تأكيد بريدك الإلكتروني أولاً",
    "User not found": "المستخدم غير موجود",
    "User already registered": "هذا البريد مسجّل بالفعل",
    "Too many requests": "طلبات كثيرة جداً، حاول مجدداً لاحقاً",
    "Email rate limit exceeded": "تم تجاوز الحد المسموح لإرسال البريد، حاول لاحقاً",
    "Unable to validate email address": "البريد الإلكتروني غير صحيح",
    "Signup requires a valid password": "كلمة المرور مطلوبة",
  };
  for (const [en, ar] of Object.entries(map)) {
    if (msg.toLowerCase().includes(en.toLowerCase())) return ar;
  }
  return msg;
}
