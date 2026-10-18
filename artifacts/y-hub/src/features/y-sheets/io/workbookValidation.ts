import { z } from 'zod';
import type { WorkbookData } from '../types/workbook';
export const WORKBOOK_LIMITS = { bytes: 5 * 1024 * 1024, rows: 10000, columns: 256, cells: 50000, sheets: 32 } as const;
const index = z.number().int().min(0).max(WORKBOOK_LIMITS.rows - 1);
const text = z.string().max(32767);
const scalar = z.union([text, z.number().finite()]);
const range = z.object({ startRow:index,endRow:index,startCol:index,endCol:index });
const border = z.object({style:z.enum(['thin','medium','thick','double']),color:z.string().max(100)});
const style = z.object({bold:z.boolean().optional(),italic:z.boolean().optional(),underline:z.boolean().optional(),fontSize:z.number().min(1).max(500).optional(),fontFamily:z.string().max(200).optional(),textColor:z.string().max(100).optional(),backgroundColor:z.string().max(100).optional(),horizontalAlign:z.enum(['left','center','right']).optional(),verticalAlign:z.enum(['top','middle','bottom']).optional(),numberFormat:z.enum(['general','number','currency','percentage','text']).optional(),decimalPlaces:z.number().int().min(0).max(20).optional(),borderTop:border.optional(),borderBottom:border.optional(),borderLeft:border.optional(),borderRight:border.optional()});
const validation = z.object({type:z.enum(['list','wholeNumber','decimal','textLength']),operator:z.enum(['between','notBetween','equalTo','notEqualTo','greaterThan','lessThan','greaterThanOrEqualTo','lessThanOrEqualTo']).optional(),value1:scalar,value2:scalar.optional(),allowBlank:z.boolean().optional(),errorMessage:text.optional()});
const sheet = z.object({
  id:z.string().min(1).max(200),name:z.string().min(1).max(200),rowCount:z.number().int().min(1).max(WORKBOOK_LIMITS.rows),colCount:z.number().int().min(1).max(WORKBOOK_LIMITS.columns),
  cells:z.record(z.object({raw:text,computed:z.union([text,z.number().finite(),z.boolean(),z.null()]).optional(),style:style.optional(),error:text.optional()})),
  columnWidths:z.record(z.number().min(1).max(5000)),rowHeights:z.record(z.number().min(1).max(5000)),
  mergedCells:z.array(range.extend({id:z.string().max(200)})).max(10000),
  conditionalFormats:z.array(z.object({id:z.string().max(200),range,type:z.enum(['greaterThan','lessThan','equalTo','between','textContains']),value1:scalar,value2:scalar.optional(),style})).max(1000),
  validations:z.record(validation),hiddenRows:z.record(z.boolean()).optional(),
  filter:z.object({range,columns:z.record(z.object({col:index,selectedValues:z.array(text).max(10000),allSelected:z.boolean()}))}).optional(),
});
const schema=z.object({id:z.string().min(1).max(200),name:z.string().trim().min(1).max(200),sheets:z.array(sheet).min(1).max(WORKBOOK_LIMITS.sheets),activeSheetId:z.string(),version:z.number().int().min(1)});
export function parseWorkbookJSON(text: string): WorkbookData {
  if (new TextEncoder().encode(text).length > WORKBOOK_LIMITS.bytes) throw new Error('Workbook exceeds the 5 MiB limit.');
  const raw=JSON.parse(text,(key,value)=>{
    if (['__proto__','prototype','constructor'].includes(key)) throw new Error('Unsafe workbook key.');
    return value;
  });
  const result=schema.safeParse(raw);
  if (!result.success) throw new Error('Invalid workbook structure or unsupported size.');
  const wb=result.data;
  if (new Set(wb.sheets.map(s=>s.id)).size!==wb.sheets.length || !wb.sheets.some(s=>s.id===wb.activeSheetId)) throw new Error('Invalid sheet identity.');
  let cells=0;
  for (const s of wb.sheets) {
    const validCoord=(key:string)=>{
      if (!/^\d+,\d+$/.test(key)) return false;
      const [r,c]=key.split(',').map(Number); return r!<s.rowCount && c!<s.colCount;
    };
    if (Object.keys(s.cells).some(k=>!validCoord(k)) || Object.keys(s.validations).some(k=>!validCoord(k))) throw new Error('Cell outside sheet bounds.');
    for (const r of [...s.mergedCells,...s.conditionalFormats.map(c=>c.range),...(s.filter?[s.filter.range]:[])]) {
      if(r.startRow>r.endRow || r.startCol>r.endCol || r.endRow>=s.rowCount || r.endCol>=s.colCount) throw new Error('Range outside sheet bounds.');
    }
    cells+=Object.keys(s.cells).length;
  }
  if(cells>WORKBOOK_LIMITS.cells) throw new Error('Workbook has too many cells.');
  return wb;
}
export const validateWorkbook = (workbook: unknown) => parseWorkbookJSON(JSON.stringify(workbook));
