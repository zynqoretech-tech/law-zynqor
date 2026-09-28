CREATE OR REPLACE FUNCTION public.complete_signup(
  _role text,
  _full_name text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _location text DEFAULT NULL,
  _bar_number text DEFAULT NULL,
  _firm_name text DEFAULT NULL,
  _specializations text[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.profiles(id, full_name, role, phone, location)
    VALUES (v_uid, _full_name, _role, _phone, _location)
    ON CONFLICT (id) DO UPDATE SET
      role = EXCLUDED.role,
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
      location = COALESCE(EXCLUDED.location, public.profiles.location);
  IF _role = 'lawyer' THEN
    INSERT INTO public.lawyers(id, bar_number, firm_name, city, specializations)
      VALUES (v_uid, _bar_number, _firm_name, _location, COALESCE(_specializations, '{}'))
      ON CONFLICT (id) DO UPDATE SET
        bar_number = COALESCE(EXCLUDED.bar_number, public.lawyers.bar_number),
        firm_name = COALESCE(EXCLUDED.firm_name, public.lawyers.firm_name),
        city = COALESCE(EXCLUDED.city, public.lawyers.city),
        specializations = CASE WHEN COALESCE(array_length(EXCLUDED.specializations,1),0) > 0
                               THEN EXCLUDED.specializations ELSE public.lawyers.specializations END;
  ELSIF _role = 'client' THEN
    INSERT INTO public.clients(id) VALUES (v_uid) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (v_uid, _role::public.app_role)
    ON CONFLICT DO NOTHING;
END;
$function$;