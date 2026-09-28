import { apiFetch } from "@/lib/laravel";

/** Call Laravel /api/v1/ai/chat attaching the Sanctum bearer token. */
export async function chatFetch(body: any): Promise<Response> {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";
  const tool = body?.tool || "legal_qa";

  let mode = "general";
  if (tool === "contract_review" || tool === "draft" || tool === "case_strategy") {
    mode = "premium";
  }

  try {
    const res = await apiFetch("/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        message: lastUserMsg || "استشارة قانونية",
        mode,
      }),
    });

    const reply = res?.data?.message || res?.data?.response || res?.message || res?.response || "تمت الإجابة بنجاح.";
    const statutes = res?.data?.statutes_used || [];

    return new Response(
      JSON.stringify({
        text: reply,
        statutes_used: statutes,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        text: `عذراً، حدث خطأ أثناء معالجة السؤال: ${err.message || "يرجى المحاولة لاحقاً."}`,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
}