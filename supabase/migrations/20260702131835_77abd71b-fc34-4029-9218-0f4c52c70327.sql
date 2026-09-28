
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT UNIQUE,
  ADD COLUMN IF NOT EXISTS telegram_link_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex');

UPDATE public.profiles
  SET telegram_link_code = encode(gen_random_bytes(6), 'hex')
  WHERE telegram_link_code IS NULL;
