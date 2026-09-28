import { createFileRoute } from "@tanstack/react-router";
import { AdminSectionPage } from "@/components/AdminSectionPage";

export const Route = createFileRoute("/dashboard/admin/lawyers")({
  head: () => ({ meta: [
    { title: "إدارة المحامين — الوكيل" },
    { name: "description", content: "إدارة المحامين والمكاتب والتوثيق." },
    { property: "og:title", content: "إدارة المحامين — الوكيل" },
    { property: "og:description", content: "إدارة المحامين والمكاتب والتوثيق." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AdminSectionPage section="lawyers" />,
});
