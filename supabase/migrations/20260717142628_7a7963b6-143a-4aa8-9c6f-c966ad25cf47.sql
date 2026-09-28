
-- Rename RPC params to match app code (uses _role, _user_id, _lawyer_id)
DROP FUNCTION IF EXISTS public.complete_signup(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.complete_signup(_role TEXT, _full_name TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.profiles(id, full_name, role) VALUES (v_uid, _full_name, _role)
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role,
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
  IF _role = 'lawyer' THEN
    INSERT INTO public.lawyers(id) VALUES (v_uid) ON CONFLICT DO NOTHING;
  ELSIF _role = 'client' THEN
    INSERT INTO public.clients(id) VALUES (v_uid) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (v_uid, _role::public.app_role)
    ON CONFLICT DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.complete_signup(TEXT, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.activate_subscription_from_payment(UUID);
CREATE OR REPLACE FUNCTION public.activate_subscription_from_payment(_user_id UUID, _plan TEXT DEFAULT 'pro')
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.profiles SET plan = _plan WHERE id = _user_id;
  INSERT INTO public.subscriptions(user_id, plan, status, started_at, expires_at)
    VALUES (_user_id, _plan, 'active', now(), now() + INTERVAL '30 days')
    ON CONFLICT (user_id) DO UPDATE SET plan = EXCLUDED.plan, status = 'active',
      started_at = now(), expires_at = now() + INTERVAL '30 days';
END;
$$;
GRANT EXECUTE ON FUNCTION public.activate_subscription_from_payment(UUID, TEXT) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.admin_set_user_plan(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.admin_set_user_plan(_user_id UUID, _plan TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET plan = _plan WHERE id = _user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_user_plan(UUID, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_set_lawyer_verification(UUID, BOOLEAN);
CREATE OR REPLACE FUNCTION public.admin_set_lawyer_verification(_lawyer_id UUID, _verified BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.lawyers SET is_verified = _verified, verified = _verified WHERE id = _lawyer_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_lawyer_verification(UUID, BOOLEAN) TO authenticated;

-- Engagement requests between clients and lawyers
CREATE TABLE IF NOT EXISTS public.engagement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','cancelled')),
  response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.engagement_requests TO authenticated;
GRANT ALL ON public.engagement_requests TO service_role;
ALTER TABLE public.engagement_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "er_client_all" ON public.engagement_requests;
CREATE POLICY "er_client_all" ON public.engagement_requests FOR ALL TO authenticated
  USING (client_id = auth.uid()) WITH CHECK (client_id = auth.uid());
DROP POLICY IF EXISTS "er_lawyer_read" ON public.engagement_requests;
CREATE POLICY "er_lawyer_read" ON public.engagement_requests FOR SELECT TO authenticated USING (lawyer_id = auth.uid());
DROP POLICY IF EXISTS "er_lawyer_update" ON public.engagement_requests;
CREATE POLICY "er_lawyer_update" ON public.engagement_requests FOR UPDATE TO authenticated
  USING (lawyer_id = auth.uid()) WITH CHECK (lawyer_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_er_lawyer ON public.engagement_requests(lawyer_id, status);
CREATE INDEX IF NOT EXISTS idx_er_client ON public.engagement_requests(client_id, status);

-- Extend clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_type TEXT DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Extend cases with manual_client_id
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS manual_client_id UUID REFERENCES public.manual_clients(id) ON DELETE SET NULL;

-- Extend lawyer_verification_requests
ALTER TABLE public.lawyer_verification_requests
  ADD COLUMN IF NOT EXISTS bar_document_url TEXT,
  ADD COLUMN IF NOT EXISTS id_document_url TEXT,
  ADD COLUMN IF NOT EXISTS bar_number TEXT;

-- Extend lawyers
ALTER TABLE public.lawyers
  ADD COLUMN IF NOT EXISTS requires_deposit BOOLEAN DEFAULT false;
