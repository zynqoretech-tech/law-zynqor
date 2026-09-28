
-- Backfill missing lawyers/clients rows for existing profiles
INSERT INTO public.lawyers(id)
SELECT p.id FROM public.profiles p
WHERE p.role = 'lawyer' AND NOT EXISTS(SELECT 1 FROM public.lawyers l WHERE l.id = p.id)
ON CONFLICT DO NOTHING;

INSERT INTO public.clients(id)
SELECT p.id FROM public.profiles p
WHERE p.role = 'client' AND NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id = p.id)
ON CONFLICT DO NOTHING;

-- Backfill user_roles from profiles
INSERT INTO public.user_roles(user_id, role)
SELECT p.id, p.role::public.app_role FROM public.profiles p
WHERE p.role IN ('lawyer','client','admin')
ON CONFLICT DO NOTHING;

-- Trigger: auto-create lawyers/clients row when profile.role is set
CREATE OR REPLACE FUNCTION public.tg_profiles_ensure_role_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.role = 'lawyer' THEN
    INSERT INTO public.lawyers(id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  ELSIF NEW.role = 'client' THEN
    INSERT INTO public.clients(id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, NEW.role::public.app_role)
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_profiles_ensure_role_row_ins ON public.profiles;
CREATE TRIGGER tg_profiles_ensure_role_row_ins
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_ensure_role_row();
