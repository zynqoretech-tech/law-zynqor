
CREATE TABLE public.engagement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT,
  case_type TEXT,
  budget NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  lawyer_response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.engagement_requests TO authenticated;
GRANT ALL ON public.engagement_requests TO service_role;

ALTER TABLE public.engagement_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients create their own requests"
  ON public.engagement_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "involved users can view requests"
  ON public.engagement_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = lawyer_id);

CREATE POLICY "lawyer updates targeted requests"
  ON public.engagement_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = lawyer_id)
  WITH CHECK (auth.uid() = lawyer_id);

CREATE POLICY "client cancels own request"
  ON public.engagement_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = client_id AND status = 'pending');

CREATE TRIGGER trg_engagement_requests_updated_at
  BEFORE UPDATE ON public.engagement_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_engagement_requests_lawyer ON public.engagement_requests(lawyer_id, status);
CREATE INDEX idx_engagement_requests_client ON public.engagement_requests(client_id, status);
