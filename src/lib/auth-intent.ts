// Auth Continuation: persist user intent across the /auth redirect so users
// resume their original action (booking, etc.) after sign-in.

export type PendingAction =
  | { type: "book_consultation"; lawyerId: string }
  | { type: "create_case" }
  | { type: "download_document"; documentId: string }
  | { type: "open_ai_assistant" }
  | { type: "contact_lawyer"; lawyerId: string }
  | { type: "generic" };

export interface AuthIntent {
  returnUrl: string;
  pendingAction?: PendingAction;
  timestamp: number;
}

const STORAGE_KEY = "alwakeel_auth_intent";
const INTENT_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveAuthIntent(returnUrl: string, pendingAction?: PendingAction): void {
  const s = storage();
  if (!s || !returnUrl || returnUrl.startsWith("/auth")) return;
  const intent: AuthIntent = { returnUrl, pendingAction, timestamp: Date.now() };
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(intent));
  } catch {
    /* ignore */
  }
}

export function getAuthIntent(): AuthIntent | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return null;
    const intent: AuthIntent = JSON.parse(raw);
    if (!intent?.returnUrl || typeof intent.timestamp !== "number") {
      clearAuthIntent();
      return null;
    }
    if (Date.now() - intent.timestamp > INTENT_EXPIRY_MS) {
      clearAuthIntent();
      return null;
    }
    return intent;
  } catch {
    return null;
  }
}

export function clearAuthIntent(): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function redirectToAuthWithIntent(
  currentUrl: string,
  pendingAction: PendingAction | undefined,
  navigate: (opts: { to: string; search?: Record<string, unknown> }) => void,
): void {
  saveAuthIntent(currentUrl, pendingAction);
  navigate({ to: "/auth", search: { returnUrl: currentUrl } });
}
