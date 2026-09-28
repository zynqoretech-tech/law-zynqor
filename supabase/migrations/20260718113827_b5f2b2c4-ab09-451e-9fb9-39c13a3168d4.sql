
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS features_override jsonb;

CREATE OR REPLACE FUNCTION public.tg_profiles_protect_privileged()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE is_admin boolean := false; is_service boolean := (auth.role() = 'service_role') OR (auth.uid() IS NULL);
BEGIN
  IF NOT is_service THEN is_admin := public.has_role(auth.uid(), 'admin'); END IF;
  IF is_service OR is_admin THEN RETURN NEW; END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN RAISE EXCEPTION 'not allowed to change role' USING ERRCODE='42501'; END IF;
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN RAISE EXCEPTION 'not allowed to change plan' USING ERRCODE='42501'; END IF;
  IF NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at THEN RAISE EXCEPTION 'not allowed to change plan_expires_at' USING ERRCODE='42501'; END IF;
  IF NEW.features_override IS DISTINCT FROM OLD.features_override THEN RAISE EXCEPTION 'not allowed to change features_override' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS tg_profiles_protect_privileged ON public.profiles;
CREATE TRIGGER tg_profiles_protect_privileged BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_protect_privileged();

CREATE OR REPLACE FUNCTION public.tg_lawyers_protect_trust()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE is_admin boolean := false; is_service boolean := (auth.role() = 'service_role') OR (auth.uid() IS NULL);
BEGIN
  IF NOT is_service THEN is_admin := public.has_role(auth.uid(), 'admin'); END IF;
  IF is_service OR is_admin THEN RETURN NEW; END IF;
  IF COALESCE(NEW.verified,false) IS DISTINCT FROM COALESCE(OLD.verified,false) THEN
    RAISE EXCEPTION 'only admin can change verification status' USING ERRCODE='42501';
  END IF;
  IF NEW.bar_number IS DISTINCT FROM OLD.bar_number THEN NEW.verified := false; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS tg_lawyers_protect_trust ON public.lawyers;
CREATE TRIGGER tg_lawyers_protect_trust BEFORE UPDATE ON public.lawyers
FOR EACH ROW EXECUTE FUNCTION public.tg_lawyers_protect_trust();

DROP POLICY IF EXISTS "manual_clients_claim_by_email" ON public.manual_clients;
CREATE POLICY "manual_clients_claim_by_email" ON public.manual_clients
FOR UPDATE TO authenticated
USING (
  platform_user_id IS NULL AND email IS NOT NULL
  AND lower(email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))
)
WITH CHECK (
  platform_user_id = auth.uid() AND email IS NOT NULL
  AND lower(email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))
);

DROP POLICY IF EXISTS "doc upload auth" ON storage.objects;
DROP POLICY IF EXISTS "doc read auth" ON storage.objects;
DROP POLICY IF EXISTS "documents_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "case_files_lawyer_insert" ON storage.objects;
DROP POLICY IF EXISTS "case_files_access_select" ON storage.objects;
DROP POLICY IF EXISTS "case_files_lawyer_delete" ON storage.objects;
DROP POLICY IF EXISTS "verif_docs_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "verif_docs_read" ON storage.objects;
DROP POLICY IF EXISTS "verif_docs_owner_delete" ON storage.objects;

CREATE POLICY "documents_owner_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "documents_owner_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "documents_owner_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "case_files_lawyer_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='case-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "case_files_access_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id='case-files' AND EXISTS (
    SELECT 1 FROM public.cases c
    LEFT JOIN public.manual_clients mc ON mc.id = c.manual_client_id
    WHERE c.id::text = (storage.foldername(name))[2]
      AND (c.lawyer_id = auth.uid() OR c.client_id = auth.uid() OR mc.platform_user_id = auth.uid())
  )
);
CREATE POLICY "case_files_lawyer_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id='case-files' AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id::text = (storage.foldername(name))[2] AND c.lawyer_id = auth.uid()
  )
);

CREATE POLICY "verif_docs_owner_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "verif_docs_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id='verification-docs'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin'))
);
CREATE POLICY "verif_docs_owner_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.tg_enforce_case_plan_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_plan text; v_count int;
BEGIN
  IF auth.role()='service_role' OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.lawyer_id IS NULL THEN RETURN NEW; END IF;
  SELECT plan INTO v_plan FROM public.profiles WHERE id = NEW.lawyer_id;
  IF v_plan IS NULL OR v_plan='free' THEN
    SELECT COUNT(*) INTO v_count FROM public.cases
      WHERE lawyer_id = NEW.lawyer_id AND COALESCE(status,'active')='active' AND deleted_at IS NULL;
    IF v_count >= 3 THEN
      RAISE EXCEPTION 'plan limit reached: free plan allows only 3 active cases. Upgrade to Pro.' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS tg_enforce_case_plan_limit ON public.cases;
CREATE TRIGGER tg_enforce_case_plan_limit BEFORE INSERT ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_case_plan_limit();

CREATE OR REPLACE FUNCTION public.tg_consultations_status_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
  IF auth.role()='service_role' OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status='completed'
     AND auth.uid() = OLD.client_id AND auth.uid() <> OLD.lawyer_id
     AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'only the lawyer or admin can mark consultation completed' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS tg_consultations_status_guard ON public.consultations;
CREATE TRIGGER tg_consultations_status_guard BEFORE UPDATE ON public.consultations
FOR EACH ROW EXECUTE FUNCTION public.tg_consultations_status_guard();

DROP POLICY IF EXISTS "clients_read_case_hearings" ON public.hearings;
CREATE POLICY "clients_read_case_hearings" ON public.hearings FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cases c
    LEFT JOIN public.manual_clients mc ON mc.id = c.manual_client_id
    WHERE c.id = hearings.case_id
      AND (c.lawyer_id=auth.uid() OR c.client_id=auth.uid() OR mc.platform_user_id=auth.uid())
  )
);

DROP POLICY IF EXISTS "team_edit_cases" ON public.cases;
CREATE POLICY "team_edit_cases" ON public.cases FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.team_members tm
    WHERE tm.office_lawyer_id = cases.lawyer_id
      AND tm.member_profile_id = auth.uid()
      AND COALESCE(tm.is_active,true) = true
      AND COALESCE(tm.can_edit_cases,false) = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.team_members tm
    WHERE tm.office_lawyer_id = cases.lawyer_id
      AND tm.member_profile_id = auth.uid()
      AND COALESCE(tm.is_active,true) = true
      AND COALESCE(tm.can_edit_cases,false) = true)
);

DROP POLICY IF EXISTS "team_view_billing" ON public.invoices;
CREATE POLICY "team_view_billing" ON public.invoices FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.team_members tm
    WHERE tm.office_lawyer_id = invoices.lawyer_id
      AND tm.member_profile_id = auth.uid()
      AND COALESCE(tm.is_active,true) = true
      AND COALESCE(tm.can_view_billing,false) = true)
);
