-- Allow authenticated users to create notifications for others (e.g. client -> lawyer).
-- Read remains own-only via existing SELECT policy; we split the ALL policy.
DROP POLICY IF EXISTS "notif own" ON public.notifications;
CREATE POLICY "notif select own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif update own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif delete own" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif insert any authed" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);