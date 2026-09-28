
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_audit_log() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_notify_hearing() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_notify_deadline() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_old_rate_limits() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate(uuid, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_plan_limit(text) FROM anon, PUBLIC;
