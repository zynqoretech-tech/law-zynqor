import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useMemo, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { NotificationsRealtime } from "@/components/NotificationsRealtime";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="font-display text-8xl text-gradient-gold font-bold mb-4">404</div>
        <h2 className="text-xl font-semibold text-foreground mb-2">الصفحة غير موجودة</h2>
        <p className="text-sm text-muted-foreground mb-6">
          الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center bg-gold-gradient text-primary-foreground px-6 py-2.5 rounded-lg font-semibold shadow-gold hover:scale-[1.02] transition"
        >
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}

function isChunkLoadError(error: Error) {
  const msg = `${error?.name ?? ""} ${error?.message ?? ""}`;
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    msg,
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const reference = useMemo(() => {
    const source = `${error.name}:${error.message}`;
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `AW-${Math.abs(hash >>> 0).toString(36).toUpperCase()}`;
  }, [error]);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  // A stale deployment can leave an open tab pointing at chunks that no longer
  // exist. Retry once per minute with a cache-busting URL. RootComponent clears
  // the marker after a successful render, so later deployments can recover too.
  useEffect(() => {
    if (typeof window === "undefined" || !isChunkLoadError(error)) return;
    const key = "alwakeel:chunk-reloaded";
    const lastReload = Number(window.sessionStorage.getItem(key) ?? 0);
    if (Date.now() - lastReload < 60_000) return;
    window.sessionStorage.setItem(key, String(Date.now()));
    const url = new URL(window.location.href);
    url.searchParams.set("_app_refresh", String(Date.now()));
    window.location.replace(url.toString());
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-semibold text-foreground mb-2">حدث خطأ غير متوقع</h1>
        <p className="text-sm text-muted-foreground mb-6">
          حدث خطأ في تحميل الصفحة. يمكنك المحاولة مجدداً أو العودة للرئيسية.
        </p>
        <p className="mb-4 font-mono text-xs text-muted-foreground" dir="ltr">رقم المرجع: {reference}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="bg-gold-gradient text-primary-foreground px-5 py-2 rounded-lg font-semibold"
          >
            حاول مجدداً
          </button>
          <a
            href="/"
            className="border border-gold/40 text-gold px-5 py-2 rounded-lg font-semibold hover:bg-gold/10"
          >
            الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "الوكيل — Al-Wakeel" },
      { name: "description", content: "أول منصة قانونية ذكية في مصر" },
      { name: "author", content: "Al-Wakeel" },
      { property: "og:title", content: "الوكيل — Al-Wakeel" },
      { property: "og:description", content: "أول منصة قانونية ذكية في مصر" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "theme-color", content: "#1a1523" },
      { name: "twitter:title", content: "الوكيل — Al-Wakeel" },
      { name: "twitter:description", content: "أول منصة قانونية ذكية في مصر" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e2e64503-c324-4546-aa7e-49c9234f7e7b/id-preview-1792c8bb--e2e76b21-8cda-4edc-9245-4794e7819b97.lovable.app-1780237636915.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e2e64503-c324-4546-aa7e-49c9234f7e7b/id-preview-1792c8bb--e2e76b21-8cda-4edc-9245-4794e7819b97.lovable.app-1780237636915.png" },
    ],
    links: [
      { rel: "icon", type: "image/jpeg", href: "/favicon.jpg" },
      { rel: "apple-touch-icon", href: "/favicon.jpg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700;900&family=Cormorant+Garamond:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem("alwakeel:chunk-reloaded");
    const url = new URL(window.location.href);
    if (!url.searchParams.has("_app_refresh")) return;
    url.searchParams.delete("_app_refresh");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <NotificationsRealtime />
      <Toaster
        position="bottom-right"
        dir="rtl"
        toastOptions={{
          classNames: {
            toast: "bg-surface border border-gold-soft/40 text-foreground",
            success: "border-green-500/40",
            error: "border-destructive/40",
          },
        }}
      />
    </QueryClientProvider>
  );
}

