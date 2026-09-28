-- office resolution helpers
CREATE OR REPLACE FUNCTION public.current_office_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT tm.office_lawyer_id FROM public.team_members tm
      WHERE tm.member_profile_id = auth.uid() AND tm.is_active LIMIT 1),
    (SELECT l.id FROM public.lawyers l WHERE l.id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.is_office_member(_office uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _office = _user AND EXISTS (SELECT 1 FROM public.lawyers l WHERE l.id = _user)
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.office_lawyer_id = _office
          AND tm.member_profile_id = _user
          AND tm.is_active
      )
$$;

REVOKE EXECUTE ON FUNCTION public.current_office_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_office_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_office_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_office_member(uuid, uuid) TO authenticated;

CREATE TABLE public.team_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  attachment_url text,
  attachment_name text,
  attachment_type text,
  attachment_size bigint,
  is_ai boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX team_chat_messages_office_created_idx
  ON public.team_chat_messages (office_id, created_at DESC);

GRANT SELECT, INSERT ON public.team_chat_messages TO authenticated;
GRANT ALL ON public.team_chat_messages TO service_role;

ALTER TABLE public.team_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office members read team chat"
  ON public.team_chat_messages FOR SELECT TO authenticated
  USING (public.is_office_member(office_id, auth.uid()));

CREATE POLICY "office members send team chat"
  ON public.team_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND is_ai = false
    AND public.is_office_member(office_id, auth.uid())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.team_chat_messages;

-- storage policies for the team-chat bucket (bucket created separately)
CREATE POLICY "team chat files read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'team-chat'
    AND public.is_office_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "team chat files insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'team-chat'
    AND public.is_office_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );