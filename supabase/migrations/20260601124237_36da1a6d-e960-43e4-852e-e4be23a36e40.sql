DROP POLICY IF EXISTS "read own profile" ON public.profiles;
DROP POLICY IF EXISTS "lawyer profiles public" ON public.profiles;

CREATE POLICY "profiles read" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR role = 'lawyer'
    OR EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.lawyer_id = auth.uid() AND c.client_id = profiles.id
    )
  );

CREATE POLICY "profiles anon lawyers" ON public.profiles
  FOR SELECT TO anon
  USING (role = 'lawyer');

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.lawyers TO anon;
GRANT SELECT ON public.reviews TO anon;