import type { WorkbookData } from '../types/workbook';
import { EXCEL_LIMITS } from './xlsxLimits';
import { validateWorkbook } from './workbookValidation';
export type ExcelTask = {kind:'import';data:ArrayBuffer}|{kind:'export';workbook:WorkbookData};
/** Fresh worker per operation: timeout/error always terminates parsing and releases its state. */
export function runExcelTask<T>(task:ExcelTask, factory=() => new Worker(new URL('./xlsx.worker.ts',import.meta.url),{type:'module'})):Promise<T> {
  return new Promise((resolve,reject) => {
    const worker=factory();
    const finish=(error?:Error,result?:T) => { clearTimeout(timer);worker.terminate();error ? reject(error) : resolve(result!); };
    const timer=setTimeout(() => finish(new Error('Excel processing exceeded 15 seconds. Use a smaller file.')),EXCEL_LIMITS.timeoutMs);
    worker.onmessage=event => event.data.ok ? finish(undefined,event.data.result) : finish(new Error(event.data.error));
    worker.onerror=() => finish(new Error('Excel processing failed. Your current workbook was not changed.'));
    worker.onmessageerror=() => finish(new Error('Invalid Excel worker response.'));
    try { worker.postMessage(task,task.kind==='import' ? [task.data] : []); } catch(error) { finish(error instanceof Error ? error : new Error(String(error))); }
  });
}
export async function importWorkbookFromXLSX(data:ArrayBuffer|Uint8Array):Promise<WorkbookData> {
  if(!data.byteLength || data.byteLength>EXCEL_LIMITS.inputBytes) throw new Error('Excel file is empty or exceeds 5 MiB.');
  const buffer=new Uint8Array(data instanceof Uint8Array ? data : new Uint8Array(data)).buffer;
  return validateWorkbook(await runExcelTask<WorkbookData>({kind:'import',data:buffer}));
}
export async function exportWorkbookToXLSX(workbook:WorkbookData,filename='Workbook.xlsx'):Promise<void> {
  const bytes=await runExcelTask<Uint8Array>({kind:'export',workbook:validateWorkbook(workbook)});
  const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;
  try {document.body.appendChild(anchor);anchor.click();} finally {anchor.remove();URL.revokeObjectURL(url);}
}
