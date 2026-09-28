-- ===== conversations =====
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id uuid NOT NULL,
  client_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'engagement',
  source_id uuid,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lawyer_id, client_id)
);

GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants read conversations" ON public.conversations
  FOR SELECT TO authenticated USING (auth.uid() = lawyer_id OR auth.uid() = client_id);
CREATE POLICY "participants create conversations" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = lawyer_id OR auth.uid() = client_id);
CREATE POLICY "participants update conversations" ON public.conversations
  FOR UPDATE TO authenticated USING (auth.uid() = lawyer_id OR auth.uid() = client_id)
  WITH CHECK (auth.uid() = lawyer_id OR auth.uid() = client_id);

CREATE TRIGGER conversations_set_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ===== messages =====
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  attachment_url text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON public.messages(conversation_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants read messages" ON public.messages
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id
      AND (c.lawyer_id = auth.uid() OR c.client_id = auth.uid())));
CREATE POLICY "participants send messages" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id
      AND (c.lawyer_id = auth.uid() OR c.client_id = auth.uid())));
CREATE POLICY "participants mark read" ON public.messages
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id
      AND (c.lawyer_id = auth.uid() OR c.client_id = auth.uid())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id
      AND (c.lawyer_id = auth.uid() OR c.client_id = auth.uid())));

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- ===== open (or reuse) a conversation between the two parties =====
CREATE OR REPLACE FUNCTION public.open_conversation(_lawyer_id uuid, _client_id uuid, _source text DEFAULT 'engagement', _source_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() NOT IN (_lawyer_id, _client_id) THEN
    RAISE EXCEPTION 'not a participant';
  END IF;
  SELECT id INTO v_id FROM public.conversations WHERE lawyer_id = _lawyer_id AND client_id = _client_id;
  IF v_id IS NULL THEN
    INSERT INTO public.conversations (lawyer_id, client_id, source, source_id)
    VALUES (_lawyer_id, _client_id, COALESCE(_source, 'engagement'), _source_id)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.open_conversation(uuid, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_conversation(uuid, uuid, text, uuid) TO authenticated;

-- ===== client contact details for the lawyer they are engaged with =====
CREATE OR REPLACE FUNCTION public.lawyer_client_contacts()
RETURNS TABLE(client_id uuid, full_name text, phone text, email text, location text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.phone, u.email::text, p.location, p.avatar_url
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.engagement_requests e WHERE e.client_id = p.id AND e.lawyer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.consultations c WHERE c.client_id = p.id AND c.lawyer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.cases k WHERE k.client_id = p.id AND k.lawyer_id = auth.uid())
  );
$$;
REVOKE EXECUTE ON FUNCTION public.lawyer_client_contacts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lawyer_client_contacts() TO authenticated;

-- ===== lawyer public profile + contact for clients engaged with them =====
CREATE OR REPLACE FUNCTION public.client_lawyer_contacts()
RETURNS TABLE(lawyer_id uuid, full_name text, phone text, email text, avatar_url text, bar_number text,
              firm_name text, city text, address text, bio text, specializations text[],
              experience_years integer, rating numeric, verified boolean, consultation_price numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.phone, u.email::text, p.avatar_url, l.bar_number,
         l.firm_name, l.city, l.address, l.bio, l.specializations,
         l.experience_years, l.rating, l.verified, l.consultation_price
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.lawyers l ON l.id = p.id
  WHERE auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.engagement_requests e WHERE e.lawyer_id = p.id AND e.client_id = auth.uid() AND e.status = 'accepted')
    OR EXISTS (SELECT 1 FROM public.consultations c WHERE c.lawyer_id = p.id AND c.client_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.cases k WHERE k.lawyer_id = p.id AND k.client_id = auth.uid())
  );
$$;
REVOKE EXECUTE ON FUNCTION public.client_lawyer_contacts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_lawyer_contacts() TO authenticated;