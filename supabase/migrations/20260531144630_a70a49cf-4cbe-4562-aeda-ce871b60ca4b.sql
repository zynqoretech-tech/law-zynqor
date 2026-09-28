
ALTER FUNCTION public.tg_set_updated_at() SET search_path = public, pg_catalog;
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] IS NOT NULL);
