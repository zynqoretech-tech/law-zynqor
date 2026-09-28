import { createFileRoute } from "@tanstack/react-router";

type PlanId = "basic" | "pro" | "office";
const PLAN_PRICES_EGP: Record<PlanId, number> = { basic: 500, pro: 650, office: 845 };

type ReqBody =
  | { purpose: "subscription"; plan: PlanId; months?: number }
  | { purpose: "consultation_deposit"; consultation_id: string; amount: number };

export const Route = createFileRoute("/api/payments/create-intention")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifySupabaseJWT, getAdmin, checkRateDB } = await import("../_admin.server");
        const { loadPaymobConfig, createIntention, checkoutUrl } = await import("./_paymob.server");

        const userId = await verifySupabaseJWT(request.headers.get("authorization"));
        if (!userId) return Response.json({ available: false, reason: "unauthorized" }, { status: 401 });

        // Rate-limit: 5 payment-intention creations per minute per user
        const ok = await checkRateDB(userId, 5);
        if (!ok) return Response.json({ available: false, reason: "rate_limited" }, { status: 429 });

        const cfg = loadPaymobConfig();
        if (!cfg) return Response.json({ available: false, reason: "gateway_not_configured" }, { status: 503 });

        let body: ReqBody;
        try { body = (await request.json()) as ReqBody; }
        catch { return Response.json({ available: false, reason: "bad_json" }, { status: 400 }); }

        const admin = getAdmin();
        if (!admin) return Response.json({ available: false, reason: "backend_unconfigured" }, { status: 503 });

        // Compute amount + purpose server-side; never trust client-supplied amounts blindly
        let amount = 0;
        let relatedId: string | null = null;
        let purpose: "subscription" | "consultation_deposit";
        const months = body.purpose === "subscription" ? Math.max(1, Math.min(12, body.months ?? 1)) : 1;

        if (body.purpose === "subscription") {
          if (!(body.plan in PLAN_PRICES_EGP)) return Response.json({ available: false, reason: "invalid_plan" }, { status: 400 });
          amount = PLAN_PRICES_EGP[body.plan] * months;
          relatedId = `${body.plan}:${months}`;
          purpose = "subscription";
        } else if (body.purpose === "consultation_deposit") {
          if (!body.consultation_id) return Response.json({ available: false, reason: "missing_consultation" }, { status: 400 });
          // Look up the real consultation price to prevent client-side tampering
          const { data: c } = await admin.from("consultations").select("id, price, client_id").eq("id", body.consultation_id).maybeSingle();
          if (!c || c.client_id !== userId) return Response.json({ available: false, reason: "not_found" }, { status: 404 });
          amount = Math.max(50, Math.round(Number(c.price) * 0.25)); // 25% deposit, min 50 EGP
          relatedId = c.id;
          purpose = "consultation_deposit";
        } else {
          return Response.json({ available: false, reason: "invalid_purpose" }, { status: 400 });
        }

        const { data: profile } = await admin.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle();
        const { data: authUser } = await admin.auth.admin.getUserById(userId);
        const email = authUser?.user?.email ?? "no-email@example.com";
        const [firstName, ...rest] = String(profile?.full_name ?? "User").split(" ");
        const lastName = rest.join(" ") || firstName;

        // Insert pending payment row
        const { data: pay, error: payErr } = await admin.from("payments").insert({
          user_id: userId, amount, currency: "EGP", provider: "paymob",
          status: "pending", purpose, related_id: relatedId,
        }).select("id").single();
        if (payErr || !pay) return Response.json({ available: false, reason: "db_error" }, { status: 500 });

        try {
          const intention = await createIntention(cfg, {
            amountEgp: amount,
            billing: {
              first_name: firstName, last_name: lastName,
              email, phone_number: profile?.phone ?? "+201000000000",
            },
            extras: { payment_id: pay.id, purpose, related_id: relatedId ?? "" },
          });
          await admin.from("payments").update({ provider_ref: intention.id, meta: JSON.parse(JSON.stringify(intention)) }).eq("id", pay.id);
          return Response.json({
            available: true,
            client_secret: intention.client_secret,
            checkout_url: checkoutUrl(cfg, intention.client_secret),
            payment_id: pay.id,
          });
        } catch (e) {
          await admin.from("payments").update({ status: "failed", meta: { error: (e as Error).message } }).eq("id", pay.id);
          return Response.json({ available: false, reason: "gateway_error" }, { status: 502 });
        }
      },
    },
  },
});
