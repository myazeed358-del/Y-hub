import {act,fireEvent,render,screen,waitFor,cleanup} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({qr:vi.fn(),session:vi.fn(),report:vi.fn(),checkIn:vi.fn(),sections:vi.fn(),roster:vi.fn(),toDataURL:vi.fn(),role:'student'}));
vi.mock('../repository',async importOriginal=>({...await importOriginal<object>(),attendanceRepository:mock}));
vi.mock('qrcode',()=>({default:{toDataURL:mock.toDataURL}}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'one'},role:mock.role})}));
vi.mock('@/i18n/LanguageContext',()=>({useLanguage:()=>({language:'en'})}));
import {attendanceCsv} from '../repository';
import {QrPanel} from '../QrPanel';
import AttendancePage from '../AttendancePage';
afterEach(()=>{cleanup();vi.useRealTimers();});
beforeEach(()=>{vi.clearAllMocks();mock.sections.mockResolvedValue([]);mock.role='student';mock.toDataURL.mockResolvedValue('data:image/png;base64,x');});
it('escapes spreadsheet formulas and quotes in report exports',()=>{
 const csv=attendanceCsv([{id:'1',session_id:'1',student_id:'s',full_name:'=danger()',title:'A,"B"',starts_at:'2026',status:'present',method:'qr',state:'closed'}]);
 expect(csv).toContain("\"'=danger()\"");expect(csv).toContain('"A,""B"""');
});
it('requires explicit confirmation after scanning and does not claim success on denial',async()=>{
 window.history.replaceState(null,'','/y-attendance#signed-token');mock.checkIn.mockRejectedValue(new Error('expired'));
 render(<AttendancePage/>);await waitFor(()=>expect(mock.sections).toHaveBeenCalled());expect(mock.checkIn).not.toHaveBeenCalled();expect(window.location.hash).toBe('');
 fireEvent.click(screen.getByText('Confirm attendance'));await waitFor(()=>expect(mock.checkIn).toHaveBeenCalledWith('signed-token'));
 expect(await screen.findByRole('alert')).toBeTruthy();expect(screen.queryByText('The server confirmed the request.')).toBeNull();
});
it('acknowledges a server-confirmed check-in',async()=>{
 mock.checkIn.mockResolvedValue('record-id');render(<AttendancePage/>);fireEvent.change(screen.getByRole('textbox'),{target:{value:'valid-token'}});fireEvent.click(screen.getByText('Confirm attendance'));
 expect(await screen.findByText('The server confirmed the request.')).toBeTruthy();
});
it('uses server time despite device clock skew and removes expired QR when fetch fails',async()=>{
 vi.useFakeTimers();mock.qr.mockResolvedValueOnce({token:'signed',serverTime:new Date(Date.now()-60000).toISOString(),expiresAt:new Date(Date.now()-50000).toISOString()}).mockRejectedValue(new Error('offline'));
 render(<QrPanel session="session" ar={false}/>);await act(async()=>{});expect(screen.getByRole('img')).toBeTruthy();
 await act(()=>vi.advanceTimersByTimeAsync(10100));expect(screen.queryByRole('img')).toBeNull();expect(screen.getByRole('alert')).toBeTruthy();
});
it('does not publish a QR response after unmount',async()=>{
 let resolve!:(x:unknown)=>void;mock.qr.mockReturnValue(new Promise(r=>resolve=r));const view=render(<QrPanel session="session" ar={false}/>);view.unmount();
 await act(async()=>{resolve({token:'old',serverTime:new Date(Date.now()).toISOString(),expiresAt:new Date(Date.now()+10000).toISOString()});});expect(screen.queryByRole('img')).toBeNull();
});
