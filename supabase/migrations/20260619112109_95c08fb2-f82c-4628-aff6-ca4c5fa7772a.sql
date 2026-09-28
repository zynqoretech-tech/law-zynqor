
REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate(UUID, INT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.purge_old_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_rate_limits() TO service_role;
