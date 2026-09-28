ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS notes_private TEXT;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS review TEXT;
CREATE INDEX IF NOT EXISTS idx_lawyers_rating ON public.lawyers(rating DESC);
CREATE INDEX IF NOT EXISTS idx_lawyers_specializations ON public.lawyers USING gin(specializations);
CREATE INDEX IF NOT EXISTS idx_cases_lawyer_status ON public.cases(lawyer_id, status);
CREATE INDEX IF NOT EXISTS idx_hearings_case_date ON public.hearings(case_id, hearing_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);
DROP POLICY IF EXISTS "doc delete auth" ON storage.objects;
CREATE POLICY "doc delete auth" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('documents', 'case-files') AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "doc insert auth" ON storage.objects;
CREATE POLICY "doc insert auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('documents', 'case-files') AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "doc select auth" ON storage.objects;
CREATE POLICY "doc select auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id IN ('documents', 'case-files') AND auth.uid() IS NOT NULL);