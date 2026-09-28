-- 1. manual_clients: invite/link columns
ALTER TABLE public.manual_clients
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS platform_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_manual_clients_platform_user
  ON public.manual_clients(platform_user_id)
  WHERE platform_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_manual_clients_email
  ON public.manual_clients(lower(email))
  WHERE email IS NOT NULL;

-- 2. invoices: manual_client_id
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS manual_client_id UUID
    REFERENCES public.manual_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_manual_client
  ON public.invoices(manual_client_id)
  WHERE manual_client_id IS NOT NULL;

-- 3. RLS: clients see own invoices (direct + manual)
DROP POLICY IF EXISTS "clients see own invoices" ON public.invoices;
CREATE POLICY "clients see own invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    OR lawyer_id = auth.uid()
    OR manual_client_id IN (
      SELECT id FROM public.manual_clients
      WHERE platform_user_id = auth.uid()
    )
  );

-- 4. RLS: clients see own cases (direct + manual + lawyer)
DROP POLICY IF EXISTS "clients see own cases" ON public.cases;
CREATE POLICY "clients see own cases"
  ON public.cases FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    OR lawyer_id = auth.uid()
    OR manual_client_id IN (
      SELECT id FROM public.manual_clients
      WHERE platform_user_id = auth.uid()
    )
  );

-- 5. RLS: clients see case documents
DROP POLICY IF EXISTS "clients see case docs" ON public.documents;
CREATE POLICY "clients see case docs"
  ON public.documents FOR SELECT TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR client_id = auth.uid()
    OR case_id IN (
      SELECT id FROM public.cases
      WHERE client_id = auth.uid()
        OR lawyer_id = auth.uid()
        OR manual_client_id IN (
          SELECT id FROM public.manual_clients
          WHERE platform_user_id = auth.uid()
        )
    )
  );

-- 6. Allow authenticated users to claim a manual_client record via invite link
-- (set platform_user_id to their own uid when it's currently NULL)
DROP POLICY IF EXISTS "users claim manual client via invite" ON public.manual_clients;
CREATE POLICY "users claim manual client via invite"
  ON public.manual_clients FOR UPDATE TO authenticated
  USING (platform_user_id IS NULL OR platform_user_id = auth.uid())
  WITH CHECK (platform_user_id = auth.uid() OR lawyer_id = auth.uid());

-- 7. Allow a claimed manual_client owner to read their own row
DROP POLICY IF EXISTS "manual client owner reads self" ON public.manual_clients;
CREATE POLICY "manual client owner reads self"
  ON public.manual_clients FOR SELECT TO authenticated
  USING (lawyer_id = auth.uid() OR platform_user_id = auth.uid());