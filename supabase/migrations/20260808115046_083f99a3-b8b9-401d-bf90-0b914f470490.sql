-- 1) Messages attachments + delivery
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_size bigint,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- 2) Terms acceptance
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- 3) Generic notification helper (security definer bypasses notifications RLS)
CREATE OR REPLACE FUNCTION public.push_notification(
  _user_id uuid, _title text, _body text, _type text,
  _related_id uuid DEFAULT NULL, _related_type text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_catalog'
AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications(user_id, title, body, type, related_id, related_type)
  VALUES (_user_id, _title, _body, _type, _related_id, _related_type);
END; $$;

GRANT EXECUTE ON FUNCTION public.push_notification(uuid,text,text,text,uuid,text) TO authenticated;

-- 4) Consultations
CREATE OR REPLACE FUNCTION public.tg_notify_consultation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_catalog'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.push_notification(NEW.lawyer_id, 'طلب استشارة جديد 📞',
      'لديك طلب استشارة جديد بتاريخ ' || to_char(NEW.scheduled_at, 'YYYY-MM-DD HH24:MI'),
      'consultation', NEW.id, 'consultations');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.push_notification(NEW.client_id,
      CASE NEW.status
        WHEN 'confirmed' THEN 'تم تأكيد استشارتك ✅'
        WHEN 'completed' THEN 'تم إتمام الاستشارة'
        WHEN 'cancelled' THEN 'تم إلغاء الاستشارة'
        ELSE 'تحديث على استشارتك' END,
      'حالة الاستشارة الآن: ' || NEW.status, 'consultation', NEW.id, 'consultations');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tg_notify_consultation_ins ON public.consultations;
CREATE TRIGGER tg_notify_consultation_ins AFTER INSERT ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_consultation();
DROP TRIGGER IF EXISTS tg_notify_consultation_upd ON public.consultations;
CREATE TRIGGER tg_notify_consultation_upd AFTER UPDATE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_consultation();

-- 5) Engagement requests
CREATE OR REPLACE FUNCTION public.tg_notify_engagement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_catalog'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.push_notification(NEW.lawyer_id, 'طلب توكيل جديد ⚖️',
      COALESCE(NEW.subject, 'لديك طلب توكيل جديد'), 'engagement', NEW.id, 'engagement_requests');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.push_notification(NEW.client_id,
      CASE NEW.status WHEN 'accepted' THEN 'تم قبول طلب التوكيل ✅'
                      WHEN 'rejected' THEN 'تم رفض طلب التوكيل'
                      ELSE 'تحديث على طلب التوكيل' END,
      COALESCE(NEW.subject, ''), 'engagement', NEW.id, 'engagement_requests');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tg_notify_engagement_ins ON public.engagement_requests;
CREATE TRIGGER tg_notify_engagement_ins AFTER INSERT ON public.engagement_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_engagement();
DROP TRIGGER IF EXISTS tg_notify_engagement_upd ON public.engagement_requests;
CREATE TRIGGER tg_notify_engagement_upd AFTER UPDATE ON public.engagement_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_engagement();

-- 6) Messages -> notify peer + keep conversation preview fresh
CREATE OR REPLACE FUNCTION public.tg_notify_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_catalog'
AS $$
DECLARE v_lawyer uuid; v_client uuid; v_peer uuid; v_name text;
BEGIN
  SELECT lawyer_id, client_id INTO v_lawyer, v_client FROM public.conversations WHERE id = NEW.conversation_id;
  v_peer := CASE WHEN NEW.sender_id = v_lawyer THEN v_client ELSE v_lawyer END;
  SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.sender_id;
  UPDATE public.conversations
     SET last_message = COALESCE(NULLIF(NEW.body,''), '📎 مرفق'), last_message_at = NEW.created_at
   WHERE id = NEW.conversation_id;
  PERFORM public.push_notification(v_peer, 'رسالة جديدة من ' || COALESCE(v_name,'مستخدم'),
    left(COALESCE(NULLIF(NEW.body,''), '📎 مرفق'), 120), 'message', NEW.conversation_id, 'conversations');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tg_notify_message_ins ON public.messages;
CREATE TRIGGER tg_notify_message_ins AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_message();

-- 7) Invoices -> notify client
CREATE OR REPLACE FUNCTION public.tg_notify_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_catalog'
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    PERFORM public.push_notification(NEW.client_id, 'فاتورة جديدة 🧾',
      'فاتورة رقم ' || NEW.invoice_number || ' بقيمة ' || NEW.total_amount || ' ج',
      'invoice', NEW.id, 'invoices');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tg_notify_invoice_ins ON public.invoices;
CREATE TRIGGER tg_notify_invoice_ins AFTER INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_invoice();

-- 8) Realtime
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 9) Storage policies for chat attachments (bucket created separately)
CREATE POLICY "chat_files_participants_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-files' AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (c.lawyer_id = auth.uid() OR c.client_id = auth.uid())
  )
);

CREATE POLICY "chat_files_participants_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-files' AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (c.lawyer_id = auth.uid() OR c.client_id = auth.uid())
  )
);
