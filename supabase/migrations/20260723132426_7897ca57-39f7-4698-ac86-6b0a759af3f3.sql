
-- 1) Extend admin_set_user_plan to accept expires_at, features, notes
DROP FUNCTION IF EXISTS public.admin_set_user_plan(uuid, text);
CREATE OR REPLACE FUNCTION public.admin_set_user_plan(
  _user_id uuid,
  _plan text,
  _expires_at timestamptz DEFAULT NULL,
  _features jsonb DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles
     SET plan = _plan,
         plan_expires_at = _expires_at,
         features_override = COALESCE(_features, features_override)
   WHERE id = _user_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_user_plan(uuid,text,timestamptz,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_plan(uuid,text,timestamptz,jsonb,text) TO authenticated;

-- 2) Extend admin_set_lawyer_verification to accept notes (already exists w/o notes)
DROP FUNCTION IF EXISTS public.admin_set_lawyer_verification(uuid, boolean);
CREATE OR REPLACE FUNCTION public.admin_set_lawyer_verification(
  _lawyer_id uuid, _verified boolean, _notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.lawyers SET is_verified = _verified, verified = _verified WHERE id = _lawyer_id;
  UPDATE public.lawyer_verification_requests
     SET status = CASE WHEN _verified THEN 'approved' ELSE 'rejected' END,
         reviewed_at = now(),
         reviewer_notes = COALESCE(_notes, reviewer_notes)
   WHERE lawyer_id = _lawyer_id AND status = 'pending';
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_lawyer_verification(uuid,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_lawyer_verification(uuid,boolean,text) TO authenticated;

-- 3) Admin RPC to list users with email from auth.users
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id uuid, full_name text, role text, plan text,
  plan_expires_at timestamptz, features_override jsonb,
  phone text, email text, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.role, p.plan,
           p.plan_expires_at, p.features_override,
           p.phone, u.email::text, p.created_at
      FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.id
     ORDER BY p.created_at DESC
     LIMIT 1000;
END; $$;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
