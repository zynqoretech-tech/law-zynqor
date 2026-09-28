import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import type { PendingAction } from "@/lib/auth-intent";

interface AuthGuardProps {
  children: ReactNode;
  pendingAction?: PendingAction;
  fallback?: ReactNode;
  autoRedirect?: boolean;
}

export function AuthGuard({ children, pendingAction, fallback, autoRedirect = false }: AuthGuardProps) {
  const { requireAuth, isAuthed, loading } = useRequireAuth();

  useEffect(() => {
    if (autoRedirect && !loading && !isAuthed) {
      requireAuth(pendingAction);
    }
  }, [autoRedirect, loading, isAuthed, pendingAction, requireAuth]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthed) return fallback ? <>{fallback}</> : null;

  return <>{children}</>;
}
