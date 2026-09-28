CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(9), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_link_codes TO authenticated;
GRANT ALL ON public.telegram_link_codes TO service_role;

ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own link code" ON public.telegram_link_codes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
