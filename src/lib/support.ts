// Central support contact configuration.
// To enable WhatsApp support: set SUPPORT_WHATSAPP to a real number (digits only, with country code, e.g. "201XXXXXXXXX")
// While SUPPORT_WHATSAPP is empty, the WhatsApp button gracefully falls back to email.

export const SUPPORT_WHATSAPP = "201017440218"; // الرقم الرسمي للمنصة
export const SUPPORT_PHONE_DISPLAY = "01017440218";
export const SUPPORT_EMAIL = "support@alwakeel.app";

export function supportContactUrl(message?: string): string {
  if (SUPPORT_WHATSAPP) {
    const base = `https://wa.me/${SUPPORT_WHATSAPP}`;
    return message ? `${base}?text=${encodeURIComponent(message)}` : base;
  }
  const subject = encodeURIComponent("استفسار من منصة الوكيل");
  const body = encodeURIComponent(message ?? "");
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}${body ? `&body=${body}` : ""}`;
}

export const supportIsWhatsapp = () => Boolean(SUPPORT_WHATSAPP);
