
-- =========================================================================
-- SECURITY HARDENING + VERIFICATION WORKFLOW + PAYMENTS
-- =========================================================================

-- ---------- 1. LAWYERS: split RLS + protect trust columns ----------
DROP POLICY IF EXISTS "lawyer manage self" ON public.lawyers;

CREATE POLICY "lawyers insert self" ON public.lawyers
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "lawyers update self" ON public.lawyers
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "lawyers delete self" ON public.lawyers
  FOR DELETE TO authenticated
  USING (id = auth.uid());

-- Trigger: silently revert client-side attempts to change trust columns
CREATE OR REPLACE FUNCTION public.tg_lawyers_protect_trust()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.verified       := OLD.verified;
  NEW.rating         := OLD.rating;
  NEW.reviews_count  := OLD.reviews_count;
  NEW.cases_won      := OLD.cases_won;
  NEW.total_cases    := OLD.total_cases;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS lawyers_protect_trust ON public.lawyers;
CREATE TRIGGER lawyers_protect_trust
  BEFORE UPDATE ON public.lawyers
  FOR EACH ROW EXECUTE FUNCTION public.tg_lawyers_protect_trust();

-- Admin-only RPC to set verification
CREATE OR REPLACE FUNCTION public.admin_set_lawyer_verification(
  _lawyer_id uuid,
  _verified boolean,
  _notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.lawyers SET verified = _verified WHERE id = _lawyer_id;
  UPDATE public.lawyer_verification_requests
     SET status = CASE WHEN _verified THEN 'approved' ELSE 'rejected' END,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         notes = COALESCE(_notes, notes)
   WHERE lawyer_id = _lawyer_id AND status = 'pending';
END $$;

-- Server-side rating recompute on reviews changes
CREATE OR REPLACE FUNCTION public.tg_reviews_recompute_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_lawyer uuid;
BEGIN
  v_lawyer := COALESCE(NEW.lawyer_id, OLD.lawyer_id);
  UPDATE public.lawyers l SET
    rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2)
                       FROM public.reviews WHERE lawyer_id = v_lawyer AND is_visible = true), 0),
    reviews_count = (SELECT COUNT(*) FROM public.reviews WHERE lawyer_id = v_lawyer AND is_visible = true)
  WHERE l.id = v_lawyer;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS reviews_recompute_rating ON public.reviews;
CREATE TRIGGER reviews_recompute_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_reviews_recompute_rating();

-- ---------- 2. PROFILES: protect role column ----------
CREATE OR REPLACE FUNCTION public.tg_profiles_protect_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.role := OLD.role;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_protect_role ON public.profiles;
CREATE TRIGGER profiles_protect_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_protect_role();

-- Safe signup RPC
CREATE OR REPLACE FUNCTION public.complete_signup(
  _role text,
  _full_name text,
  _phone text DEFAULT NULL,
  _location text DEFAULT NULL,
  _bar_number text DEFAULT NULL,
  _firm_name text DEFAULT NULL,
  _specializations text[] DEFAULT '{}'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _role NOT IN ('lawyer','client') THEN RAISE EXCEPTION 'invalid_role'; END IF;

  INSERT INTO public.profiles (id, role, full_name, phone, location, plan)
  VALUES (v_uid, _role, _full_name, _phone, _location, 'free')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone     = COALESCE(EXCLUDED.phone, public.profiles.phone),
    location  = COALESCE(EXCLUDED.location, public.profiles.location);

  IF _role = 'lawyer' THEN
    INSERT INTO public.lawyers (id, bar_number, firm_name, specializations, city)
    VALUES (v_uid, _bar_number, _firm_name, COALESCE(_specializations,'{}'), _location)
    ON CONFLICT (id) DO NOTHING;
  ELSE
    INSERT INTO public.clients (id) VALUES (v_uid) ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.complete_signup(text,text,text,text,text,text,text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_lawyer_verification(uuid,boolean,text) TO authenticated;

-- ---------- 3. LAWYER VERIFICATION REQUESTS ----------
CREATE TABLE IF NOT EXISTS public.lawyer_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id uuid NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  bar_number text,
  bar_document_url text,
  id_document_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.lawyer_verification_requests TO authenticated;
GRANT ALL ON public.lawyer_verification_requests TO service_role;

ALTER TABLE public.lawyer_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lvr lawyer read own" ON public.lawyer_verification_requests
  FOR SELECT TO authenticated
  USING (lawyer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "lvr lawyer insert own" ON public.lawyer_verification_requests
  FOR INSERT TO authenticated
  WITH CHECK (lawyer_id = auth.uid() AND status = 'pending');

CREATE POLICY "lvr admin update" ON public.lawyer_verification_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER lvr_updated BEFORE UPDATE ON public.lawyer_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- 4. PAYMENTS ----------
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'EGP',
  provider text NOT NULL DEFAULT 'paymob',
  provider_ref text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  purpose text NOT NULL CHECK (purpose IN ('subscription','consultation_deposit')),
  related_id text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments own read" ON public.payments
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_ref ON public.payments(provider_ref);

CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Consultation deposit + lawyer flag
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS deposit_status text NOT NULL DEFAULT 'none'
  CHECK (deposit_status IN ('none','required','paid','refunded'));

ALTER TABLE public.lawyers
  ADD COLUMN IF NOT EXISTS requires_deposit boolean NOT NULL DEFAULT false;

-- Server-side subscription activation from webhook
CREATE OR REPLACE FUNCTION public.activate_subscription_from_payment(
  _user_id uuid,
  _plan text,
  _months int DEFAULT 1,
  _provider_ref text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_expires timestamptz;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v_expires := now() + (_months || ' months')::interval;
  UPDATE public.profiles
    SET plan = _plan, plan_expires_at = v_expires, updated_at = now()
    WHERE id = _user_id;
  INSERT INTO public.subscriptions (user_id, plan, status, started_at, expires_at, notes)
  VALUES (_user_id, _plan, 'active', now(), v_expires,
          'auto-activated via payment ' || COALESCE(_provider_ref,''));
END $$;

-- ---------- 5. MODERATOR: review moderation permissions ----------
-- Allow moderators (and admins) to update review visibility
DROP POLICY IF EXISTS "reviews moderator update" ON public.reviews;
CREATE POLICY "reviews moderator update" ON public.reviews
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

DROP POLICY IF EXISTS "reviews moderator read all" ON public.reviews;
CREATE POLICY "reviews moderator read all" ON public.reviews
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
