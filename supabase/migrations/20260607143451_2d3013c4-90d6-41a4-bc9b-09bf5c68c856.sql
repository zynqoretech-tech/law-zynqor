ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.consultations REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='consultations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.consultations;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_case_id ON public.invoices(case_id, status, created_at DESC);

DROP POLICY IF EXISTS "users insert own notifs" ON public.notifications;
CREATE POLICY "users insert own notifs"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());