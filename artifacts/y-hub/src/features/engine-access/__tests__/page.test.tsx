import '@testing-library/jest-dom/vitest';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
const state=vi.hoisted(()=>({role:'instructor',repo:{sections:vi.fn(),engines:vi.fn(),roster:vi.fn(),grants:vi.fn(),grant:vi.fn(),revoke:vi.fn()}}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'i'},role:state.role})}));
vi.mock('@/i18n/LanguageContext',()=>({useLanguage:()=>({language:'en'})}));
vi.mock('../repository',()=>({engineAccessRepository:state.repo}));
import Page from '../EngineAccessPage';
afterEach(cleanup);
beforeEach(()=>{vi.resetAllMocks();state.role='instructor';state.repo.sections.mockResolvedValue([{id:'c',title:'Calculus',section_label:'01'}]);state.repo.engines.mockResolvedValue(['linear-algebra']);state.repo.roster.mockResolvedValue([{student_id:'s',full_name:'Student Name'}]);state.repo.grants.mockResolvedValue([]);state.repo.grant.mockResolvedValue('grant');});
async function selectSection(){render(<Page/>);await screen.findByText('Calculus 01');fireEvent.change(screen.getByLabelText('Section'),{target:{value:'c'}});await screen.findByRole('option',{name:'Student Name'});}
it('uses the existing active roster and submits an explicit expiry',async()=>{
 await selectSection();fireEvent.change(screen.getByLabelText('Student'),{target:{value:'s'}});fireEvent.change(screen.getByLabelText('Engine'),{target:{value:'linear-algebra'}});fireEvent.change(screen.getByLabelText('Expires'),{target:{value:'2027-01-01T10:00'}});
 fireEvent.click(screen.getByRole('button',{name:'Grant access'}));await waitFor(()=>expect(state.repo.grant).toHaveBeenCalledWith('c','s','linear-algebra',new Date('2027-01-01T10:00').toISOString()));
});
it('shows a failed mutation and preserves entered choices',async()=>{
 state.repo.grant.mockRejectedValue(new Error('denied'));await selectSection();fireEvent.change(screen.getByLabelText('Student'),{target:{value:'s'}});fireEvent.change(screen.getByLabelText('Engine'),{target:{value:'linear-algebra'}});fireEvent.change(screen.getByLabelText('Expires'),{target:{value:'2027-01-01T10:00'}});fireEvent.click(screen.getByRole('button',{name:'Grant access'}));await screen.findByRole('alert');expect(screen.getByLabelText('Student')).toHaveValue('s');
});
it('does not offer instructor grants to an administrative reviewer',async()=>{state.role='admin';render(<Page/>);await screen.findByText('Calculus 01');fireEvent.change(screen.getByLabelText('Section'),{target:{value:'c'}});await screen.findByText('No grants for this section.');expect(screen.queryByRole('button',{name:'Grant access'})).not.toBeInTheDocument();});
it('retries the section directory after an initial connection failure',async()=>{
 state.repo.sections.mockRejectedValueOnce(new Error('offline'));render(<Page/>);await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'Refresh'}));expect(await screen.findByText('Calculus 01')).toBeTruthy();
});
it('loads later grant history pages without changing the section',async()=>{
 state.repo.grants.mockResolvedValue(Array.from({length:100},(_,i)=>({id:'g'+i,course_id:'c',student_id:'s',engine_id:'linear-algebra',expires_at:'2027-01-01T00:00:00Z',revoked_at:null})));
 await selectSection();fireEvent.click(screen.getByRole('button',{name:'Next grants'}));await waitFor(()=>expect(state.repo.grants).toHaveBeenCalledWith('c',100));expect(screen.getByLabelText('Section')).toHaveValue('c');
});
