# القرار32 — التنقل السياقي

2026-10-26. الفرع `feature/approved-context-breadcrumbs` مبني مباشرة على main `06cabec3b1fee1b5cfe6a9457d9dd914a3398155`، دون دمج فروع التقارير أو المنح. توثيقها محفوظ فقط لاستمرارية جدول القرارات.

## التنفيذ

- أزيل مسار Academy الثابت من الترويسة. الصفحات الجذرية لا تعرض Breadcrumb، بينما عنوان الصفحة وزر القائمة باقيان.
- صفحات المساق والدرس والامتحان تعرض سياقًا معروفًا؛ AI Tutor يرتبط بواجهة المساق المناسبة للدور (`/view` للطالب، والمسار الإداري للموظفين). لا يفترض النظام أن الامتحان ينتمي لمساق مجهول، ولا يعرض UUID أو query/token أو اسمًا مخزنًا لشعبة سابقة.
- الوحدات ذات المسارات المتداخلة تُكتشف عبر سجل APIv2 الحالي، مع احترام سياسة الدور والتخصص والمنح والأذونات في العرض. لا تعديل لعقد الوحدات أو قوائم تسجيل مركزية.
- RTL عربي وLTR إنجليزي، روابط وصول بلوحة المفاتيح، `aria-current` للصفحة، وعنوان مستقل. الهاتف يظهر أقرب أب والصفحة فقط؛ سطح المكتب يعرض المسار الكامل. النص الطويل مقصوص بصريًا دون تجاوز العرض وتبقى التسمية الكاملة متاحة.
- عناوين Tutor/Exam أصبحت سياقية ومترجمة. لا تغييرات على المحركات، المساقات، أرقام الطلاب، Quick Access، Y-Sheets، RLS أو الخدمات. الروابط ليست تفويضًا: حراس المسارات والخادم الحاليون باقون.

## الملفات

`artifacts/y-hub/src/features/app-shell/`:
- إضافة `domain/breadcrumbs.ts` واختبار `__tests__/breadcrumbs.test.ts`.
- تعديل `domain/resolvePageTitle.ts`, `components/AppShellController.tsx`, `components/header/AppHeader.tsx`, `components/header/HeaderPageContext.tsx` واختباري الترويسة.
- إضافة `scripts/test-breadcrumbs-browser.mjs`، وتحديث جدول71 والحالة/التسليم والتقرير الحالي. تقارير المجموعات السابقة المنسوخة هي توثيق فقط وليست تنفيذًا مكررًا.

## حدود التحقق والنشر

اختبارات المتصفح تستخدم React والمسارات وCSS الفعلية مع Auth/HTTP اصطناعيين، وتحظر كل الاتصالات الخارجية. ليست إثبات اتصال Supabase حقيقي. لا تعديل لقاعدة البيانات في هذه المجموعة ولا حاجة إلى SQL جديد. Hosted Staging لجميع المجموعات السابقة ما زال PENDING؛ لا نشر إنتاج أو دمج main. مشكلة Vercel/Python المعروفة مؤجلة دون إعادة تشخيصها.

## التحقق النهائي

- `bash scripts/verify-architecture-refactor.sh`: EXIT0؛ **2049 Vitest /236ملف** (105.94ث)، **36 Python**، **8 اختبارات حدود معمارية**، جميع فحوص TypeScript لمساحة العمل والتدقيق المعماري والبناء الإنتاجي (51.32ث) PASS.
- مجموعة app-shell المستهدفة: **291 اختبارًا /28ملف** PASS (جزء من الإجمالي، لا يضاف إليه).
- متصفح Chromium: **4 حالات** PASS، عرض390/1280 والعربية/الإنجليزية والداكن/الفاتح والطالب/الدكتور؛ تحقق من إخفاء الجذر واختصار الأجداد وبقاء العنوان والاتجاه وعدم تجاوز الشاشة والنقر الفعلي للعودة. تمت معاينة لقطة الهاتف العربي.
- الفشل/التجاوز في التشغيل النهائي: **0**. لم تُعد SQL/HTTP suites لأن هذه المجموعة لا تغير خدمات أو صلاحيات أو SQL؛ لا تُنسب نتائج الفروع السابقة إليها.
- التحذيرات القائمة: PDF.js legacy build في Node، Starlette/httpx deprecation، وحزم Vite الكبيرة؛ لا فشل بناء. مشكلة نشر Vercel مؤجلة.
- الأدلة المحلية: `/workspace/breadcrumbs-full.log`, `breadcrumbs-targeted.log`, `breadcrumbs-browser.log` و`/workspace/breadcrumb-screenshots/`.

## GitHub

رُفعت نقطة التحقق `1c354d9a43827fa7716ab3747ce69c28121b108e` وتأكد تطابقها عبر `git ls-remote` على `feature/approved-context-breadcrumbs`. Commit التوثيق التالي يحفظ هذا الدليل؛ Git يحدد SHA النهائي.

محاولة `gh pr create --draft --base main --head feature/approved-context-breadcrumbs --body-file docs/approved-specifications/CONTEXT_BREADCRUMBS_PR.md` فشلت بالنص: `Post "https://api.github.com/graphql": Forbidden`. لا رقم PR مؤكد لهذه المجموعة. وصف الطلب جاهز والفرع موجود؛ [رابط إنشاء المراجعة](https://github.com/myazeed358-del/Y-hub/pull/new/feature/approved-context-breadcrumbs). هذا رابط إنشاء وليس PR مفتوحًا. لا دمج أو تعديل إنتاج.
