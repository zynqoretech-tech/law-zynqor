-- Storage policies for documents bucket (personal docs)
DROP POLICY IF EXISTS "documents insert own" ON storage.objects;
CREATE POLICY "documents insert own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "documents select own" ON storage.objects;
CREATE POLICY "documents select own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "documents delete own" ON storage.objects;
CREATE POLICY "documents delete own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ensure documents table has folder column (already exists per schema, idempotent)
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT 'general';

-- clients see own invoices
DROP POLICY IF EXISTS "clients see own invoices" ON public.invoices;
CREATE POLICY "clients see own invoices"
ON public.invoices FOR SELECT TO authenticated
USING (client_id = auth.uid());

-- indexes
CREATE INDEX IF NOT EXISTS idx_documents_case ON public.documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents(uploaded_by, client_id);