
DROP POLICY IF EXISTS "users read own notifs" ON public.notifications;
CREATE POLICY "users read own notifs"
ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users update own notifs" ON public.notifications;
CREATE POLICY "users update own notifs"
ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "reviews public read" ON public.reviews;
CREATE POLICY "reviews public read"
ON public.reviews FOR SELECT
USING (is_visible = true);

CREATE INDEX IF NOT EXISTS idx_hearings_date_range
ON public.hearings(hearing_date, case_id);

CREATE INDEX IF NOT EXISTS idx_consultations_lawyer_date
ON public.consultations(lawyer_id, scheduled_at);
