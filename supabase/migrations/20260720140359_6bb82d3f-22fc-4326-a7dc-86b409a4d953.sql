
CREATE TABLE public.archive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  tags TEXT[] DEFAULT '{}',
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES public.case_expenses(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.manual_clients(id) ON DELETE SET NULL,
  hearing_id UUID REFERENCES public.hearings(id) ON DELETE SET NULL,
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.archive_files TO authenticated;
GRANT ALL ON public.archive_files TO service_role;

ALTER TABLE public.archive_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "archive_owner_all" ON public.archive_files
  FOR ALL TO authenticated
  USING (auth.uid() = lawyer_id)
  WITH CHECK (auth.uid() = lawyer_id);

CREATE POLICY "archive_admin_read" ON public.archive_files
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER archive_files_updated_at BEFORE UPDATE ON public.archive_files
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_archive_files_lawyer ON public.archive_files(lawyer_id);
CREATE INDEX idx_archive_files_case ON public.archive_files(case_id);

-- Storage policies: files are stored under {lawyer_id}/... in bucket 'archive'
CREATE POLICY "archive_bucket_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'archive' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "archive_bucket_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'archive' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "archive_bucket_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'archive' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'archive' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "archive_bucket_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'archive' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "archive_bucket_admin_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'archive' AND public.has_role(auth.uid(), 'admin'));
