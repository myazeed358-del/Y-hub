import '@testing-library/jest-dom/vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({loadReport:vi.fn(),collectReport:vi.fn(),attendanceWorkbook:vi.fn(),downloadWorkbook:vi.fn(),printAttendance:vi.fn()}));
vi.mock('../reports/repository',async original=>({...await original<object>(),loadReport:mock.loadReport,collectReport:mock.collectReport}));
vi.mock('../reports/export',async original=>({...await original<object>(),attendanceWorkbook:mock.attendanceWorkbook,downloadWorkbook:mock.downloadWorkbook,printAttendance:mock.printAttendance}));
import {AttendanceReport} from '../AttendanceReport';
const row={id:'one',session_id:'session',student_id:'student',full_name:'طالب',user_number:'001234567',title:'Lecture',starts_at:'2026-10-25T12:00:00Z',status:'present',method:'manual',state:'closed'};
const data={rows:[row],total:1,revision:'a'.repeat(32),stats:{eligible:1,present:1,absent:0,excused:0},trend:[{day:'2026-10-25',eligible:1,present:1,absent:0,excused:0}]};
beforeEach(()=>{vi.clearAllMocks();mock.loadReport.mockResolvedValue(data);mock.collectReport.mockResolvedValue([row]);mock.attendanceWorkbook.mockResolvedValue(new ArrayBuffer(1));});afterEach(cleanup);
it('applies filters explicitly and resets server pagination',async()=>{
 mock.loadReport.mockResolvedValue({...data,total:101});render(<AttendanceReport course="course" version={0} ar={false}/>);
 await screen.findByText('001234567');fireEvent.click(screen.getByRole('button',{name:'Next'}));
 await waitFor(()=>expect(mock.loadReport).toHaveBeenLastCalledWith('course',expect.anything(),100));
 fireEvent.change(screen.getByLabelText('Name or student number'),{target:{value:'001234567'}});fireEvent.click(screen.getByText('Apply filters'));
 await waitFor(()=>expect(mock.loadReport).toHaveBeenLastCalledWith('course',expect.objectContaining({search:'001234567'}),0));
});
it('clears protected rows on access failure instead of showing cached data',async()=>{
 const view=render(<AttendanceReport course="course" version={0} ar={false}/>);await screen.findByText('001234567');
 mock.loadReport.mockRejectedValue(Error('denied'));view.rerender(<AttendanceReport course="course" version={1} ar={false}/>);
 await screen.findByRole('alert');expect(screen.queryByText('001234567')).toBeNull();
});
it('does not download a completed workbook after unmount/account switch',async()=>{
 let resolve!:(x:ArrayBuffer)=>void;mock.attendanceWorkbook.mockReturnValue(new Promise(r=>{resolve=r;}));
 const view=render(<AttendanceReport course="course" version={0} ar={false}/>);await screen.findByText('001234567');fireEvent.click(screen.getByText('Export Excel'));
 await waitFor(()=>expect(mock.attendanceWorkbook).toHaveBeenCalled());view.unmount();await act(async()=>resolve(new ArrayBuffer(1)));expect(mock.downloadWorkbook).not.toHaveBeenCalled();
});
it('reports failed export without generating a partial file',async()=>{
 mock.collectReport.mockRejectedValue(Error('changed'));render(<AttendanceReport course="course" version={0} ar={false}/>);await screen.findByText('001234567');fireEvent.click(screen.getByText('Export Excel'));
 await screen.findByRole('alert');expect(mock.downloadWorkbook).not.toHaveBeenCalled();
});
it('renders Arabic analytics with accessible server-derived chart values',async()=>{
 render(<AttendanceReport course="course" version={0} ar mode="analytics"/>);expect(await screen.findByRole('meter')).toHaveAttribute('value','0');expect(screen.getByText('نسبة الغياب')).toBeInTheDocument();expect(screen.queryByRole('table')).toBeNull();
});
it('uses the current filtered result for native PDF printing',async()=>{
 render(<AttendanceReport course="course" version={0} ar={false}/>);await screen.findByText('001234567');fireEvent.click(screen.getByText('PDF / Print'));
 await waitFor(()=>expect(mock.printAttendance).toHaveBeenCalledWith([row],false,expect.any(AbortSignal)));
});
