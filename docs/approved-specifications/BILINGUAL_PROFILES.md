# القرار25 — أسماء الحسابات بالعربية والإنجليزية

2026-10-26. الفرع `feature/approved-bilingual-profiles` من main `06cabec3b1fee1b5cfe6a9457d9dd914a3398155`. مجموعات الحضور والمنح والتنقل السابقة محفوظة على فروعها؛ نُسخ توثيقها فقط، ولم يُعد تنفيذها أو دمجها.

## ما أصبح يعمل

- التسجيل الحالي يطلب `full_name_ar` و`full_name_en` مع اتجاه كل حقل ولغته. AuthContext يرسل الاسمين إلى مسار Supabase Auth الموجود، دون إنشاء تسجيل موازٍ أو إرسال دور من الواجهة.
- الترحيل الجديد0044 يضيف الحقلين ويحدّث trigger التسجيل: رفض الاسمين المفقودين/غير الصحيحين داخل المعاملة؛ العمر ومعالجة الدراسة والتخصص والدور الطالب الافتراضي باقية. الاسم من2إلى120حرفًا؛ دعم الحروف العربية والتشكيل والحروف اللاتينية وبعض العلامات المعتادة، ورفض الأرقام وHTML ومحارف التحكم/تغيير الاتجاه.
- لا تخمين أو ترجمة آلية لأسماء المستخدمين القدامى، ولا إعادة تخصيص للأرقام. `full_name` القديم محفوظ. للحساب الجديد يظل الاسم العربي نسخة التوافق التي تقرؤها واجهات/RPCs الأسماء القديمة.
- شاشة الملف الشخصي تعرض الاسمين وتتيح استكمال المفقود. RPC `complete_own_profile_names(p_ar text,p_en text)` يستخرج الهوية من `auth.uid()` ويقفل صف صاحبها. الاسمان المحفوظان للقراءة فقط؛ تغييرهما ليس جزءًا من عقد الاستكمال. طلبان مختلفان متزامنان: الأول ينجح والآخر يحصل على409 دون خلط. إعادة الطلب نفسه بعد فقدان التأكيد تنجح دون تعديل مكرر.
- اسم الحساب والأحرف الأولى في الملف الشخصي والترويسة وDashboard تتبع لغة الواجهة، ثم الاسم باللغة الأخرى، ثم `full_name` التاريخي، ثم بديل موجود. واجهات القوائم القديمة التي لا تسترجع الحقلين تستمر في عرض اسم التوافق المتاح؛ البحث المتقدم في الأشخاص ضمن القرار24 التالي.
- فشل الحفظ لا يمسح حقول النموذج. تغيير الحساب يفصل نسخة النموذج، ولا ينعش طلب قديم ملفًا من مكوّن أُلغي تركيبه. لا يُدّعى وجود مزامنة حية؛ التحديث/إعادة المحاولة يكشف استكمال جهاز آخر.

## الأمان والترحيل

`artifacts/y-hub/supabase/migrations/0044_bilingual_profile_names.sql` فقط؛ لا تغيير لترحيل تاريخي ولا تطبيق على الإنتاج. مستقل عن0042/0043 في الفروع الأخرى. الحقول Nullable للحسابات القديمة عمدًا، مع CHECK للقيم المدخلة. لا تغييرات على RLS أو صلاحيات كتابة جدول users. RPC القديم لتعديل العمر/الهاتف/السنة لا يمنح تعديل الأسماء أو الدور/التخصص. لا معرف مستهدف في RPC الاستكمال، ولا مزامنة من metadata معدلة لاحقًا إلى الأسماء المخزنة.

دوال الكتابة SECURITY DEFINER بمسار بحث ثابت وفحص هوية، وEXECUTE مسحوب منPUBLIC/anon؛ مساعد التحقق ليس SECURITY DEFINER ولا يقرأ بيانات. أسماء الإدخال بيانات يكتبها صاحب الحساب، وليست إثباتًا لهوية قانونية. منع تعديلها في التطبيق لا يمنع مالك قاعدة البيانات من إصلاحها بإجراء إداري مستقل ومراجع.

قبل النشر: مراجعة سجل الترحيلات الإنتاجي وتنسيق نشر0044 وواجهة التسجيل. صفحات التسجيل القديمة المخبأة وعملاء إنشاء الحسابات الذين لا يرسلون الاسمين سيُرفضون بعد0044؛ لا يُنشر الترحيل منفردًا دون خطة تحديث العملاء. التدفقات الخارجية/الدعوات غير المستخدمة في التطبيق حاليًا تحتاج تحققًا منفصلًا إن فُعّلت. لا تسمح الواجهة بتصحيح اسم محفوظ؛ معالجة الأخطاء الإدارية ليست ميزة جديدة ضمن هذا العقد.

