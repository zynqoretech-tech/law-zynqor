
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS related_id text;

ALTER TABLE public.manual_clients ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'individual';
ALTER TABLE public.manual_clients ADD COLUMN IF NOT EXISTS company_name text;

ALTER TABLE public.engagement_requests ADD COLUMN IF NOT EXISTS case_type text;
ALTER TABLE public.engagement_requests ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.engagement_requests ADD COLUMN IF NOT EXISTS budget numeric;
ALTER TABLE public.engagement_requests ADD COLUMN IF NOT EXISTS lawyer_response text;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS manual_client_id uuid REFERENCES public.manual_clients(id) ON DELETE SET NULL;
