
-- Enum-like via text + check
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('lawyer','client','admin')),
  full_name TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','basic','pro','office')),
  plan_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "lawyer profiles public" ON public.profiles FOR SELECT USING (role = 'lawyer');
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.lawyers (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  bar_number TEXT UNIQUE,
  bio TEXT,
  specializations TEXT[] DEFAULT '{}',
  experience_years INT DEFAULT 0,
  hourly_rate NUMERIC DEFAULT 0,
  consultation_price NUMERIC DEFAULT 0,
  consultation_price_online NUMERIC DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  reviews_count INT DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  available_online BOOLEAN DEFAULT true,
  available_office BOOLEAN DEFAULT true,
  firm_name TEXT,
  address TEXT,
  city TEXT,
  education TEXT,
  cases_won INT DEFAULT 0,
  total_cases INT DEFAULT 0,
  profile_completed BOOLEAN DEFAULT false,
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
  company_name TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client manage self" ON public.clients FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('criminal','civil','real_estate','commercial','family','administrative','labor','other')),
  court TEXT,
  court_department TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','pending','closed','won','lost')),
  lawyer_id UUID REFERENCES public.lawyers(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  facts TEXT,
  next_hearing DATE,
  total_fees NUMERIC DEFAULT 0,
  paid_fees NUMERIC DEFAULT 0,
  opposing_party TEXT,
  opposing_lawyer TEXT,
  judge TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lawyer own cases" ON public.cases FOR ALL TO authenticated USING (lawyer_id = auth.uid()) WITH CHECK (lawyer_id = auth.uid());
CREATE POLICY "client read own cases" ON public.cases FOR SELECT TO authenticated USING (client_id = auth.uid());

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

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  lawyer_id UUID REFERENCES public.lawyers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  paid_amount NUMERIC DEFAULT 0,
  tax_percent NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
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
CREATE POLICY "invoices client read" ON public.invoices FOR SELECT TO authenticated USING (client_id = auth.uid());

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
  type TEXT NOT NULL CHECK (type IN ('case_update','hearing_reminder','new_consultation','payment_received','system','ai_ready')),
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
CREATE POLICY "reviews public" ON public.reviews FOR SELECT USING (is_visible = true);
CREATE POLICY "reviews client write" ON public.reviews FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid());

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free','basic','pro','office')),
  status TEXT DEFAULT 'trial' CHECK (status IN ('active','cancelled','expired','trial')),
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly')),
  amount_paid NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub own read" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER cases_updated BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER consult_updated BEFORE UPDATE ON public.consultations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars','avatars', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('documents','documents', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('case-files','case-files', false) ON CONFLICT DO NOTHING;

CREATE POLICY "avatars public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatar upload self" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "doc upload auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('documents','case-files'));
CREATE POLICY "doc read auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id IN ('documents','case-files'));