## المشاكل المثبتة أثناء التحقق

- الاسم الواحد ومحدودية RPC القديم مثبتان في main، فأضيف استكمال منفصل دون توسيع صلاحية تعديل الهوية.
- رمز SQLSTATE40001 التجريبي تسبب في إعادة محاولة PostgREST حتى انقطاع HTTP لحالتي التعارض. كشفته اختبارات Auth/HTTP الفعلية، رغم نجاح SQL المباشر. استُبدل بـ`PT409` (تعارض تطبيقي نهائي)، ونجحت حالتا التعارض والإعادة بعد الإصلاح. لم نرفع نسخة40001.
- أُصلح بناء fixture حسابين في اختبار Y-Sheets بعد إضافة metadata الجديدة؛ لم يُعطل الاختبار أو تتغير وظيفة Y-Sheets.
- جرى نقل تصحيح اختبار الحضور القديم الذي كان يتوقع كتابةexcused إلى العقد المدمج0040: رفضexcused مع حفظ الصف ثم اختبارpresent. هذا التصحيح نفسه متحقق سابقًا على فروع التقارير والمنح؛ لا تعديل جديد في منطق الحضور.

## حدود الإطلاق

Hosted Staging مع حسابات حقيقية معزولة: PENDING. اختبار Auth/PostgREST محلي حقيقي ليس بديلًا لاختبار إعداد Supabase المستضاف، تأكيد البريد/SMTP، ومصفوفة العملاء القديمة. اختبارات المتصفح تستخدم خدمات مصطنعة محظور عليها الاتصال بالخارج. لم يحدث نشر Edge أو تغيير بيانات إنتاج أو دمجmain. Vercel/Python bundle size: Known Deferred Issue دون تعديل.

## نتائج التحقق النهائية

| الفحص | النتيجة |
|---|---|
| `verify-architecture-refactor.sh` | EXIT0؛ TypeScript لكامل مساحة العمل، التدقيق المعماري وحدود المحركات/الوحدات والبناء PASS |
| Vitest الكامل | **2048 اختبارًا /237ملفًا** PASS؛ المدة158.36ث |
| Python | **36** PASS |
| اختبارات الحدود المعمارية | **8** PASS |
| المجموعة المستهدفة للأسماء/الملف/التسجيل | **39** PASS، جزء من إجمالي Vitest؛ إعادة اختبار نموذج الأسماء النهائي6PASS |
| SQL أكاديمي/صلاحيات/أسماء | **55** PASS، منها11اختبارًا جديدًا للأسماء |
| SQL الجامعة/الحضور/المنح/Live | **45** PASS |
| SQL Audit Log | **26** PASS |
| SQL الامتحانات | **20** PASS |
| SQL حذف المساقات | **9** PASS |
| SQL حفظ Y-Sheets | **10** PASS، إضافة إلى14assertionRLS تاريخية |
| Auth/JWT/PostgREST/SQL محلي فعلي | **58** PASS (5حضور+23عام+5أسماء+20Tutor+5Sheets)؛ إعادة اختبار الأسماء وحدها5PASS |
| جمع SQL0042+0043+0044 في snapshot محلي | **58** PASS، دون دمج فروعGit؛ دليل توافق وليس اختبارات إضافية مستقلة |
| Chromium | **3 سيناريوهات** PASS؛ ملف الطالب/الدكتور وهاتف/حاسوب ولغتان وثيمان والتسجيل الحالي |

إجمالي مجموعات SQL المباشرة165اختبارًا، والـ14assertion التاريخية منفصلة. لا تُجمع إعادات الفحص أو المجموعة المركبة مع الإجمالي لتضخيم العدد. لا فشل أو تجاوز في التشغيل النهائي. التشغيل الأول لـHTTP كان56نجاحًا/خطأين بسبب40001، وأعيد كاملًا بعد الإصلاح؛ تشغيلSheets الأول تعطل فيfixture ثم أعيد ونجح. SQL/RLS لا يكفي وحده؛ لهذا نُفذت اختبارات Auth المحلية الفعلية.

