import { createStart, createMiddleware, createCsrfMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    const reference = `AW-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    console.error(`[${reference}]`, error);
    return new Response(renderErrorPage(reference), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store, max-age=0", "x-error-reference": reference },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [csrfMiddleware, errorMiddleware],
}));

