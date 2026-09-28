
-- Enum for roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','moderator','user','lawyer','client');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles_self_read" ON public.user_roles;
CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EGP',
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT,
  provider_ref TEXT,
  purpose TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  error JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_owner_all" ON public.payments;
CREATE POLICY "payments_owner_all" ON public.payments FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Lawyer verification requests
CREATE TABLE IF NOT EXISTS public.lawyer_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  documents JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.lawyer_verification_requests TO authenticated;
GRANT ALL ON public.lawyer_verification_requests TO service_role;
ALTER TABLE public.lawyer_verification_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lvr_owner_all" ON public.lawyer_verification_requests;
CREATE POLICY "lvr_owner_all" ON public.lawyer_verification_requests FOR ALL TO authenticated
  USING (lawyer_id = auth.uid()) WITH CHECK (lawyer_id = auth.uid());
DROP POLICY IF EXISTS "lvr_admin_all" ON public.lawyer_verification_requests;
CREATE POLICY "lvr_admin_all" ON public.lawyer_verification_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Manual clients (offline / walk-in)
CREATE TABLE IF NOT EXISTS public.manual_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  platform_user_id UUID REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  national_id TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_clients TO authenticated;
GRANT ALL ON public.manual_clients TO service_role;
ALTER TABLE public.manual_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "manual_clients_owner_all" ON public.manual_clients;
CREATE POLICY "manual_clients_owner_all" ON public.manual_clients FOR ALL TO authenticated
  USING (lawyer_id = auth.uid()) WITH CHECK (lawyer_id = auth.uid());

-- Additional columns on existing tables
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS features_override JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';

ALTER TABLE public.ai_analyses
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'unpaid';

-- RPCs used by app code
CREATE OR REPLACE FUNCTION public.complete_signup(p_role TEXT, p_full_name TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.profiles(id, full_name, role) VALUES (v_uid, p_full_name, p_role)
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role,
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
  IF p_role = 'lawyer' THEN
    INSERT INTO public.lawyers(id) VALUES (v_uid) ON CONFLICT DO NOTHING;
  ELSIF p_role = 'client' THEN
    INSERT INTO public.clients(id) VALUES (v_uid) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (v_uid, p_role::public.app_role)
    ON CONFLICT DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.complete_signup(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.activate_subscription_from_payment(p_payment_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_user UUID; v_plan TEXT;
BEGIN
  SELECT user_id, COALESCE(metadata->>'plan','pro') INTO v_user, v_plan
    FROM public.payments WHERE id = p_payment_id AND status = 'succeeded';
  IF v_user IS NULL THEN RETURN; END IF;
  UPDATE public.profiles SET plan = v_plan WHERE id = v_user;
  INSERT INTO public.subscriptions(user_id, plan, status, started_at, expires_at)
    VALUES (v_user, v_plan, 'active', now(), now() + INTERVAL '30 days')
    ON CONFLICT (user_id) DO UPDATE SET plan = EXCLUDED.plan, status = 'active',
      started_at = now(), expires_at = now() + INTERVAL '30 days';
END;
$$;
GRANT EXECUTE ON FUNCTION public.activate_subscription_from_payment(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_user_plan(p_user UUID, p_plan TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET plan = p_plan WHERE id = p_user;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_user_plan(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_lawyer_verification(p_lawyer UUID, p_verified BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.lawyers SET is_verified = p_verified WHERE id = p_lawyer;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_lawyer_verification(UUID, BOOLEAN) TO authenticated;

-- Subscriptions unique constraint for upsert
DO $$ BEGIN
  ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;
