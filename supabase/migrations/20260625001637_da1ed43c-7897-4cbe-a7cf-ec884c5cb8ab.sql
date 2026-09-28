
-- Roles system
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users see own roles" ON public.user_roles;
CREATE POLICY "users see own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

DROP POLICY IF EXISTS "admins see all roles" ON public.user_roles;
CREATE POLICY "admins see all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Seed admins from existing profiles.role='admin'
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM public.profiles WHERE role = 'admin'
ON CONFLICT DO NOTHING;

-- Features override on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS features_override jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Admin can view/update all profiles
DROP POLICY IF EXISTS "admins view all profiles" ON public.profiles;
CREATE POLICY "admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admins update all profiles" ON public.profiles;
CREATE POLICY "admins update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Admin manages subscriptions
DROP POLICY IF EXISTS "admins view all subs" ON public.subscriptions;
CREATE POLICY "admins view all subs" ON public.subscriptions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admins manage all subs" ON public.subscriptions;
CREATE POLICY "admins manage all subs" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Admin RPC: set/extend plan
CREATE OR REPLACE FUNCTION public.admin_set_user_plan(
  _user_id uuid,
  _plan text,
  _expires_at timestamptz,
  _features jsonb DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.profiles
    SET plan = _plan,
        plan_expires_at = _expires_at,
        features_override = COALESCE(_features, features_override),
        updated_at = now()
    WHERE id = _user_id;
  INSERT INTO public.subscriptions (user_id, plan, status, started_at, expires_at, notes)
  VALUES (_user_id, _plan, 'active', now(), _expires_at, _notes);
END $$;

REVOKE ALL ON FUNCTION public.admin_set_user_plan(uuid,text,timestamptz,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_plan(uuid,text,timestamptz,jsonb,text) TO authenticated;
