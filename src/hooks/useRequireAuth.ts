import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "./useAuth";
import { redirectToAuthWithIntent, type PendingAction } from "@/lib/auth-intent";

export function useRequireAuth() {
  const { isAuthed, loading, ...rest } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  function requireAuth(pendingAction?: PendingAction): boolean {
    if (loading) return false;
    if (isAuthed) return true;
    redirectToAuthWithIntent(pathname, pendingAction, (opts) =>
      navigate(opts as Parameters<typeof navigate>[0]),
    );
    return false;
  }

  return { requireAuth, isAuthed, loading, ...rest };
}
