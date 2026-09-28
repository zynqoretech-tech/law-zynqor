import { createFileRoute } from "@tanstack/react-router";
import { AdminSectionPage } from "@/components/AdminSectionPage";

export const Route = createFileRoute("/dashboard/admin/moderation")({
  head: () => ({ meta: [
    { title: "التوثيق والمراجعات — الوكيل" },
    { name: "description", content: "مراجعة توثيق المحامين وتقييمات العملاء." },
    { property: "og:title", content: "التوثيق والمراجعات — الوكيل" },
    { property: "og:description", content: "مراجعة توثيق المحامين وتقييمات العملاء." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AdminSectionPage section="moderation" />,
});
