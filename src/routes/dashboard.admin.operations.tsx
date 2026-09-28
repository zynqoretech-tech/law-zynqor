import { createFileRoute } from "@tanstack/react-router";
import { AdminSectionPage } from "@/components/AdminSectionPage";

export const Route = createFileRoute("/dashboard/admin/operations")({
  head: () => ({ meta: [
    { title: "العمليات القانونية — الوكيل" },
    { name: "description", content: "متابعة القضايا والاستشارات وطلبات التوكيل." },
    { property: "og:title", content: "العمليات القانونية — الوكيل" },
    { property: "og:description", content: "متابعة القضايا والاستشارات وطلبات التوكيل." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AdminSectionPage section="operations" />,
});
