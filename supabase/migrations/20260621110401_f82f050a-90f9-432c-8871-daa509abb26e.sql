CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('lawyer','client','admin')),
  full_name TEXT NOT NULL,
  phone TEXT, location TEXT, avatar_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','basic','pro','office')),
  plan_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.lawyers (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  bar_number TEXT UNIQUE, bio TEXT,
  specializations TEXT[] DEFAULT '{}',
  experience_years INT DEFAULT 0, hourly_rate NUMERIC DEFAULT 0,
  consultation_price NUMERIC DEFAULT 0, consultation_price_online NUMERIC DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0, reviews_count INT DEFAULT 0,
  verified BOOLEAN DEFAULT false, available_online BOOLEAN DEFAULT true, available_office BOOLEAN DEFAULT true,
  firm_name TEXT, address TEXT, city TEXT, education TEXT,
  cases_won INT DEFAULT 0, total_cases INT DEFAULT 0, profile_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lawyers TO authenticated;
GRANT SELECT ON public.lawyers TO anon;
GRANT ALL ON public.lawyers TO service_role;
ALTER TABLE public.lawyers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lawyers public" ON public.lawyers FOR SELECT USING (true);
CREATE POLICY "lawyer manage self" ON public.lawyers FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.clients (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  national_id TEXT,
  client_type TEXT DEFAULT 'individual' CHECK (client_type IN ('individual','company')),
  company_name TEXT, address TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client manage self" ON public.clients FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT, title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('criminal','civil','real_estate','commercial','family','administrative','labor','other')),
  court TEXT, court_department TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','pending','closed','won','lost')),
  lawyer_id UUID REFERENCES public.lawyers(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  facts TEXT, next_hearing DATE,
  total_fees NUMERIC DEFAULT 0, paid_fees NUMERIC DEFAULT 0,
  opposing_party TEXT, opposing_lawyer TEXT, judge TEXT,
  notes_private TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lawyer own cases" ON public.cases FOR ALL TO authenticated USING (lawyer_id = auth.uid()) WITH CHECK (lawyer_id = auth.uid());
CREATE POLICY "client read own cases" ON public.cases FOR SELECT TO authenticated USING (client_id = auth.uid());

CREATE POLICY "profiles read" ON public.profiles FOR SELECT TO authenticated USING (
  auth.uid() = id OR role = 'lawyer'
  OR EXISTS (SELECT 1 FROM public.cases c WHERE c.lawyer_id = auth.uid() AND c.client_id = profiles.id)
);
CREATE POLICY "profiles anon lawyers" ON public.profiles FOR SELECT TO anon USING (role = 'lawyer');
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.hearings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  hearing_date TIMESTAMPTZ NOT NULL,
  court TEXT, judge TEXT, result TEXT, decision TEXT, notes TEXT,
  next_hearing_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hearings TO authenticated;
GRANT ALL ON public.hearings TO service_role;
ALTER TABLE public.hearings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hearings via case" ON public.hearings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = hearings.case_id AND c.lawyer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = hearings.case_id AND c.lawyer_id = auth.uid()));

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'other' CHECK (type IN ('contract','case_document','personal','template','invoice','other')),
  file_url TEXT NOT NULL,
  file_size BIGINT, mime_type TEXT,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_analyzed BOOLEAN DEFAULT false,
  folder TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs own" ON public.documents FOR ALL TO authenticated USING (uploaded_by = auth.uid()) WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "docs client read" ON public.documents FOR SELECT TO authenticated USING (client_id = auth.uid());
CREATE POLICY "lawyers read assigned case documents" ON public.documents FOR SELECT TO authenticated
  USING (case_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = documents.case_id AND c.lawyer_id = auth.uid()));

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  lawyer_id UUID REFERENCES public.lawyers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL, paid_amount NUMERIC DEFAULT 0,
  tax_percent NUMERIC DEFAULT 0, tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft','pending','partial','paid','overdue','cancelled')),
  due_date DATE, notes TEXT, line_items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices lawyer" ON public.invoices FOR ALL TO authenticated USING (lawyer_id = auth.uid()) WITH CHECK (lawyer_id = auth.uid());
CREATE POLICY "clients see own invoices" ON public.invoices FOR SELECT TO authenticated USING (client_id = auth.uid());

CREATE TABLE public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID REFERENCES public.lawyers(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('online','office')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 30,
  price NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled','no_show')),
  notes TEXT, client_notes TEXT,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  review TEXT, meeting_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultations TO authenticated;
GRANT ALL ON public.consultations TO service_role;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consult lawyer" ON public.consultations FOR ALL TO authenticated USING (lawyer_id = auth.uid()) WITH CHECK (lawyer_id = auth.uid());
CREATE POLICY "consult client" ON public.consultations FOR ALL TO authenticated USING (client_id = auth.uid()) WITH CHECK (client_id = auth.uid());

CREATE TABLE public.ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('contract_review','legal_qa','draft','summary','research')),
  input_text TEXT, result JSONB,
  risk_score INT CHECK (risk_score BETWEEN 0 AND 100),
  tokens_used INT, model_used TEXT DEFAULT 'gemini-2.0-flash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_analyses TO authenticated;
GRANT ALL ON public.ai_analyses TO service_role;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai own" ON public.ai_analyses FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL, body TEXT,
  type TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  related_id UUID, related_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif own" ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID REFERENCES public.lawyers(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT, is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lawyer_id, client_id, consultation_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews public read" ON public.reviews FOR SELECT USING (is_visible = true);
CREATE POLICY "reviews client write" ON public.reviews FOR INSERT TO authenticated
WITH CHECK (
  client_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.consultations c
    WHERE c.id = reviews.consultation_id AND c.client_id = auth.uid()
      AND c.lawyer_id = reviews.lawyer_id AND c.status = 'completed')
);

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free','basic','pro','office')),
  status TEXT DEFAULT 'trial' CHECK (status IN ('active','cancelled','expired','trial')),
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly')),
  amount_paid NUMERIC DEFAULT 0, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub own read" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "lawyers read assigned clients" ON public.clients FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.client_id = clients.id AND c.lawyer_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER cases_updated BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER consult_updated BEFORE UPDATE ON public.consultations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_lawyers_rating ON public.lawyers(rating DESC);
CREATE INDEX IF NOT EXISTS idx_lawyers_specializations ON public.lawyers USING gin(specializations);
CREATE INDEX IF NOT EXISTS idx_cases_lawyer_status ON public.cases(lawyer_id, status);
CREATE INDEX IF NOT EXISTS idx_hearings_case_date ON public.hearings(case_id, hearing_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_documents_case ON public.documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents(uploaded_by, client_id);
CREATE INDEX IF NOT EXISTS idx_hearings_date_range ON public.hearings(hearing_date, case_id);
CREATE INDEX IF NOT EXISTS idx_consultations_lawyer_date ON public.consultations(lawyer_id, scheduled_at);

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
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_own_read" ON public.audit_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
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

CREATE OR REPLACE FUNCTION public.tg_audit_log()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_action text; v_rec_id uuid; v_old jsonb; v_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created'; v_rec_id := NEW.id; v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated'; v_rec_id := NEW.id;
    v_old := to_jsonb(OLD); v_new := to_jsonb(NEW);
    IF v_old = v_new THEN RETURN NEW; END IF;
  ELSE
    v_action := 'deleted'; v_rec_id := OLD.id; v_old := to_jsonb(OLD);
  END IF;
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (v_uid, v_action, TG_TABLE_NAME, v_rec_id, v_old, v_new);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_cases AFTER INSERT OR UPDATE OR DELETE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();
CREATE TRIGGER audit_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();
CREATE TRIGGER audit_time_entries AFTER INSERT OR UPDATE OR DELETE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();
CREATE TRIGGER audit_case_expenses AFTER INSERT OR UPDATE OR DELETE ON public.case_expenses FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();

REVOKE EXECUTE ON FUNCTION public.tg_audit_log() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  user_id UUID NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', now()),
  request_count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, window_start)
);
GRANT SELECT ON public.api_rate_limits TO authenticated;
GRANT ALL ON public.api_rate_limits TO service_role;
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_limits_own_read" ON public.api_rate_limits FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.legal_statutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  law_number TEXT NOT NULL,
  law_year INT NOT NULL,
  law_name TEXT NOT NULL,
  article_number TEXT NOT NULL,
  article_text TEXT NOT NULL,
  topic_tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT ON public.legal_statutes TO anon, authenticated;
GRANT ALL ON public.legal_statutes TO service_role;
ALTER TABLE public.legal_statutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "statutes public read" ON public.legal_statutes FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_statutes_fts ON public.legal_statutes
USING GIN(to_tsvector('simple', COALESCE(article_text,'') || ' ' || COALESCE(law_name,'')));
CREATE INDEX IF NOT EXISTS idx_statutes_tags ON public.legal_statutes USING GIN(topic_tags);
CREATE UNIQUE INDEX IF NOT EXISTS uq_statutes_article ON public.legal_statutes(law_number, law_year, article_number);