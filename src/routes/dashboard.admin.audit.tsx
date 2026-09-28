import { createFileRoute } from "@tanstack/react-router";
import { AdminSectionPage } from "@/components/AdminSectionPage";

export const Route = createFileRoute("/dashboard/admin/audit")({
  head: () => ({ meta: [
    { title: "سجل الإدارة — الوكيل" },
    { name: "description", content: "مراجعة سجل العمليات الإدارية الحساسة." },
    { property: "og:title", content: "سجل الإدارة — الوكيل" },
    { property: "og:description", content: "مراجعة سجل العمليات الإدارية الحساسة." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AdminSectionPage section="audit" />,
});
