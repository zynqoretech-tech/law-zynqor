
GRANT EXECUTE ON FUNCTION public.check_plan_limit(TEXT) TO authenticated;

DROP POLICY IF EXISTS "documents_select_own" ON storage.objects;
CREATE POLICY "documents_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "documents_insert_own" ON storage.objects;
CREATE POLICY "documents_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "documents_update_own" ON storage.objects;
CREATE POLICY "documents_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "documents_delete_own" ON storage.objects;
CREATE POLICY "documents_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "case_files_select_own" ON storage.objects;
CREATE POLICY "case_files_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'case-files' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "case_files_insert_own" ON storage.objects;
CREATE POLICY "case_files_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'case-files' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "case_files_update_own" ON storage.objects;
CREATE POLICY "case_files_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'case-files' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "case_files_delete_own" ON storage.objects;
CREATE POLICY "case_files_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'case-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
CREATE POLICY "avatars_select_public" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

INSERT INTO public.legal_statutes (law_name, law_number, law_year, article_number, article_text, topic_tags) VALUES
  ('قانون الشركات', '159', 1981, '2', 'تكون الشركة شركة مساهمة أو توصية بالأسهم أو ذات مسؤولية محدودة. وتسري عليها أحكام هذا القانون فيما لم يرد به نص خاص.', ARRAY['شركات','تأسيس']),
  ('قانون الشركات', '159', 1981, '77', 'يكون أعضاء مجلس الإدارة مسؤولين تجاه الشركة والمساهمين والغير عن جميع أعمال الغش وإساءة استعمال السلطة وعن كل مخالفة للقانون أو للنظام الأساسي للشركة وعن الخطأ في الإدارة.', ARRAY['شركات','مسؤولية']),
  ('قانون الشركات', '159', 1981, '133', 'تنحل الشركة بانقضاء مدتها أو بتحقق الغرض الذي أُسست من أجله أو باستحالة تحقيقه أو بهلاك جميع مالها أو معظمه أو باندماجها في شركة أخرى أو بقرار من الجمعية العامة غير العادية بحل الشركة قبل انقضاء مدتها.', ARRAY['شركات','تصفية']),
  ('قانون التجارة', '17', 1999, '87', 'يعتبر البيع تجارياً إذا كان مبرماً بقصد إعادة البيع ولو بعد تحويل المبيع أو بعد إجراء عمل عليه، أو كان مبرماً بقصد تأجيره.', ARRAY['تجارة','بيع']),
  ('قانون التجارة', '17', 1999, '195', 'يجب أن تشتمل الكمبيالة على البيانات الآتية: لفظ "كمبيالة" مكتوباً في متن الصك باللغة التي كُتب بها، وأمر غير معلق على شرط بوفاء مبلغ معين من النقود، واسم المسحوب عليه، وميعاد الاستحقاق، ومكان الوفاء، واسم من يجب الوفاء له أو لأمره، وتاريخ ومكان الإنشاء، وتوقيع الساحب.', ARRAY['تجارة','كمبيالة']),
  ('قانون التجارة', '17', 1999, '232', 'يُشهر إفلاس كل تاجر اضطربت أعماله المالية فوقف عن دفع ديونه التجارية. ولا يجوز شهر إفلاس التاجر بعد اعتزاله التجارة أو وفاته إلا إذا حصل الوقوف عن الدفع قبل الاعتزال أو الوفاة بسنة على الأقل.', ARRAY['تجارة','إفلاس']),
  ('قانون الإثبات', '25', 1968, '1', 'على الدائن إثبات الالتزام وعلى المدين إثبات التخلص منه. ويجب أن تكون الوقائع المراد إثباتها متعلقة بالدعوى ومنتجة فيها وجائزاً قبولها.', ARRAY['إثبات']),
  ('قانون الإثبات', '25', 1968, '60', 'في غير المواد التجارية إذا كان التصرف القانوني تزيد قيمته على ألف جنيه أو كان غير محدد القيمة فلا تجوز شهادة الشهود في إثبات وجوده أو انقضائه.', ARRAY['إثبات','كتابة']),
  ('قانون الإثبات', '25', 1968, '101', 'الإقرار القضائي هو إخبار الخصم أمام القضاء بواقعة قانونية مدعاة عليه وذلك أثناء السير في الدعوى المتعلقة بهذه الواقعة، وهو حجة قاطعة على المُقِر.', ARRAY['إثبات','إقرار']),
  ('قانون الإثبات', '25', 1968, '102', 'تُؤدى الشهادة شفاهة ولا يجوز الاستعانة بمذكرات مكتوبة إلا بإذن القاضي. ويُحلف الشاهد يميناً بأن يقول الحق ولا شيء غير الحق.', ARRAY['إثبات','شهادة']),
  ('قانون الإثبات', '25', 1968, '118', 'يجوز لكل من الخصمين أن يوجه اليمين الحاسمة إلى الخصم الآخر، على أنه يجوز للقاضي أن يمنع توجيهها إذا كان الخصم متعسفاً أو كانت الواقعة غير متعلقة بالدعوى أو غير منتجة فيها.', ARRAY['إثبات','يمين']),
  ('قانون الجنسية المصرية', '26', 1975, '4', 'يكون مصرياً: من وُلد لأب مصري أو لأم مصرية، ومن وُلد في مصر من أبوين مجهولين، ويُعتبر اللقيط في مصر مولوداً فيها ما لم يثبت العكس.', ARRAY['جنسية']),
  ('قانون الجنسية المصرية', '26', 1975, '16', 'يفقد الجنسية المصرية من اكتسب جنسية أجنبية ما لم يكن قد رُخص له بإذن من وزير الداخلية بالاحتفاظ بجنسيته المصرية خلال سنة من تاريخ اكتسابه الجنسية الأجنبية.', ARRAY['جنسية','فقد']),
  ('قانون حماية المستهلك', '181', 2018, '1', 'المستهلك: كل شخص طبيعي أو اعتباري تُقدَّم إليه المنتجات لإشباع احتياجاته الشخصية أو حاجة غيره أو يجري التعامل أو التعاقد معه بشأنها. المورد: كل شخص يقوم بإنتاج منتج أو توزيعه أو تداوله أو تقديم خدمة.', ARRAY['مستهلك']),
  ('قانون حماية المستهلك', '181', 2018, '6', 'للمستهلك الحق في استبدال المنتج المعيب أو رده مع رد قيمته أو إصلاحه مجاناً خلال 14 يوماً من تاريخ تسلمه، ودون أن يتحمل أي مقابل، وذلك متى ظهر عيب فيه أو لم يكن مطابقاً للمواصفات.', ARRAY['مستهلك','ضمان']),
  ('قانون حماية المستهلك', '181', 2018, '22', 'يُعاقب بغرامة لا تقل عن عشرة آلاف جنيه ولا تجاوز مليون جنيه كل من خالف أحكام المواد المنظِّمة لبيانات المنتجات وضمانات الإصلاح والاستبدال، وتتعدد العقوبة بتعدد المخالفات.', ARRAY['مستهلك','عقوبات']),
  ('قانون العمل', '12', 2003, '110', 'لا يجوز تشغيل العامل تشغيلاً فعلياً أكثر من ثماني ساعات في اليوم أو ثمانٍ وأربعين ساعة في الأسبوع، عدا الفترات المخصصة لتناول الطعام والراحة.', ARRAY['عمل','ساعات']),
  ('قانون العمل', '12', 2003, '124', 'يستحق العامل إجازة سنوية مدفوعة الأجر قدرها 21 يوماً عن السنة الكاملة، وتصبح 30 يوماً متى أمضى العامل في خدمة صاحب العمل عشر سنوات متصلة أو بلغ الخمسين من عمره.', ARRAY['عمل','إجازة']),
  ('قانون الإيجار', '4', 1996, '17', 'ينتهي عقد إيجار الأماكن بانتهاء المدة المتفق عليها ودون حاجة إلى تنبيه، ما لم يتفق الطرفان على التجديد، وتسري على هذه العقود أحكام القانون المدني فيما لم يرد به نص خاص.', ARRAY['إيجار','عقار']),
  ('قانون الأحوال الشخصية', '25', 1929, '6', 'الطلاق الذي يقع على المرأة بعد الدخول الحقيقي بها يكون رجعياً إلا الطلاق المكمل للثلاث وما نص على بينونته في هذا القانون. ويملك الزوج مراجعة زوجته في فترة العدة بقول أو فعل.', ARRAY['أسرة','طلاق'])
ON CONFLICT (law_number, law_year, article_number) DO NOTHING;
