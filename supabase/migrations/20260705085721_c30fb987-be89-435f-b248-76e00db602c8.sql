
CREATE POLICY "verification-docs owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'verification-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "verification-docs owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'verification-docs'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin'))
  );

CREATE POLICY "verification-docs owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'verification-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "verification-docs owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'verification-docs'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin'))
  );
