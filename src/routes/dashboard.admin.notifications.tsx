import { createFileRoute } from "@tanstack/react-router";
import { AdminSectionPage } from "@/components/AdminSectionPage";

export const Route = createFileRoute("/dashboard/admin/notifications")({
  head: () => ({ meta: [
    { title: "إشعارات الإدارة — الوكيل" },
    { name: "description", content: "إدارة الإشعارات العامة في منصة الوكيل." },
    { property: "og:title", content: "إشعارات الإدارة — الوكيل" },
    { property: "og:description", content: "إدارة الإشعارات العامة في منصة الوكيل." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AdminSectionPage section="notifications" />,
});
