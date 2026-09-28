CREATE POLICY "avatars read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatar upload self" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatar update self" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "doc insert own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = ANY (ARRAY['documents','case-files']) AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "doc select scoped" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = ANY (ARRAY['documents','case-files']) AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (bucket_id = 'case-files' AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id::text = (storage.foldername(name))[2]
        AND (c.lawyer_id = auth.uid() OR c.client_id = auth.uid())
    ))
  ));
CREATE POLICY "doc delete own folder" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = ANY (ARRAY['documents','case-files']) AND (storage.foldername(name))[1] = auth.uid()::text);