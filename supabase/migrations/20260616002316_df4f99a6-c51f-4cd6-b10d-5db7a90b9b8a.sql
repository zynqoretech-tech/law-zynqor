
CREATE OR REPLACE FUNCTION public.check_plan_limit(p_resource TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_plan TEXT;
  v_count INT;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  SELECT plan INTO v_plan FROM public.profiles WHERE id = v_uid;
  IF v_plan IS NULL THEN v_plan := 'free'; END IF;

  IF p_resource = 'cases' THEN
    SELECT COUNT(*) INTO v_count FROM public.cases
    WHERE lawyer_id = v_uid AND status = 'active';
    IF v_plan = 'free' AND v_count >= 3 THEN RETURN false; END IF;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.check_plan_limit(UUID, TEXT) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.check_plan_limit(UUID, TEXT);
GRANT EXECUTE ON FUNCTION public.check_plan_limit(TEXT) TO authenticated;
