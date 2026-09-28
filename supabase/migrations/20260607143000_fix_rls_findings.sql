-- Lawyers can read client records for their assigned cases
CREATE POLICY "lawyers read assigned clients"
ON public.clients FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.client_id = clients.id AND c.lawyer_id = auth.uid()));

-- Lawyers can read documents for their assigned cases
CREATE POLICY "lawyers read assigned case documents"
ON public.documents FOR SELECT TO authenticated
USING (case_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = documents.case_id AND c.lawyer_id = auth.uid()));

-- Clients can read hearings for their own cases
CREATE POLICY "clients read own case hearings"
ON public.hearings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = hearings.case_id AND c.client_id = auth.uid()));

-- Remove duplicate invoice SELECT policy
DROP POLICY IF EXISTS "clients see own invoices" ON public.invoices;
