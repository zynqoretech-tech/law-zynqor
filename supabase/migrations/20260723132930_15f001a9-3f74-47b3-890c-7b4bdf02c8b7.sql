
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_chat_id bigint;
ALTER TABLE public.lawyer_verification_requests ADD COLUMN IF NOT EXISTS selfie_url text;
