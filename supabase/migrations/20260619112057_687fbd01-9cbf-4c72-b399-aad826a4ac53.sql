
-- ============ P2-01: DB-backed rate limiting ============
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  user_id UUID NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', now()),
  request_count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, window_start)
);
GRANT SELECT ON public.api_rate_limits TO authenticated;
GRANT ALL ON public.api_rate_limits TO service_role;
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rate_limits_own_read" ON public.api_rate_limits;
CREATE POLICY "rate_limits_own_read" ON public.api_rate_limits FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.check_and_increment_rate(
  p_user_id UUID,
  p_max_per_minute INT DEFAULT 20
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_window TIMESTAMPTZ := date_trunc('minute', now());
  v_count INT;
BEGIN
  INSERT INTO public.api_rate_limits (user_id, window_start, request_count)
  VALUES (p_user_id, v_window, 1)
  ON CONFLICT (user_id, window_start)
  DO UPDATE SET request_count = public.api_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;
  RETURN v_count <= p_max_per_minute;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate(UUID, INT) TO authenticated, service_role;

-- Cleanup helper (purge old windows)
CREATE OR REPLACE FUNCTION public.purge_old_rate_limits() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  DELETE FROM public.api_rate_limits WHERE window_start < now() - interval '1 hour';
$$;

-- ============ P2-02: lock down audit_logs writes ============
DROP POLICY IF EXISTS "audit_own_insert" ON public.audit_logs;
REVOKE INSERT ON public.audit_logs FROM authenticated;

-- ============ P3-03: legal_statutes (RAG base) ============
CREATE TABLE IF NOT EXISTS public.legal_statutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  law_number TEXT NOT NULL,
  law_year INT NOT NULL,
  law_name TEXT NOT NULL,
  article_number TEXT NOT NULL,
  article_text TEXT NOT NULL,
  topic_tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT ON public.legal_statutes TO anon, authenticated;
GRANT ALL ON public.legal_statutes TO service_role;
ALTER TABLE public.legal_statutes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "statutes public read" ON public.legal_statutes;
CREATE POLICY "statutes public read" ON public.legal_statutes FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_statutes_fts ON public.legal_statutes
USING GIN(to_tsvector('simple', COALESCE(article_text,'') || ' ' || COALESCE(law_name,'')));
CREATE INDEX IF NOT EXISTS idx_statutes_tags ON public.legal_statutes USING GIN(topic_tags);
CREATE UNIQUE INDEX IF NOT EXISTS uq_statutes_article ON public.legal_statutes(law_number, law_year, article_number);

INSERT INTO public.legal_statutes (law_number, law_year, law_name, article_number, article_text, topic_tags) VALUES
('13','1968','قانون المرافعات المدنية والتجارية','227','ميعاد الاستئناف أربعون يوماً ما لم ينص القانون على غير ذلك، ويكون الميعاد ستين يوماً في الأحكام الصادرة في المسائل المستعجلة. ويبدأ الميعاد من تاريخ صدور الحكم ما لم ينص القانون على غير ذلك.', ARRAY['استئناف','مواعيد','مرافعات']),
('13','1968','قانون المرافعات المدنية والتجارية','213','يبدأ ميعاد الطعن في الحكم من تاريخ صدوره، ما لم ينص القانون على غير ذلك. غير أن الميعاد لا يبدأ في الأحكام الغيابية إلا من تاريخ إعلان الحكم إلى المحكوم عليه.', ARRAY['طعن','مواعيد','مرافعات']),
('13','1968','قانون المرافعات المدنية والتجارية','252','ميعاد الطعن بالنقض ستون يوماً.', ARRAY['نقض','مواعيد','مرافعات']),
('12','2003','قانون العمل','110','لا يجوز لصاحب العمل إنهاء عقد العمل غير محدد المدة إلا لسبب مشروع وكاف وبعد إخطار العامل بذلك كتابة قبل الإنهاء بشهرين إذا كانت مدة خدمته لا تزيد على عشر سنوات، وثلاثة أشهر إذا زادت على ذلك.', ARRAY['عمل','إنهاء خدمة','إخطار']),
('12','2003','قانون العمل','122','إذا كان إنهاء العقد غير المحدد المدة بغير مبرر مشروع كان للعامل الحق في تعويض، ويقدر القاضي قيمة التعويض على ألا يقل عن أجر شهرين كاملين عن كل سنة من سنوات الخدمة.', ARRAY['عمل','تعويض','فصل تعسفي']),
('131','1948','القانون المدني','374','تتقادم الالتزامات بانقضاء خمس عشرة سنة فيما عدا الحالات التي ورد فيها نص خاص في القانون.', ARRAY['تقادم','مدني','التزامات']),
('131','1948','القانون المدني','378','يتقادم بسنة واحدة دين الفنادق والمطاعم، والتجار عما باعوه من بضائع، والعمال والصناع والخدم عما يستحقونه من أجور.', ARRAY['تقادم قصير','مدني']),
('4','1996','قانون الإيجار','18','للمالك أن يطلب إخلاء العين المؤجرة عند انتهاء العقد دون الحاجة إلى تنبيه بالإخلاء.', ARRAY['إيجار','إخلاء']),
('4','1996','قانون الإيجار','19','تطبق أحكام القانون المدني على عقود الإيجار التي تبرم بعد العمل بهذا القانون.', ARRAY['إيجار','مدني']),
('150','1950','قانون الإجراءات الجنائية','241','ميعاد استئناف الأحكام الجنائية الصادرة في الجنح والمخالفات عشرة أيام من تاريخ النطق بالحكم الحضوري أو من تاريخ إعلانه في الأحكام الغيابية.', ARRAY['جنائي','استئناف','مواعيد'])
ON CONFLICT (law_number, law_year, article_number) DO NOTHING;
