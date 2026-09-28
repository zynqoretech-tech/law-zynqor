import { createFileRoute } from "@tanstack/react-router";
import { AdminSectionPage } from "@/components/AdminSectionPage";

export const Route = createFileRoute("/dashboard/admin/")({
  head: () => ({ meta: [
    { title: "إدارة الموقع — الوكيل" },
    { name: "description", content: "نظرة شاملة على نشاط منصة الوكيل وإدارتها." },
    { property: "og:title", content: "إدارة الموقع — الوكيل" },
    { property: "og:description", content: "نظرة شاملة على نشاط منصة الوكيل وإدارتها." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AdminSectionPage section="overview" />,
});
