import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/client/consultations")({
  component: () => <Outlet />,
});
