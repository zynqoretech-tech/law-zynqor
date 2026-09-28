
REVOKE EXECUTE ON FUNCTION public.tg_audit_log() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notify_hearing() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notify_deadline() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
