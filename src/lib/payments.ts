// Client-side helpers for the Paymob integration.
// Note: Paymob calls happen server-side in src/routes/api/payments/*.
import { supabase } from "@/integrations/supabase/client";

export type CreateIntentionInput =
  | { purpose: "subscription"; plan: "basic" | "pro" | "office"; months?: number }
  | { purpose: "consultation_deposit"; consultation_id: string; amount: number };

export type CreateIntentionResult =
  | { available: true; client_secret: string; checkout_url: string; payment_id: string }
  | { available: false; reason: string; status?: number };

export async function createPaymentIntention(input: CreateIntentionInput): Promise<CreateIntentionResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { available: false, reason: "unauthenticated" };
  const res = await fetch("/api/payments/create-intention", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ reason: "http_error" }));
    return { available: false, reason: err.reason ?? `http_${res.status}`, status: res.status };
  }
  return await res.json();
}
