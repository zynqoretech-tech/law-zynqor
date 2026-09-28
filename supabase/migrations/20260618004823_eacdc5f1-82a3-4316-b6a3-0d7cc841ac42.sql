
-- Generic audit trigger function
CREATE OR REPLACE FUNCTION public.tg_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_action text;
  v_rec_id uuid;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_rec_id := NEW.id;
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated';
    v_rec_id := NEW.id;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    -- skip noop updates
    IF v_old = v_new THEN
      RETURN NEW;
    END IF;
  ELSE
    v_action := 'deleted';
    v_rec_id := OLD.id;
    v_old := to_jsonb(OLD);
  END IF;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (v_uid, v_action, TG_TABLE_NAME, v_rec_id, v_old, v_new);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_cases ON public.cases;
CREATE TRIGGER audit_cases
AFTER INSERT OR UPDATE OR DELETE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();

DROP TRIGGER IF EXISTS audit_invoices ON public.invoices;
CREATE TRIGGER audit_invoices
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();

DROP TRIGGER IF EXISTS audit_time_entries ON public.time_entries;
CREATE TRIGGER audit_time_entries
AFTER INSERT OR UPDATE OR DELETE ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();

DROP TRIGGER IF EXISTS audit_case_expenses ON public.case_expenses;
CREATE TRIGGER audit_case_expenses
AFTER INSERT OR UPDATE OR DELETE ON public.case_expenses
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();

-- Notification trigger for new hearings
CREATE OR REPLACE FUNCTION public.tg_notify_hearing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_lawyer uuid;
  v_title text;
BEGIN
  SELECT lawyer_id, title INTO v_lawyer, v_title FROM public.cases WHERE id = NEW.case_id;
  IF v_lawyer IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (
    v_lawyer,
    'جلسة جديدة',
    'أُضيفت جلسة جديدة للقضية: ' || COALESCE(v_title, '—') || ' في ' || to_char(NEW.hearing_date, 'YYYY-MM-DD'),
    'hearing'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_hearing ON public.hearings;
CREATE TRIGGER notify_new_hearing
AFTER INSERT ON public.hearings
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_hearing();

-- Notification trigger for new deadlines
CREATE OR REPLACE FUNCTION public.tg_notify_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_lawyer uuid;
BEGIN
  IF NEW.case_id IS NOT NULL THEN
    SELECT lawyer_id INTO v_lawyer FROM public.cases WHERE id = NEW.case_id;
  END IF;
  IF v_lawyer IS NULL THEN v_lawyer := NEW.user_id; END IF;
  IF v_lawyer IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (
    v_lawyer,
    'موعد قانوني جديد',
    COALESCE(NEW.title, 'موعد') || ' — ' || to_char(NEW.due_date, 'YYYY-MM-DD'),
    'deadline'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_deadline ON public.deadlines;
CREATE TRIGGER notify_new_deadline
AFTER INSERT ON public.deadlines
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_deadline();
