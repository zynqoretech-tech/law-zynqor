import { createFileRoute } from "@tanstack/react-router";
import { AdminSectionPage } from "@/components/AdminSectionPage";

export const Route = createFileRoute("/dashboard/admin/invoices")({
  head: () => ({ meta: [
    { title: "إدارة الفواتير — الوكيل" },
    { name: "description", content: "مراجعة الفواتير وحالات السداد." },
    { property: "og:title", content: "إدارة الفواتير — الوكيل" },
    { property: "og:description", content: "مراجعة الفواتير وحالات السداد." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AdminSectionPage section="invoices" />,
});
