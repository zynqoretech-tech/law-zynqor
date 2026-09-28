import { supabase } from "@/integrations/supabase/client";

/** Opens (or reuses) the private conversation between a lawyer and a client. */
export async function openConversation(params: {
  lawyerId: string;
  clientId: string;
  source?: "engagement" | "consultation";
  sourceId?: string | null;
}): Promise<string | null> {
  const { data, error } = await supabase.rpc("open_conversation", {
    _lawyer_id: params.lawyerId,
    _client_id: params.clientId,
    _source: params.source ?? "engagement",
    _source_id: params.sourceId ?? undefined,
  });
  if (error) {
    console.error("open_conversation failed", error);
    return null;
  }
  return (data as unknown as string) ?? null;
}

/** Best-effort in-app notification insert (RLS may reject; failure is non-fatal). */
export async function notifyUser(input: {
  userId: string;
  title: string;
  body?: string;
  type: string;
  relatedId?: string | null;
  relatedType?: string | null;
}) {
  const { error } = await supabase.from("notifications").insert({
    user_id: input.userId,
    title: input.title,
    body: input.body ?? null,
    type: input.type,
    related_id: input.relatedId ?? null,
    related_type: input.relatedType ?? null,
  });
  if (error) console.warn("notification insert failed", error.message);
}
