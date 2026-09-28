
CREATE TABLE public.manual_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lawyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  email text,
  national_id text,
  address text,
  client_type text NOT NULL DEFAULT 'individual' CHECK (client_type IN ('individual','company')),
  company_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_clients TO authenticated;
GRANT ALL ON public.manual_clients TO service_role;

ALTER TABLE public.manual_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lawyer manage own manual clients" ON public.manual_clients
  FOR ALL TO authenticated
  USING (lawyer_id = auth.uid())
  WITH CHECK (lawyer_id = auth.uid());

CREATE INDEX idx_manual_clients_lawyer ON public.manual_clients(lawyer_id);

CREATE TRIGGER trg_manual_clients_updated_at
  BEFORE UPDATE ON public.manual_clients
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS manual_client_id uuid REFERENCES public.manual_clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cases_manual_client ON public.cases(manual_client_id);
