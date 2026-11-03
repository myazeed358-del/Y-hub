export const outlineCopy = {
  en: {
    title: "Chapters and topics",
    note: "Your instructor maps these names to indexed physical PDF pages. Printed book numbering is not inferred. Selecting several entries uses their combined pages.",
    loading: "Loading outline…",
    reload: "Reload outline",
    empty: "No current chapter or topic mapping.",
    stale:
      "This mapping belongs to an older file version. The instructor must map the indexed pages again.",
    mismatch:
      "The source changed. Reload references before selecting chapters.",
    pages: "PDF pages",
    chapter: "Chapter",
    topic: "Topic",
    edit: "Edit chapter mapping",
    save: "Save mapping",
    cancel: "Cancel editing",
    addChapter: "Add chapter",
    addTopic: "Add topic",
    remove: "Remove entry",
    name: "Name",
    parent: "Parent chapter",
    none: "No parent chapter",
    clear: "Use all indexed pages",
    invalid:
      "Check names and indexed pages. Topic pages must be within the parent chapter. Up to 50 entries are supported.",
    conflict:
      "The mapping changed. Reload references before retrying; your edit remains here.",
    denied: "Access to this outline was withdrawn.",
    error: "Could not load or save the mapping. Retry.",
    editNote:
      "Saving a changed mapping invalidates practice sessions created from its older chapters. Manual page scopes remain unchanged. Names are instructor-authored, not automatically detected.",
  },
  ar: {
    title: "الفصول والموضوعات",
    note: "يربط الدكتور هذه الأسماء بصفحات PDF الفعلية المفهرسة. لا يُستنتج ترقيم الكتاب المطبوع. عند اختيار عدة بنود تُجمع صفحاتها.",
    loading: "جارٍ تحميل الفهرس…",
    reload: "إعادة تحميل الفهرس",
    empty: "لا يوجد ربط حالي للفصول أو الموضوعات.",
    stale:
      "يرتبط هذا الفهرس بنسخة أقدم من الملف. يجب أن يعيد الدكتور ربط الصفحات المفهرسة.",
    mismatch: "تغير المصدر. أعد تحميل المراجع قبل اختيار الفصول.",
    pages: "صفحات PDF",
    chapter: "فصل",
    topic: "موضوع",
    edit: "تعديل ربط الفصول",
    save: "حفظ الربط",
    cancel: "إلغاء التحرير",
    addChapter: "إضافة فصل",
    addTopic: "إضافة موضوع",
    remove: "إزالة البند",
    name: "الاسم",
    parent: "الفصل الأب",
    none: "دون فصل أب",
    clear: "استخدام جميع الصفحات المفهرسة",
    invalid:
      "تحقق من الأسماء والصفحات المفهرسة. يجب أن تقع صفحات الموضوع ضمن الفصل الأب. الحد الأقصى ٥٠ بندًا.",
    conflict:
      "تغير الربط. أعد تحميل المراجع قبل المحاولة مجددًا؛ تعديلاتك ما زالت هنا.",
    denied: "سُحبت صلاحية الوصول إلى هذا الفهرس.",
    error: "تعذر تحميل الربط أو حفظه. أعد المحاولة.",
    editNote:
      "حفظ ربط مختلف يبطل جلسات التدريب المنشأة بفصوله القديمة. تبقى نطاقات الصفحات اليدوية كما هي. يسمي الدكتور الفصول والموضوعات؛ لا تُستنتج آليًا.",
  },
} as const;
