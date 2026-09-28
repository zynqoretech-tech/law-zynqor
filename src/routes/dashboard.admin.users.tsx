import { createFileRoute } from "@tanstack/react-router";
import { AdminSectionPage } from "@/components/AdminSectionPage";

export const Route = createFileRoute("/dashboard/admin/users")({
  head: () => ({ meta: [
    { title: "إدارة المستخدمين — الوكيل" },
    { name: "description", content: "إدارة حسابات مستخدمي منصة الوكيل." },
    { property: "og:title", content: "إدارة المستخدمين — الوكيل" },
    { property: "og:description", content: "إدارة حسابات مستخدمي منصة الوكيل." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AdminSectionPage section="users" />,
});
