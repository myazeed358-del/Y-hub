# حالة ترحيلات Supabase — 2026-11-03

المشروع المستهدف المعروف: `rspdfdrmswixcmpozgzr.supabase.co`.

طلب المستخدم صراحة دمج العمل وترحيل جميع التغييرات ومتابعة التطوير. تفويض الإنتاج موجود؛ العائق تقني وليس طلب موافقة جديدًا. جرى التحقق من البيئة المنشورة: الحالة running، والملاحظات current، والاعتمادات الجاهزة فقط `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY`. لا اتصال PostgreSQL إداري، ولا هوية/موصل إدارة Supabase، ولا منح شبكة TCP لقاعدة البيانات. يسمح HTTP بالمشروع المذكور فقط ضمن نطاقات المستخدم، ولا يوجد VPN. المفتاح العام لا يتيح تنفيذ DDL أو قراءة سجل الترحيلات الإداري.

**لم تُطبّق أي Migration على الإنتاج في هذه الجلسة. سجل الإنتاج وحالة schema غير متحقق منهما؛ لا يُدّعى أن جميع الملفات التالية ناقصة على الإنتاج.** طُلب توفير `SUPABASE_DB_URL` عبر إعدادات البيئة السرية ونشر الإعدادات وذكر hostname فقط لتكوين الشبكة. لا أسرار في المحادثة أو المستودع.

دُمج0054 مع المجموعة الموثقة على main `9327493e96d6c8b697fc155de057aa7321224393`.0055 جزء من مجموعة تطوير لاحقة مستقلة `feature/approved-topic-performance`. كلاهما اختُبر محليًا؛ التفويض السابق لا يجعل قاعدة الإنتاج مُرحّلة تلقائيًا.

بعد إتاحة الاتصال: قراءة سجل `supabase_migrations.schema_migrations` وأعمدته، ومقارنة الإصدارات والأسماء ومحتوى المخطط الفعلي، ثم تحديد الناقص ومتطلباته. يجب عدم إعادة تشغيل كل الملفات عميانيًا أو إصلاح السجل لمجرد اختلاف ترقيمه. تُراجع أقفال DDL والفهارس والترحيلات ذات backfill وحجم الجداول وحالة النسخ الاحتياطية قبل التنفيذ، ثم تُنفذ المجموعة الناقصة المتوافقة وتُراجع RLS وRPC والأدوار دون تعديل حسابات حقيقية كاختبار. اختبار Staging المعزول ما زال PENDING.

0055 لا يغير بيانات: يضيف قارئًا مخولًا ومساعدين خاصين ويعيد استخدام قاعدة أهلية النتائج في تقرير الوحدات القائم. يتطلب0054/0053. اختبار الترقية المأهولة يقارن المحاولات والأسئلة والمراجعات والخطط والأوزان والربط والتدقيق والتقرير القديم قبل وبعده.

0056 على `feature/approved-practice-antiderivatives` يوسع عقد التحقق الرياضي ويضيف عمود هوية مولدًا مخزنًا وفهرسًا خاصًا، مع تحديث النشر والخطة دون تعديل المحاولات التاريخية. يتطلب0055 وسابقاته، واختُبر على قاعدة0055 مأهولة. إضافة العمود والفهرس قد تعيد كتابة الجدول وتحتاج قفل DDL؛ يلزم فحص البيانات القديمة وحجم الجدول والوقت قبل التطبيق. لم يُطبق على الإنتاج، ولم يُنشر العامل الجديد.

الجرد المحلي يحوي54ملفًا حتى0056، دون تكرار أرقام. الفجوتان التاريخيتان0031/0032 محفوظتان كما فيmain؛ وظائفهما صولحت سابقًا في0037/0041 ولا تُعاد ملفات الفروع المتقادمة. العدد54 ليس عدد الترحيلات الناقصة على الإنتاج. الجرد التالي لتثبيت الملفات التي تمت مراجعتها، وليس سجل نشر إنتاجي:

