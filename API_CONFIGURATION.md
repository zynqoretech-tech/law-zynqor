# دليل تغيير رابط الـ API (API URL Configuration)

لتغيير رابط الـ API الأساسي للتطبيق بالكامل من مكان واحد، يمكنك القيام بذلك عبر إحدى الطريقتين التاليتين:

---

### 1. المكان الموصى به: ملف البيئة `.env` (الخيار الأسهل) 🌟

افتح الملف:
[`reactjs-project/.env`](file:///Users/marcel/Sites/law/law-firm-zynqor/reactjs-project/.env)

وقم بتعديل المتغير التالي إلى الرابط الذي تريده:

```env
VITE_API_URL=https://api-law.mr-zynqor.lat/api/v1
```

> **ملاحظة:** يتم قراءة هذا المتغير تلقائياً في كل أجزاء التطبيق (Client & Server Side). عند تغييره لا تحتاج لتعديل أي كود.

---

### 2. المكان الأساسي في الكود (Fallback / Single Source of Truth)

إذا لم يتوفر ملف `.env` أو أردت تغيير القيمة الافتراضية داخل الكود نفسه، يمكنك تعديل دالة `getBaseUrl()` في ملف واحد فقط:

[`reactjs-project/src/lib/laravel.ts`](file:///Users/marcel/Sites/law/law-firm-zynqor/reactjs-project/src/lib/laravel.ts)

```typescript
export function getBaseUrl(): string {
  // يقوم بقراءة VITE_API_URL من .env أولاً
  // أو الرجوع إلى الرابط الافتراضي:
  return "https://api-law.mr-zynqor.lat/api/v1";
}
```

---

### الملخص السريع:

| المكان | المسار | متى تستخدمه؟ |
|---|---|---|
| **ملف البيئة** | [`.env`](file:///Users/marcel/Sites/law/law-firm-zynqor/reactjs-project/.env) | **المكان الأساسي الموصى به** لتغيير الرابط للإنتاج أو التطوير المحلي دون لمس الكود. |
| **ملف الكود الموحد** | [`src/lib/laravel.ts`](file:///Users/marcel/Sites/law/law-firm-zynqor/reactjs-project/src/lib/laravel.ts) | لتعديل منطق التوجيه الافتراضي أو الرابط الاحتياطي لجميع طلبات `apiFetch`. |
