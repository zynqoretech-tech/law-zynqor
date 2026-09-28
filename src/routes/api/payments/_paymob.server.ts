// Paymob helpers — server-only. Never imported from client code.
import { createHmac, timingSafeEqual } from "crypto";

export type PaymobConfig = {
  secretKey: string;
  publicKey: string;
  hmacSecret: string;
  integrationIds: number[];
};

export function loadPaymobConfig(): PaymobConfig | null {
  const secretKey = process.env.PAYMOB_SECRET_KEY;
  const publicKey = process.env.PAYMOB_PUBLIC_KEY;
  const hmacSecret = process.env.PAYMOB_HMAC_SECRET;
  const idCard = process.env.PAYMOB_INTEGRATION_ID_CARD;
  const idWallet = process.env.PAYMOB_INTEGRATION_ID_WALLET;
  if (!secretKey || !publicKey || !hmacSecret) return null;
  const ids = [idCard, idWallet].filter(Boolean).map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
  if (ids.length === 0) return null;
  return { secretKey, publicKey, hmacSecret, integrationIds: ids };
}

export type IntentionInput = {
  amountEgp: number;
  currency?: "EGP";
  billing: { first_name: string; last_name: string; email: string; phone_number: string };
  extras?: Record<string, string | number | boolean | null>;
};

export async function createIntention(cfg: PaymobConfig, input: IntentionInput) {
  const amountCents = Math.round(input.amountEgp * 100);
  const body = {
    amount: amountCents,
    currency: input.currency ?? "EGP",
    payment_methods: cfg.integrationIds,
    items: [{ name: "Al-Wakeel", amount: amountCents, description: "Al-Wakeel payment", quantity: 1 }],
    billing_data: input.billing,
    extras: input.extras ?? {},
  };
  const res = await fetch("https://accept.paymob.com/v1/intention/", {
    method: "POST",
    headers: {
      Authorization: `Token ${cfg.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`paymob_intention_failed:${res.status}:${err.slice(0, 200)}`);
  }
  return (await res.json()) as { id: string; client_secret: string };
}

export function checkoutUrl(cfg: PaymobConfig, clientSecret: string): string {
  return `https://accept.paymob.com/unifiedcheckout/?publicKey=${encodeURIComponent(cfg.publicKey)}&clientSecret=${encodeURIComponent(clientSecret)}`;
}

/**
 * Verify Paymob HMAC — concatenates specific fields in a fixed order,
 * SHA-512 HMAC, hex, timing-safe comparison.
 */
export function verifyHmac(cfg: PaymobConfig, obj: Record<string, unknown>, providedHmac: string): boolean {
  const fields = [
    "amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction",
    "id", "integration_id", "is_3d_secure", "is_auth", "is_capture", "is_refunded",
    "is_standalone_payment", "is_voided", "order.id", "owner", "pending",
    "source_data.pan", "source_data.sub_type", "source_data.type", "success",
  ];
  const get = (path: string): string => {
    const parts = path.split(".");
    let v: unknown = obj;
    for (const p of parts) {
      if (v && typeof v === "object" && p in (v as Record<string, unknown>)) {
        v = (v as Record<string, unknown>)[p];
      } else { v = ""; break; }
    }
    return v === null || v === undefined ? "" : String(v);
  };
  const concatenated = fields.map(get).join("");
  const expected = createHmac("sha512", cfg.hmacSecret).update(concatenated).digest("hex");
  try {
    const a = Buffer.from(providedHmac, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch { return false; }
}
