import { useLanguage } from '@/i18n/LanguageContext';
import type { RecoveryMergeConflict } from '../io/mergeRecovery';

/** Locations only; never renders cell contents or adds an overwrite action. */
export function RecoveryConflictDetails({ conflict }: { conflict: RecoveryMergeConflict }) {
  const ar = useLanguage().language === 'ar';
  const messages = {
    identity: ar ? 'تعذر الدمج لأن النسخ لا تخص الملف نفسه.' : 'Cannot merge copies of different files.',
    structure: ar ? 'تغيّرت بنية ورقة أو إعداداتها. راجعها يدويًا قبل الدمج.' : 'Sheet structure or settings changed. Review them manually before merging.',
    layout: ar ? 'تغيّر اسم ورقة أو عرض عمود أو ارتفاع صف بقيم مختلفة في النسختين. راجع الإعداد وتأكد من عدم تكرار أسماء الأوراق قبل الدمج.' : 'Both copies changed a sheet name, column width or row height differently. Review the setting and ensure sheet names remain unique before merging.',
    name: ar ? 'تغيّر اسم الملف بشكل مختلف في النسختين. راجع الاسم قبل الدمج.' : 'Both copies renamed the file differently. Review the name before merging.',
    cells: ar ? `توجد تعديلات متعارضة في ${conflict.totalCells} خلية.` : `Changes overlap in ${conflict.totalCells} cells.`,
  };
  return <div role="alert" tabIndex={0} className="y-sheets-workspace-error ys-recovery-conflict" dir={ar ? 'rtl' : 'ltr'}>
    <p>{messages[conflict.kind]}</p>
    {conflict.cells.length > 0 && <ul>{conflict.cells.map((cell, i) =>
      <li key={i}><bdi>{cell.sheetName}</bdi>: <bdi>{cell.address}</bdi></li>)}</ul>}
    {conflict.totalCells > conflict.cells.length && <p>{ar
      ? `تظهر أول ${conflict.cells.length} خلايا فقط.`
      : `Only the first ${conflict.cells.length} cells are shown.`}</p>}
    <p>{ar ? 'لم تُحفظ نتيجة الدمج. نسختك المحلية والملف السحابي محفوظان؛ يمكنك تنزيل المسودة للمراجعة.'
      : 'The merge was not saved. Your local copy and cloud file are retained; download the draft for review.'}</p>
  </div>;
}
