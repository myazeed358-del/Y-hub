import { afterEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from '@e965/xlsx';
import { zipSync, unzipSync, strToU8 } from 'fflate';
import { decodeWorkbook, encodeWorkbook } from '../io/xlsxCodec';
import { EXCEL_LIMITS, validateExcelContainer } from '../io/xlsxLimits';
import { runExcelTask } from '../io/xlsxAdapter';
import { createDefaultWorkbook } from '../state/defaultWorkbook';
import { validateWorkbook, parseWorkbookJSON } from '../io/workbookValidation';
import { parseCSV } from '../io/csvAdapter';
afterEach(() => vi.useRealTimers());
const simple = () => {
  const wb=createDefaultWorkbook();wb.sheets=wb.sheets.slice(0,1);
  wb.sheets[0]!.cells={
    '0,0':{raw:'12',computed:12,style:{numberFormat:'currency',decimalPlaces:2}},
    '1,0':{raw:'=A1*2',computed:24},
    '2,0':{raw:'00123',style:{numberFormat:'text'}},
    '3,0':{raw:'TRUE',computed:true},
  };
  wb.sheets[0]!.mergedCells=[{id:'merge',startRow:5,endRow:6,startCol:1,endCol:2}];
  wb.sheets[0]!.columnWidths={0:140};wb.sheets[0]!.rowHeights={0:30};
  return wb;
};
describe('bounded Excel conversion', () => {
  it('round-trips formulas, scalar data, merges, text/number formats and dimensions', () => {
    const restored=decodeWorkbook(encodeWorkbook(simple()));const sheet=restored.sheets[0]!;
    expect(sheet.cells['0,0']).toMatchObject({raw:'12',style:{numberFormat:'currency',decimalPlaces:2}});
    expect(sheet.cells['1,0']).toMatchObject({raw:'=A1*2',computed:24});
    expect(sheet.cells['2,0']).toMatchObject({raw:'00123',style:{numberFormat:'text'}});
    expect(sheet.cells['3,0']!.computed).toBe(true);
    expect(sheet.mergedCells[0]).toMatchObject({startRow:5,endRow:6,startCol:1,endCol:2});
    expect(sheet.columnWidths[0]).toBeCloseTo(140,0); expect(sheet.rowHeights[0]).toBe(30);
  });
  it('retains legacy XLS import with the patched parser', () => {
    const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Legacy',42]]),'Sheet1');
    const data=XLSX.write(book,{type:'array',bookType:'xls'});
    expect(decodeWorkbook(data).sheets[0]!.cells['0,1']!.raw).toBe('42');
    expect(XLSX.version).toBe('0.20.3');
  });
  it('handles a populated workbook of 10000 cells within the supported limits', () => {
    const wb=simple(),sheet=wb.sheets[0]!;sheet.cells={};sheet.rowCount=1000;
    for(let r=0;r<1000;r++)for(let c=0;c<10;c++)sheet.cells[`${r},${c}`]={raw:String(r+c)};
    expect(Object.keys(decodeWorkbook(encodeWorkbook(wb)).sheets[0]!.cells).length).toBe(10000);
  });
  it.each([new Uint8Array(),new Uint8Array([1,2,3]),new Uint8Array(EXCEL_LIMITS.inputBytes+1)])('rejects empty, corrupt or oversized input', bytes => {
    expect(() => decodeWorkbook(bytes)).toThrow();
  });
  it('rejects a truncated workbook and corrupt compressed data', () => {
    const bytes=encodeWorkbook(simple());
    expect(() => decodeWorkbook(bytes.subarray(0,bytes.length-5))).toThrow();
    bytes[100]=bytes[100]!^0xff;
    expect(() => decodeWorkbook(bytes)).toThrow();
  });
  it('rejects ZIP expansion bombs before parsing cell XML', () => {
    const bytes=zipSync({'[Content_Types].xml':strToU8('x'),'xl/workbook.xml':new Uint8Array(EXCEL_LIMITS.expandedBytes+1)});
    expect(bytes.length).toBeLessThan(EXCEL_LIMITS.inputBytes);
    expect(() => validateExcelContainer(bytes)).toThrow('20 MiB');
  });
  it('rejects XML entity declarations and excessive worksheet dimensions', () => {
    const files=unzipSync(encodeWorkbook(simple()));
    files['xl/workbook.xml']=strToU8('<!DOCTYPE workbook [<!ENTITY x "bad">]><workbook/>');
    expect(() => decodeWorkbook(zipSync(files))).toThrow('entities');
    const oversized=unzipSync(encodeWorkbook(simple()));
    const xml=new TextDecoder().decode(oversized['xl/worksheets/sheet1.xml']);
    oversized['xl/worksheets/sheet1.xml']=strToU8(xml.replace(/<dimension[^>]*\/>/,'<dimension ref="A1:XFD1048576"/>'));
    expect(() => decodeWorkbook(zipSync(oversized))).toThrow('dimensions');
  });
  it('rejects forbidden keys, invalid coordinates and incomplete CSV without replacing a document', () => {
    expect(() => parseWorkbookJSON('{"__proto__":{"polluted":true}}')).toThrow('Unsafe');
    const wb=simple();wb.sheets[0]!.cells['999999,0']={raw:'bad'};
    expect(() => validateWorkbook(wb)).toThrow('bounds');
    expect(() => parseCSV('"unclosed')).toThrow('unclosed');
    expect(() => parseCSV(Array(258).fill('x').join(','))).toThrow('limits');
    expect(({} as Record<string,unknown>).polluted).toBeUndefined();
  });
});
describe('worker lifecycle', () => {
  it('terminates parsing on timeout rather than blocking the page', async () => {
    vi.useFakeTimers();
    const worker={postMessage:vi.fn(),terminate:vi.fn()} as unknown as Worker;
    const result=runExcelTask({kind:'import',data:new ArrayBuffer(1)},() => worker);
    const assertion=expect(result).rejects.toThrow('15 seconds');
    await vi.advanceTimersByTimeAsync(EXCEL_LIMITS.timeoutMs);
    await assertion;expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
  it('terminates workers on success and parser failure', async () => {
    for(const ok of [true,false]) {
      const worker={postMessage:vi.fn(),terminate:vi.fn()} as unknown as Worker;
      const result=runExcelTask({kind:'export',workbook:simple()},() => worker);
      worker.onmessage!({data:{ok,result:'done',error:'corrupt'}} as MessageEvent);
      if(ok) expect(await result).toBe('done'); else await expect(result).rejects.toThrow('corrupt');
      expect(worker.terminate).toHaveBeenCalledTimes(1);
    }
  });
});
