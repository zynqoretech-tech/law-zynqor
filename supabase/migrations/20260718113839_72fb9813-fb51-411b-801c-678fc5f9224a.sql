
REVOKE EXECUTE ON FUNCTION public.tg_profiles_protect_privileged() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_lawyers_protect_trust() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_enforce_case_plan_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_consultations_status_guard() FROM PUBLIC, anon, authenticated;
