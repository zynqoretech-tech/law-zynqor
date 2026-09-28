import { createFileRoute } from "@tanstack/react-router";
import { MessagesView } from "@/components/MessagesView";

export const Route = createFileRoute("/dashboard/lawyer/messages")({
  head: () => ({
    meta: [
      { title: "المحادثات — الوكيل" },
      { name: "description", content: "محادثات مباشرة بين المحامي وموكليه داخل منصة الوكيل." },
      { property: "og:title", content: "المحادثات — الوكيل" },
      { property: "og:description", content: "محادثات مباشرة بين المحامي وموكليه." },
    ],
  }),
  component: () => <MessagesView role="lawyer" />,
});
