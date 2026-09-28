REVOKE EXECUTE ON FUNCTION public.check_plan_limit(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_plan_limit(TEXT) TO service_role;