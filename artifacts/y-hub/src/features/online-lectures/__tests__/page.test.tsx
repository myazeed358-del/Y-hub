import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({role:'student',sections:vi.fn(),upcoming:vi.fn(),scheduleOnline:vi.fn()}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'one'},role:mocks.role})}));
vi.mock('@/i18n/LanguageContext',()=>({useLanguage:()=>({language:'en'})}));
vi.mock('@/shared/academic/lectures',()=>({academicLectures:mocks}));
vi.mock('../LectureRoom',()=>({LectureRoom:()=> <p>Secure room component</p>}));
import Page from '../OnlineLecturesPage';
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();mocks.role='student';mocks.sections.mockResolvedValue([{id:'c',title:'Section one',section_label:'1'}]);mocks.upcoming.mockResolvedValue([{id:'l',course_id:'c',title:'Lecture',starts_at:'2026-10-22T12:00:00Z',ends_at:'2026-10-22T13:00:00Z',cancelled:false}]);});
it('shows enrolled student lectures without scheduling controls',async()=>{
 render(<Page/>);await screen.findByText('Section one 1');fireEvent.change(screen.getByRole('combobox'),{target:{value:'c'}});await screen.findByText('Lecture');expect(screen.queryByText('Schedule lecture')).toBeNull();fireEvent.click(screen.getByText('Join'));expect(screen.getByText('Secure room component')).toBeTruthy();
});
it('uses the dedicated online scheduling RPC rather than creating an in-person lecture',async()=>{
 mocks.role='instructor';mocks.scheduleOnline.mockResolvedValue('new');render(<Page/>);await screen.findByText('Section one 1');fireEvent.change(screen.getByRole('combobox'),{target:{value:'c'}});
 fireEvent.change(await screen.findByLabelText('Title'),{target:{value:'Online lesson'}});fireEvent.change(screen.getByLabelText('Start'),{target:{value:'2026-10-22T14:00'}});fireEvent.change(screen.getByLabelText('End'),{target:{value:'2026-10-22T15:00'}});fireEvent.click(screen.getByText('Schedule'));
 await waitFor(()=>expect(mocks.scheduleOnline).toHaveBeenCalledWith('c','Online lesson',expect.any(String),expect.any(String)));
});
it('retains the form after an unconfirmed server mutation',async()=>{
 mocks.role='instructor';mocks.scheduleOnline.mockRejectedValue(new Error('offline'));render(<Page/>);await screen.findByText('Section one 1');fireEvent.change(screen.getByRole('combobox'),{target:{value:'c'}});
 fireEvent.change(await screen.findByLabelText('Title'),{target:{value:'Retained'}});fireEvent.change(screen.getByLabelText('Start'),{target:{value:'2026-10-22T14:00'}});fireEvent.change(screen.getByLabelText('End'),{target:{value:'2026-10-22T15:00'}});fireEvent.click(screen.getByText('Schedule'));await screen.findByRole('alert');expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Retained');
});