| الإصدار | الملف | SHA-256 |
|---|---|---|
|0001|`0001_initial_schema.sql`|`16fd65b46dcf490e4adf400b4de60335e2cf794d6ccd683f6663d01737def58d`|
|0002|`0002_quiz_module.sql`|`bbcec9f5a9a380b72ffb3048808741022a28a6b43529530fe32e49b7fc6923d9`|
|0003|`0003_security_and_rpcs.sql`|`0b628b3c9335fe243749645d8ad38eed2893f22b2c739aa4b6732f16f16b2372`|
|0004|`0004_users_security.sql`|`a9a7cb7892ccaf7b856e8fda1214527a7d50339b6a2caa8e623491248176fe7b`|
|0005|`0005_security_hardening_phase5a.sql`|`9f599a7665e9e92c59bf665f509c5899cbe9c7f865ede957189ab6c28e667280`|
|0006|`0006_enrollment.sql`|`5b4425706e2ad4d099a79e42bb9b32c8a3196cf74daa1975948ff34cd4fba451`|
|0007|`0007_storage_security.sql`|`1cfce302e4fe2ae0bf69896064bb366ff53cc9c51a4eafeb2f93244378e5c08e`|
|0008|`0008_profile_data_integrity.sql`|`eb23687780199f249eb9aa9200fdbc114387394f7fc3f0c5694614530c219442`|
|0009|`0009_restore_authenticated_profile_read.sql`|`180ea770c60f5fc80aacaee166d97f71435251acb60a072de076c29cda8c1b96`|
|0010|`0010_student_only_study_year.sql`|`bacc0f966ff030a6b527d297feea853b7bbd181c5bb530cd9c8e796d76fb65d0`|
|0011|`0011_course_syllabus.sql`|`ca624ac22472842a79c2b8af40a81993803d621077b9ed81e4cedda3157be854`|
|0012|`0012_restore_course_insert_grant.sql`|`a21e9b2b71204d2daabc74d55b0daf8f1f8dd74a404fad6fee37baa6928547fc`|
|0013|`0013_restore_course_select_grant.sql`|`5a422cc48fc91f4fb35d2d4038cb696d042960411a7ae7a7def61e0d7ee26c87`|
|0014|`0014_restore_course_update_delete_grants.sql`|`f2922864c967740e691d5d1b5e7075def6e97567a8635d10d36e33a1d0055448`|
|0015|`0015_ai_tutor_quota_and_material_grants.sql`|`4096b444600da8741cd557fda8d41996c4dd7d16dc88f4d2b715aad418f4a2dd`|
|0016|`0016_ai_tutor_global_daily_quota.sql`|`5fcaee063669849cab44624bef297a0a81541a63b99147470e34c5f9876c5736`|
|0017|`0017_course_enrollment_roster.sql`|`373141eea5d0e9262d7109ec6704e18b3c11dccea2a02e028bb870225bc526d4`|
|0018|`0018_user_numbers.sql`|`535f6a782fbe971e23e0cdd02af310ff122574facea2a5b13b0151bbb434906c`|
|0019|`0019_course_enrollment_insert_grant.sql`|`3b195f04f556e9a1965c1eb16a103c3329296b5ed3a104828ba543ca23ff364c`|
|0020|`0020_section_enrollment_control.sql`|`6be8f94850f3f32e79bd1a40fa60a8f9f6d126289f533ae1c96d71d18894b62d`|
|0021|`0021_roster_user_numbers.sql`|`4173914d82f727ea5f50e8a70026d9ab6d2e1ebccf264280d6873081d7444f7b`|
|0022|`0022_central_audit_log.sql`|`19096672ca89c682ac8d1a044394d9ee664b1f522dfb6032e40f20e1b41571f7`|
|0023|`0023_y_sheets_workbooks.sql`|`d2dbe4049eff5c3cfc8bf58c1f7484bd6387355d1fe08e78384c1096f9b16560`|
|0024|`0024_y_sheets_safe_saves.sql`|`87b459d1a3f2c8779b0d2b41bd7f63dcadd185ed98e3bcf3ad4c2bcad773e694`|
|0025|`0025_exam_attempt_integrity.sql`|`93f6c9ee21a73ad3b34409299c7aa45b2c47a745589c8e34ead3f73a4efcab73`|
|0026|`0026_confirm_course_deletion.sql`|`6a6df2336954946c8b36d256f1d172819ab36ae917d9c8a51933a84c82a9c016`|
|0027|`0027_academic_course_definitions.sql`|`bafe9c8bf95b28d1a4658f52e654441479697c3699437ebf7c0c5737b6dd451e`|
|0028|`0028_syllabus_and_academic_permissions.sql`|`37205c2f3c107ced9bb5dc85d505ae5ec62ec70e73c1587c653d98ef49aca03c`|
|0029|`0029_security_privileges_and_exam_access.sql`|`58696542ad9023960c2655c182e0e1017d00633f083dd70a72471bb73e0f7595`|
|0030|`0030_exam_question_snapshots.sql`|`ad3601c7b4653735552f961f501202c8a28d110d655eac2111d9877b79408962`|
|0033|`0033_exceptional_engine_access.sql`|`b884aa5f882de2664d3f681065b574b850e939f73b9363d1bf6cb9f7b7e02928`|
|0034|`0034_student_quick_access.sql`|`6cb3020be90257f1621bb636327836d7f6fb7ee48aa4efb079e567f33e4e1b6e`|
|0035|`0035_academic_attendance.sql`|`21542baea14db59f4551c2b38d4f549f50aa31b91669ea06bbe5b5e1713e2bf0`|
|0036|`0036_online_lectures.sql`|`99e824ac137580a9adc1708a62bcd17dacfe2cabf3f9c77d978ccb88d4d5f112`|
|0037|`0037_y_sheets_application_conflicts.sql`|`fe2c5a8b71d77760723f93005910b47ce91cad7636360891ad6e468ef6d0e192`|
|0038|`0038_ai_tutor_knowledge.sql`|`3833f8b234f1be3c93a2086097dcbb7f1b80a23348ab7e2f80160ef614b70696`|
|0039|`0039_ai_tutor_arabic_search.sql`|`8f592f7e5c52528d45d9d739a74f3606ab009332f2c18088cb312e844defdc10`|
|0040|`0040_attendance_session_lifecycle.sql`|`7d3a67855c9bd5ab95a734213f586d5bc2931cd3b0cb0f6083a4dc010483e477`|
|0041|`0041_academic_management_contracts.sql`|`b9a527321d505bbaa912fec3993d8375087622a239bf26696f5926df62fe78cb`|
|0042|`0042_attendance_reporting.sql`|`829fc53abc7d830eff36a44742637c28f949141a37ff838843dfbed461aa24e7`|
|0043|`0043_engine_grant_workflows.sql`|`66130402f7e99769cfe706b4523b837ad962d07ec51951f1a11d711756d061b5`|
|0044|`0044_bilingual_profile_names.sql`|`f013e3893068f159769182d835f87ddd36adf22c108059509856b02202535ffe`|
|0045|`0045_audit_person_search.sql`|`51c0037e15826117d7342b1acbb59d5cd46ba3113eac2480145638cb817c7c42`|
|0046|`0046_lesson_completion.sql`|`ae27e04dbc266b6164e6a9f1f61352a130ad9c4caedf494c1816bd431e7c1c97`|
|0047|`0047_ai_practice_sources.sql`|`ccedde27dfa7224d9ed9be01c52f2b86f0059731a8cdc52365835a9031d883ce`|
|0048|`0048_ai_practice_sessions.sql`|`4232dfb8cac9707a21bfe3c964e873d86b10ab2e69c515eb5077b8bd9399db3b`|
|0049|`0049_ai_practice_review.sql`|`bc185941a2bfa0ca1e3fa008034f92d84ff7881d8bdb24547b11c5a8158d61aa`|
|0050|`0050_ai_practice_math_verification.sql`|`be9ed1793050e15d7d67c602f4527dbf285f2da433a751ed2c0f743610e0a193`|
|0051|`0051_ai_practice_equivalence.sql`|`8742649dc9d2f5dc110530d8fea44c75e8e41ddd6f0cb56ad8d62a0466a6cf84`|
|0052|`0052_ai_practice_adaptive_difficulty.sql`|`e46dcdee7b30295bfaf837aab8c118d94d87a8389e54656ffb047c1dac0838a2`|
|0053|`0053_ai_practice_performance.sql`|`df2e939c464b70dc2ec19559d0eed9259488a917bde2f3980513859d02243f1a`|
|0054|`0054_ai_practice_outline_scope.sql`|`2ef0f975c9c27aece5d738d6045ea61687d85977641de5c3ecbd5b6536fc17b2`|
|0055|`0055_ai_practice_topic_performance.sql`|`497c1f05b19e0e6ec3d534e7383f7c37a09f2a6f00d2f84c13c943494a533068`|
|0056|`0056_practice_antiderivatives.sql`|`be9f339d422e9b8e71a067beec93bf7970b0bd2237736decfd25fd7665740baa`|
