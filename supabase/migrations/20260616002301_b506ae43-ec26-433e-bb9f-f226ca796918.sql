
-- 1) Audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT, SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_own_read" ON public.audit_logs;
CREATE POLICY "audit_own_read" ON public.audit_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "audit_own_insert" ON public.audit_logs;
CREATE POLICY "audit_own_insert" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_audit_user_time ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_table ON public.audit_logs(table_name, record_id);

-- 2) Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_cases_fts ON public.cases
  USING GIN(to_tsvector('simple',
    COALESCE(title,'') || ' ' || COALESCE(case_number,'') || ' ' || COALESCE(facts,'')
  ));

CREATE INDEX IF NOT EXISTS idx_lawyers_fts ON public.lawyers
  USING GIN(to_tsvector('simple',
    COALESCE(bio,'') || ' ' || COALESCE(firm_name,'')
  ));

-- 3) Plan limits enforcement helper
CREATE OR REPLACE FUNCTION public.check_plan_limit(p_user_id UUID, p_resource TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_plan TEXT;
  v_count INT;
BEGIN
  SELECT plan INTO v_plan FROM public.profiles WHERE id = p_user_id;

  IF v_plan IS NULL THEN
    v_plan := 'free';
  END IF;

  IF p_resource = 'cases' THEN
    SELECT COUNT(*) INTO v_count FROM public.cases
    WHERE lawyer_id = p_user_id AND status = 'active';
    IF v_plan = 'free' AND v_count >= 3 THEN RETURN false; END IF;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_plan_limit(UUID, TEXT) TO authenticated;
