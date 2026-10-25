import {beforeEach,expect,it,vi} from 'vitest';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('@/shared/academic/lectures',()=>({academicRpc:rpc}));
import {collectReport,emptyFilters,filterArguments,loadReport} from '../reports/repository';
import {attendanceWorkbook,reportCells} from '../reports/export';
import * as XLSX from '@e965/xlsx';
const row={id:'one',session_id:'session',student_id:'student',full_name:'=HYPERLINK("secret")',user_number:'001234567',title:'<script>alert(1)</script>',starts_at:'2026-10-25T12:00:00Z',status:'present' as const,method:'manual',state:'closed'};
const page={rows:[row],total:1,revision:'a'.repeat(32),stats:{eligible:1,present:1,absent:0,excused:0},trend:[]};
beforeEach(()=>{rpc.mockReset();});
it('passes explicit filters and bounded pagination to the trusted RPC',async()=>{
 rpc.mockResolvedValue(page);await loadReport('course',{...emptyFilters,search:'  طالب  ',status:'absent',state:'closed',lecture:'lecture'},100);
 expect(rpc).toHaveBeenCalledWith('attendance_report_v2',expect.objectContaining({p_course:'course',p_offset:100,p_limit:100,p_search:'طالب',p_status:'absent',p_state:'closed',p_lecture:'lecture'}),expect.anything());
});
it('converts inclusive local calendar dates into half-open absolute boundaries',()=>{
 const a=filterArguments({...emptyFilters,from:'2026-10-25',to:'2026-10-25'});
 expect(new Date(a.p_from!).getDate()).toBe(25);expect(new Date(a.p_to!).getDate()).toBe(26);
 expect(()=>filterArguments({...emptyFilters,from:'2026-10-26',to:'2026-10-24'})).toThrow();
});
it('collects every page only when its checksum and total are unchanged',async()=>{
 rpc.mockResolvedValueOnce({...page,total:2}).mockResolvedValueOnce({...page,total:2,rows:[{...row,id:'two'}]});
 expect(await collectReport('course',emptyFilters,new AbortController().signal)).toHaveLength(2);
 expect(rpc.mock.calls[1][1].p_offset).toBe(1);
});
it.each([
 ['changed checksum',{...page,total:2,revision:'b'.repeat(32),rows:[{...row,id:'two'}]}],
 ['changed total',{...page,total:1}],
 ['missing page',{...page,total:2,rows:[]}],
 ['duplicate row',{...page,total:2}],
])('refuses partial export: %s',async(_,second)=>{
 rpc.mockResolvedValueOnce({...page,total:2}).mockResolvedValueOnce(second);
 await expect(collectReport('course',emptyFilters,new AbortController().signal)).rejects.toThrow();
});
it('bounds export before accumulating large reports',async()=>{
 rpc.mockResolvedValue({...page,total:10001});await expect(collectReport('course',emptyFilters,new AbortController().signal)).rejects.toThrow('10000');expect(rpc).toHaveBeenCalledTimes(1);
});
it('discards a page that arrives after context/account cancellation',async()=>{
 let resolve!:(x:unknown)=>void;rpc.mockImplementation(()=>new Promise(r=>{resolve=r;}));const controller=new AbortController();
 const pending=collectReport('course',emptyFilters,controller.signal);controller.abort();resolve(page);await expect(pending).rejects.toThrow();
});
it('does not export when later permission checks fail',async()=>{
 rpc.mockResolvedValueOnce({...page,total:2}).mockRejectedValueOnce(Error('42501'));
 await expect(collectReport('course',emptyFilters,new AbortController().signal)).rejects.toThrow('42501');
});
it('writes formula-like input as text and preserves leading zero student numbers in XLSX',async()=>{
 const bytes=await attendanceWorkbook([row],true);const book=XLSX.read(bytes,{type:'array'}),sheet=book.Sheets.Attendance;
 expect(sheet.A2.t).toBe('s');expect(sheet.A2.f).toBeUndefined();expect(sheet.A2.v).toBe(row.full_name);
 expect(sheet.B2.v).toBe('001234567');expect(sheet.C2.v).toBe(row.title);expect(sheet.E2.v).toBe('حاضر');
});
it('localizes report headers and distinguishes provisional/cancelled history',()=>{
 expect(reportCells([{...row,state:'open'}],false)[1][5]).toBe('Provisional');
 expect(reportCells([{...row,state:'cancelled',status:'excused'}],true)[1]).toContain('بعذر (تاريخي)');
});
