ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_reason text;

CREATE INDEX IF NOT EXISTS profiles_role_created_at_idx
  ON public.profiles (role, created_at DESC);
CREATE INDEX IF NOT EXISTS profiles_disabled_idx
  ON public.profiles (is_disabled, created_at DESC);
CREATE INDEX IF NOT EXISTS profiles_plan_expires_idx
  ON public.profiles (plan, plan_expires_at);

CREATE OR REPLACE FUNCTION public.tg_profiles_protect_privileged()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  is_admin boolean := false;
  is_service boolean := (auth.role() = 'service_role') OR (auth.uid() IS NULL);
BEGIN
  IF NOT is_service THEN
    is_admin := public.has_role(auth.uid(), 'admin');
  END IF;
  IF is_service OR is_admin THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'not allowed to change role' USING ERRCODE='42501';
  END IF;
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    RAISE EXCEPTION 'not allowed to change plan' USING ERRCODE='42501';
  END IF;
  IF NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at THEN
    RAISE EXCEPTION 'not allowed to change plan_expires_at' USING ERRCODE='42501';
  END IF;
  IF NEW.features_override IS DISTINCT FROM OLD.features_override THEN
    RAISE EXCEPTION 'not allowed to change features_override' USING ERRCODE='42501';
  END IF;
  IF NEW.is_disabled IS DISTINCT FROM OLD.is_disabled
     OR NEW.disabled_at IS DISTINCT FROM OLD.disabled_at
     OR NEW.disabled_reason IS DISTINCT FROM OLD.disabled_reason THEN
    RAISE EXCEPTION 'not allowed to change account status' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$function$;