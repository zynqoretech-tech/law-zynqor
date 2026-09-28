import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Global realtime subscriber for the current user's notifications.
 * Mounted once in RootComponent. Shows a toast + fires a Web Notification
 * (when permission was granted) on every insert into public.notifications.
 * Re-subscribes automatically when the user signs in / out.
 */
export function NotificationsRealtime() {
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let currentUser: string | null = null;
    let cancelled = false;

    function teardown() {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      currentUser = null;
    }

    function subscribe(userId: string) {
      if (currentUser === userId) return;
      teardown();
      currentUser = userId;

      channel = supabase
        .channel(`notif:${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          (payload) => {
            const n = payload.new as { title?: string; body?: string | null };
            const title = n.title ?? "إشعار جديد";
            const body = n.body ?? undefined;
            toast(title, { description: body });
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              try {
                const w = new Notification(title, { body, icon: "/favicon.jpg", dir: "rtl", lang: "ar" });
                w.onclick = () => { window.focus(); w.close(); };
              } catch { /* ignore */ }
            }
          },
        )
        .subscribe();
    }

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      // Ask for browser notification permission once (silent no-op if declined).
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
        try { Notification.requestPermission().catch(() => {}); } catch { /* ignore */ }
      }
      subscribe(user.id);
    })();

    // React to sign-in/out: (re)subscribe for the new identity.
    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") { teardown(); return; }
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
        const id = session?.user?.id;
        if (id) subscribe(id);
      }
    });

    return () => {
      cancelled = true;
      authSub.subscription.unsubscribe();
      teardown();
    };
  }, []);

  return null;
}
