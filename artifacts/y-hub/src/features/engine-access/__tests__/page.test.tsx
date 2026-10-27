import '@testing-library/jest-dom/vitest';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
const state=vi.hoisted(()=>({role:'instructor',repo:{sections:vi.fn(),engines:vi.fn(),revoke:vi.fn()},workflows:{search:vi.fn(),history:vi.fn(),grant:vi.fn()}}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'i'},role:state.role})}));
vi.mock('@/i18n/LanguageContext',()=>({useLanguage:()=>({language:'en'})}));
vi.mock('../repository',()=>({engineAccessRepository:state.repo}));
vi.mock('../workflowRepository',()=>({grantWorkflows:state.workflows}));
import Page from '../EngineAccessPage';
const student={student_id:'s',full_name:'Student Name',user_number:'001234567',course_id:'c',title:'Calculus',section_label:'01',active_enrollment:true};
afterEach(cleanup);
beforeEach(()=>{vi.resetAllMocks();state.role='instructor';state.repo.sections.mockResolvedValue([{id:'c',title:'Calculus',section_label:'01'}]);state.repo.engines.mockResolvedValue(['linear-algebra','ode']);state.workflows.search.mockResolvedValue({rows:[student],total:1});state.workflows.history.mockResolvedValue({rows:[],total:0});state.workflows.grant.mockResolvedValue(['grant1','grant2']);});
async function selectStudent(){render(<Page/>);fireEvent.click(await screen.findByRole('button',{name:/Student Name/}));await screen.findByRole('checkbox',{name:'Linear Algebra'});}
it('selects multiple engines for one scoped student with optional enrollment lifetime',async()=>{
 await selectStudent();fireEvent.click(screen.getByRole('checkbox',{name:'Linear Algebra'}));fireEvent.click(screen.getByRole('checkbox',{name:'Differential Equations'}));fireEvent.click(screen.getByRole('button',{name:'Grant selected engines'}));
 await waitFor(()=>expect(state.workflows.grant).toHaveBeenCalledWith('c','s',['linear-algebra','ode'],null));
});
it('supports an explicit expiry without replacing the batch behavior',async()=>{
 await selectStudent();fireEvent.click(screen.getByRole('checkbox',{name:'Linear Algebra'}));fireEvent.click(screen.getByLabelText('Set an expiry date'));fireEvent.change(screen.getByLabelText('Expires'),{target:{value:'2027-01-01T10:00'}});fireEvent.click(screen.getByText('Grant selected engines'));
 await waitFor(()=>expect(state.workflows.grant).toHaveBeenCalledWith('c','s',['linear-algebra'],new Date('2027-01-01T10:00').toISOString()));
});
it('preserves selections after a failed grant acknowledgment',async()=>{
 state.workflows.grant.mockRejectedValue(Error('offline'));await selectStudent();fireEvent.click(screen.getByRole('checkbox',{name:'Linear Algebra'}));fireEvent.click(screen.getByText('Grant selected engines'));
 await screen.findByRole('alert');expect(screen.getByRole('checkbox',{name:'Linear Algebra'})).toBeChecked();
});
it('never offers new instructor grants to administrative reviewers',async()=>{
 state.role='admin';render(<Page/>);fireEvent.click(await screen.findByRole('button',{name:/Student Name/}));await screen.findByText('Student profile');expect(screen.queryByText('Grant selected engines')).toBeNull();
});
it('retries failed metadata loading',async()=>{
 state.repo.sections.mockRejectedValueOnce(Error('offline'));render(<Page/>);await screen.findByRole('alert');fireEvent.click(screen.getByText('Refresh'));expect(await screen.findByRole('option',{name:'Calculus 01'})).toBeInTheDocument();
});
it('searches across authorized sections and displays the immutable number',async()=>{
 render(<Page/>);await screen.findByText('001234567');fireEvent.change(screen.getByLabelText('Student name or number'),{target:{value:'001234567'}});fireEvent.click(screen.getByRole('button',{name:'Search'}));
 await waitFor(()=>expect(state.workflows.search).toHaveBeenLastCalledWith('','001234567',0));
});
it('disables granting for a historical enrollment while retaining its profile',async()=>{
 state.workflows.search.mockResolvedValue({rows:[{...student,active_enrollment:false}],total:1});await selectStudent();expect(screen.getByText('Grant selected engines')).toBeDisabled();
});
it('pages permissions on the server without changing scope',async()=>{
 state.workflows.history.mockResolvedValue({rows:[],total:101});render(<Page/>);fireEvent.click(await screen.findByText('Next page'));
 await waitFor(()=>expect(state.workflows.history).toHaveBeenLastCalledWith('','',true,100));
});
