
DROP POLICY IF EXISTS "reviews client write" ON public.reviews;
CREATE POLICY "reviews client write"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  client_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.consultations c
    WHERE c.id = reviews.consultation_id
      AND c.client_id = auth.uid()
      AND c.lawyer_id = reviews.lawyer_id
      AND c.status = 'completed'
  )
);

DROP POLICY IF EXISTS "doc read auth" ON storage.objects;
DROP POLICY IF EXISTS "doc select auth" ON storage.objects;
DROP POLICY IF EXISTS "doc delete auth" ON storage.objects;
DROP POLICY IF EXISTS "doc insert auth" ON storage.objects;
DROP POLICY IF EXISTS "doc upload auth" ON storage.objects;

CREATE POLICY "doc insert own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = ANY (ARRAY['documents'::text, 'case-files'::text])
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "doc select scoped"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = ANY (ARRAY['documents'::text, 'case-files'::text])
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      bucket_id = 'case-files'
      AND EXISTS (
        SELECT 1 FROM public.cases c
        WHERE c.id::text = (storage.foldername(name))[2]
          AND (c.lawyer_id = auth.uid() OR c.client_id = auth.uid())
      )
    )
  )
);

CREATE POLICY "doc delete own folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = ANY (ARRAY['documents'::text, 'case-files'::text])
  AND (storage.foldername(name))[1] = auth.uid()::text
);
