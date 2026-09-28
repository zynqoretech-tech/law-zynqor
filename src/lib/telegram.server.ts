// Telegram helper — server-only. Uses the Lovable connector gateway.
import { createClient } from "@supabase/supabase-js";

const GATEWAY = "https://connector-gateway.lovable.dev/telegram";

function keys() {
  const lovable = process.env.LOVABLE_API_KEY;
  const conn = process.env.TELEGRAM_API_KEY;
  if (!lovable || !conn) return null;
  return { lovable, conn };
}

export async function tgCall(method: string, body: Record<string, unknown>): Promise<any | null> {
  const k = keys();
  if (!k) return null;
  try {
    const r = await fetch(`${GATEWAY}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${k.lovable}`,
        "X-Connection-Api-Key": k.conn,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      console.error(`telegram ${method} failed`, r.status, await r.text());
      return null;
    }
    return await r.json();
  } catch (e) {
    console.error("telegram error", e);
    return null;
  }
}

export function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Send a message to a specific user by their profile.id. Silently skips if unlinked. */
export async function sendToUser(userId: string, text: string): Promise<void> {
  const a = admin();
  const { data } = await a.from("profiles").select("telegram_chat_id").eq("id", userId).single();
  const chatId = (data as any)?.telegram_chat_id;
  if (!chatId) return;
  await tgCall("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
}

/** Broadcast to all admins with linked telegram. */
export async function sendToAdmins(text: string): Promise<void> {
  const a = admin();
  const { data } = await a
    .from("user_roles")
    .select("user_id, profiles!inner(telegram_chat_id)")
    .eq("role", "admin");
  const ids = (data ?? [])
    .map((r: any) => r.profiles?.telegram_chat_id)
    .filter(Boolean);
  await Promise.all(ids.map((chat_id: number) => tgCall("sendMessage", { chat_id, text, parse_mode: "HTML" })));
}
