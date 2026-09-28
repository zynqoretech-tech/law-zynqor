import { createFileRoute } from "@tanstack/react-router";
import { AdminSectionPage } from "@/components/AdminSectionPage";

export const Route = createFileRoute("/dashboard/admin/clients")({
  head: () => ({ meta: [
    { title: "إدارة العملاء — الوكيل" },
    { name: "description", content: "إدارة حسابات العملاء وبياناتهم." },
    { property: "og:title", content: "إدارة العملاء — الوكيل" },
    { property: "og:description", content: "إدارة حسابات العملاء وبياناتهم." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AdminSectionPage section="clients" />,
});
