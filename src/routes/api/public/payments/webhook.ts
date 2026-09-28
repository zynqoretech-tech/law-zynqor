// Paymob transaction webhook — public endpoint, HMAC-verified.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getAdmin } = await import("../../_admin.server");
        const { loadPaymobConfig, verifyHmac } = await import("../../payments/_paymob.server");

        const cfg = loadPaymobConfig();
        if (!cfg) return new Response("gateway_not_configured", { status: 503 });

        const url = new URL(request.url);
        const providedHmac = url.searchParams.get("hmac") ?? request.headers.get("x-paymob-hmac") ?? "";
        if (!providedHmac) return new Response("missing_hmac", { status: 400 });

        let payload: Record<string, unknown>;
        try { payload = (await request.json()) as Record<string, unknown>; }
        catch { return new Response("bad_json", { status: 400 }); }

        const obj = ((payload as { obj?: Record<string, unknown> }).obj ?? payload) as Record<string, unknown>;
        if (!verifyHmac(cfg, obj, providedHmac)) {
          return new Response("invalid_hmac", { status: 401 });
        }

        const admin = getAdmin();
        if (!admin) return new Response("backend_unconfigured", { status: 503 });

        const success = obj.success === true;
        const orderId = String((obj as { order?: { id?: unknown } }).order?.id ?? "");
        const extras = ((obj as { payment_key_claims?: { extra?: Record<string, unknown> } }).payment_key_claims?.extra
                        ?? (obj as { extras?: Record<string, unknown> }).extras
                        ?? {}) as Record<string, unknown>;
        const paymentId = String(extras.payment_id ?? "");
        const purpose = String(extras.purpose ?? "");
        const relatedId = extras.related_id ? String(extras.related_id) : null;

        if (!paymentId) return new Response("missing_payment_id", { status: 400 });

        // Idempotency: bail out if already marked paid
        const { data: existing } = await admin.from("payments").select("id, status, user_id").eq("id", paymentId).maybeSingle();
        if (!existing) return new Response("payment_not_found", { status: 404 });
        if (existing.status === "paid") return new Response("already_processed", { status: 200 });

        await admin.from("payments").update({
          status: success ? "paid" : "failed",
          provider_ref: orderId || existing.id,
          meta: JSON.parse(JSON.stringify(obj)),
        }).eq("id", paymentId);

        if (success) {
          if (purpose === "subscription" && relatedId) {
            const [plan, monthsStr] = relatedId.split(":");
            const months = Math.max(1, Math.min(12, parseInt(monthsStr ?? "1", 10) || 1));
            if (["basic", "pro", "office"].includes(plan)) {
              await admin.rpc("activate_subscription_from_payment", {
                _user_id: existing.user_id,
                _plan: plan,
                _months: months,
                _provider_ref: orderId,
              });
            }
          } else if (purpose === "consultation_deposit" && relatedId) {
            await admin.from("consultations").update({ deposit_status: "paid" }).eq("id", relatedId);
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
