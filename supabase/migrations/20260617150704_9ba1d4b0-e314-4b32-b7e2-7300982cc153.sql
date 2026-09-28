CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, description TEXT,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  lawyer_id UUID NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  due_date DATE, is_billable BOOLEAN NOT NULL DEFAULT false,
  estimated_hours NUMERIC NOT NULL DEFAULT 0, actual_hours NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_owner_all" ON public.tasks FOR ALL TO authenticated USING (auth.uid() = lawyer_id) WITH CHECK (auth.uid() = lawyer_id);
CREATE POLICY "tasks_assignee_select" ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = assigned_to);
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX IF NOT EXISTS idx_tasks_lawyer ON public.tasks(lawyer_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_case ON public.tasks(case_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON public.tasks(due_date, status);

CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  started_at TIMESTAMPTZ, ended_at TIMESTAMPTZ,
  duration_minutes INT NOT NULL DEFAULT 0,
  is_billable BOOLEAN NOT NULL DEFAULT true,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  billed_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','billed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "time_entries_owner_all" ON public.time_entries FOR ALL TO authenticated USING (auth.uid() = lawyer_id) WITH CHECK (auth.uid() = lawyer_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_lawyer ON public.time_entries(lawyer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_time_entries_case ON public.time_entries(case_id);

CREATE TABLE IF NOT EXISTS public.case_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('court_fees','stamps','travel','expert','translation','registration','notary','other')),
  description TEXT NOT NULL, amount NUMERIC NOT NULL,
  paid_at DATE, receipt_url TEXT,
  is_billable BOOLEAN NOT NULL DEFAULT true,
  is_reimbursed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_expenses TO authenticated;
GRANT ALL ON public.case_expenses TO service_role;
ALTER TABLE public.case_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "case_expenses_owner_all" ON public.case_expenses FOR ALL TO authenticated USING (auth.uid() = lawyer_id) WITH CHECK (auth.uid() = lawyer_id);
CREATE INDEX IF NOT EXISTS idx_case_expenses_case ON public.case_expenses(case_id);

CREATE TABLE IF NOT EXISTS public.deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('appeal','cassation','execution_objection','limitation','admin_appeal','reply','other')),
  title TEXT NOT NULL, trigger_date DATE NOT NULL,
  deadline_days INT NOT NULL, due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','expired','waived')),
  alert_days_before INT NOT NULL DEFAULT 7, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deadlines TO authenticated;
GRANT ALL ON public.deadlines TO service_role;
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deadlines_owner_all" ON public.deadlines FOR ALL TO authenticated USING (auth.uid() = lawyer_id) WITH CHECK (auth.uid() = lawyer_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_lawyer_due ON public.deadlines(lawyer_id, due_date);

CREATE TABLE IF NOT EXISTS public.contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('lease','employment','sale','service','partnership','loan','poa','other')),
  content TEXT NOT NULL, variables JSONB NOT NULL DEFAULT '[]',
  is_shared BOOLEAN NOT NULL DEFAULT false, usage_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_templates TO authenticated;
GRANT ALL ON public.contract_templates TO service_role;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_owner_all" ON public.contract_templates FOR ALL TO authenticated USING (auth.uid() = lawyer_id) WITH CHECK (auth.uid() = lawyer_id);
CREATE POLICY "templates_shared_select" ON public.contract_templates FOR SELECT TO authenticated USING (is_shared = true);
CREATE TRIGGER templates_updated_at BEFORE UPDATE ON public.contract_templates FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_lawyer_id UUID NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  member_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'associate' CHECK (role IN ('senior_lawyer','associate','paralegal','secretary','admin')),
  permissions JSONB NOT NULL DEFAULT '{}',
  can_view_all_cases BOOLEAN NOT NULL DEFAULT false,
  can_edit_cases BOOLEAN NOT NULL DEFAULT false,
  can_view_billing BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(office_lawyer_id, member_profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_owner_all" ON public.team_members FOR ALL TO authenticated USING (auth.uid() = office_lawyer_id) WITH CHECK (auth.uid() = office_lawyer_id);
CREATE POLICY "team_member_select_self" ON public.team_members FOR SELECT TO authenticated USING (auth.uid() = member_profile_id);

CREATE TABLE IF NOT EXISTS public.legal_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  title TEXT NOT NULL, query TEXT NOT NULL, result TEXT,
  sources JSONB NOT NULL DEFAULT '[]',
  type TEXT NOT NULL DEFAULT 'statute' CHECK (type IN ('statute','precedent','doctrine','procedure','other')),
  is_saved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_research TO authenticated;
GRANT ALL ON public.legal_research TO service_role;
ALTER TABLE public.legal_research ENABLE ROW LEVEL SECURITY;
CREATE POLICY "research_owner_all" ON public.legal_research FOR ALL TO authenticated USING (auth.uid() = lawyer_id) WITH CHECK (auth.uid() = lawyer_id);
CREATE INDEX IF NOT EXISTS idx_legal_research_lawyer ON public.legal_research(lawyer_id, created_at);

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS stage TEXT CHECK (stage IN ('intake','investigation','filing','first_hearing','evidence','pleadings','judgment','appeal','cassation','execution','closed')) DEFAULT 'intake',
  ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('low','medium','high','urgent')) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS case_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS success_fee_percent NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS power_of_attorney_date DATE,
  ADD COLUMN IF NOT EXISTS power_of_attorney_expires DATE;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL, table_name TEXT NOT NULL,
  record_id UUID, old_data JSONB, new_data JSONB, ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT, SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_own_read" ON public.audit_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "audit_own_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_audit_user_time ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_table ON public.audit_logs(table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_cases_fts ON public.cases USING GIN(to_tsvector('simple', COALESCE(title,'') || ' ' || COALESCE(case_number,'') || ' ' || COALESCE(facts,'')));
CREATE INDEX IF NOT EXISTS idx_lawyers_fts ON public.lawyers USING GIN(to_tsvector('simple', COALESCE(bio,'') || ' ' || COALESCE(firm_name,'')));

CREATE OR REPLACE FUNCTION public.check_plan_limit(p_resource TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog AS $$
DECLARE v_uid UUID := auth.uid(); v_plan TEXT; v_count INT;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  SELECT plan INTO v_plan FROM public.profiles WHERE id = v_uid;
  IF v_plan IS NULL THEN v_plan := 'free'; END IF;
  IF p_resource = 'cases' THEN
    SELECT COUNT(*) INTO v_count FROM public.cases WHERE lawyer_id = v_uid AND status = 'active';
    IF v_plan = 'free' AND v_count >= 3 THEN RETURN false; END IF;
  END IF;
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.check_plan_limit(TEXT) TO authenticated;