البناء الأول55.87ث. بعد استعادة أصناف تنسيق حقول التسجيل الأصلية أُعيدت سيناريوهات المتصفح الثلاثة والبناء. التحذيرات القائمة: حزمViteكبيرة، PDF.jslegacyفيNode، وStarlette/httpxdeprecation؛ لا تعطيل لاختبار أو تغيير حد تحذير.

الأدلة المحلية: `/workspace/names-full.log`, `names-sql-final.log`, `names-university.log`, `names-audit.log`, `names-exams.log`, `names-sheets.log`, `names-courses.log`, `names-http-final.log`, `names-combined.log`, `names-browser-final.log`, `names-build-final.log`. لقطات العرض في `/workspace/profile-names-screenshots/`؛ تُلتقط بعد تبديل اللغة للتحقق من تحديث الاسم.

## ملفات التنفيذ والاختبارات

- `artifacts/y-hub/src/contexts/AuthContext.tsx`
- `artifacts/y-hub/src/features/app-shell/domain/academicIdentity.ts`
- `artifacts/y-hub/src/features/dashboard/hooks/useDashboardController.ts`
- `artifacts/y-hub/src/features/login/__tests__/signUpValidation.test.ts`
- `artifacts/y-hub/src/features/login/components/LoginSignupFields.tsx`
- `artifacts/y-hub/src/features/login/domain/validateSignUpForm.ts`
- `artifacts/y-hub/src/features/login/hooks/useLoginController.ts`
- `artifacts/y-hub/src/features/login/types.ts`
- `artifacts/y-hub/src/features/profile/components/ProfileAccountInfo.tsx`
- `artifacts/y-hub/src/features/profile/components/ProfileNamesForm.tsx`
- `artifacts/y-hub/src/features/profile/components/ProfileSidebar.tsx`
- `artifacts/y-hub/src/features/profile/components/__tests__/ProfileNamesForm.test.tsx`
- `artifacts/y-hub/src/features/profile/hooks/useProfileController.ts`
- `artifacts/y-hub/src/features/profile/pages/ProfilePage.tsx`
- `artifacts/y-hub/src/i18n/loginCopy.ts`
- `artifacts/y-hub/src/shared/identity/__tests__/profileName.test.ts`
- `artifacts/y-hub/src/shared/identity/profileName.ts`
- `artifacts/y-hub/supabase/migrations/0044_bilingual_profile_names.sql`
- `artifacts/y-hub/supabase/tests/academic/test_profile_names.py`
- `artifacts/y-hub/supabase/tests/audit/test_audit.py`
- `artifacts/y-hub/supabase/tests/exams/test_attempts.py`
- `artifacts/y-hub/supabase/tests/integration/test_http.py`
- `artifacts/y-hub/supabase/tests/integration/test_profile_names.py`
- `artifacts/y-hub/supabase/tests/integration/test_tutor.py`
- `artifacts/y-hub/supabase/tests/integration/test_y_sheets.py`
- `artifacts/y-hub/supabase/tests/university/test_engine_grants.py`
- `artifacts/y-hub/supabase/tests/y-sheets/test_saves.py`
- `scripts/test-profile-names-browser.mjs`

التغييرات الإضافية وثائق هذه المجموعة، جدولPROGRESS، وتسليمAGENT_HANDOFF/REFACTOR_PROGRESS؛ تقارير الفروع السابقة نُسخت للاستمرارية فقط. لا تغييرات في خوارزميات المحركات أو ملفاتY-Sheetsالتنفيذية أو إعدادVercel. اختبارات الأنظمة الأخرى تغيرت بيانات إنشاء حساباتها فقط لتطابق شرط الاسمين، مع تصحيح اختبارexcusedالموثق أعلاه.

## نقطة GitHub المتحققة

رُفعت نقطة التحقق `f3f31c253e2fae043c66dd2c41def87d8b9c8577` على `feature/approved-bilingual-profiles`، وطابقها `git ls-remote`. Commit التوثيق التالي يحفظ هذه النتيجة؛ Git يحدد SHA النهائي. البناء الأخير بعد أصناف التنسيق PASS خلال55.82ث.

محاولة إنشاء Draft PR إلىmain باستخدام الوصف المحفوظ فشلت بالنص `Post "https://api.github.com/graphql": Forbidden`. لا رقمPRمؤكد لهذه المجموعة. [رابط إنشاء المراجعة](https://github.com/myazeed358-del/Y-hub/pull/new/feature/approved-bilingual-profiles) ليسPRمفتوحًا. وصف الطلب جاهز في`BILINGUAL_PROFILES_PR.md`. لا دمجmain أو تطبيقSQLعلىالإنتاج.
