-- FIX 3: helper RPC — is caller admin OR moderator?
CREATE OR REPLACE FUNCTION public.is_moderator_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'moderator');
$$;

GRANT EXECUTE ON FUNCTION public.is_moderator_or_admin() TO authenticated;
