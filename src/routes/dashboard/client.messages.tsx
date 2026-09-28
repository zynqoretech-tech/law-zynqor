import { createFileRoute } from "@tanstack/react-router";
import { MessagesView } from "@/components/MessagesView";

export const Route = createFileRoute("/dashboard/client/messages")({
  head: () => ({
    meta: [
      { title: "المحادثات — الوكيل" },
      { name: "description", content: "تواصل مباشرة مع محاميك داخل منصة الوكيل." },
      { property: "og:title", content: "المحادثات — الوكيل" },
      { property: "og:description", content: "تواصل مباشرة مع محاميك." },
    ],
  }),
  component: () => <MessagesView role="client" />,
});
