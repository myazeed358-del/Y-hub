import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({read:vi.fn(),mark:vi.fn(),rule:vi.fn(),role:'student',language:'en' as 'en'|'ar'}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'viewer'},role:state.role})}));
vi.mock('@/i18n/LanguageContext',()=>({useLanguage:()=>({language:state.language})}));
vi.mock('../services/completionRepository',async orig=>({...await orig<object>(),completionRepository:{read:state.read,mark:state.mark,rule:state.rule}}));
import {LessonProgressPanel} from '../components/LessonProgressPanel';
import {CompletionError} from '../services/completionRepository';
const topic={id:'topic',title:'Actual lesson',mode:'manual',examIds:[],ruleRevision:0,manual:null,revision:0,completed:false,fulfilled:0,updatedAt:null};
const data={courseId:'course',student:true,canManage:false,topics:[topic],exams:[{id:'exam',title:'Verified exam'}],examChoicesLimited:false};
beforeEach(()=>{vi.clearAllMocks();state.role='student';state.language='en';state.read.mockResolvedValue(data);state.mark.mockResolvedValue(1);state.rule.mockResolvedValue(1);});afterEach(cleanup);
it('does not write on viewing and completes using the current server revision',async()=>{
 render(<LessonProgressPanel courseId="course"/>);await screen.findByText('Actual lesson');expect(state.mark).not.toHaveBeenCalled();
 state.read.mockResolvedValue({...data,topics:[{...topic,revision:1,manual:true,completed:true}]});fireEvent.click(screen.getByText('Mark complete'));
 await screen.findByText('Mark incomplete');expect(state.mark).toHaveBeenCalledWith(topic,'completed');expect(screen.getByText('1 / 1').parentElement?.textContent).toBe('Completed: 1 / 1');
});
it('retains a failed choice for an idempotent retry and does not claim completion',async()=>{
 state.mark.mockRejectedValueOnce(new Error('private error'));render(<LessonProgressPanel courseId="course"/>);fireEvent.click(await screen.findByText('Mark complete'));
 await screen.findByRole('alert');expect(screen.getByText('0 / 1').parentElement?.textContent).toBe('Completed: 0 / 1');expect(screen.queryByText('private error')).toBeNull();
 fireEvent.click(screen.getByText('Mark complete'));await waitFor(()=>expect(state.mark).toHaveBeenCalledTimes(2));
});
it('shows cross-device conflicts and reloads current state',async()=>{
 state.mark.mockRejectedValueOnce(new CompletionError('conflict'));render(<LessonProgressPanel courseId="course"/>);fireEvent.click(await screen.findByText('Mark complete'));
 expect((await screen.findByRole('alert')).textContent).toContain('another device');fireEvent.click(screen.getByText('Reload completion'));await waitFor(()=>expect(state.read).toHaveBeenCalledTimes(2));
});
it('supports undoing automatic completion and returning to verified activities',async()=>{
 state.read.mockResolvedValue({...data,topics:[{...topic,completed:true,mode:'any',examIds:['exam'],fulfilled:1}]});render(<LessonProgressPanel courseId="course"/>);
 fireEvent.click(await screen.findByText('Mark incomplete'));await waitFor(()=>expect(state.mark).toHaveBeenCalledWith(expect.anything(),'incomplete'));
});
it('saves instructor conditions separately from syllabus content and grades',async()=>{
 state.role='instructor';state.read.mockResolvedValue({...data,student:false,canManage:true});render(<LessonProgressPanel courseId="course"/>);
 fireEvent.change(await screen.findByLabelText('Completion conditions: Actual lesson'),{target:{value:'all'}});fireEvent.click(screen.getByLabelText('Verified exam'));fireEvent.click(screen.getByText('Save conditions'));
 await waitFor(()=>expect(state.rule).toHaveBeenCalledWith(topic,'all',['exam']));expect(screen.queryByText('Mark complete')).toBeNull();
});
it('renders Arabic and clears old content on role change',async()=>{
 state.language='ar';const {rerender}=render(<LessonProgressPanel courseId="course"/>);await screen.findByText('Actual lesson');expect(screen.getByRole('region').getAttribute('dir')).toBe('rtl');
 expect(screen.getByText('0 / 1').getAttribute('dir')).toBe('ltr');expect(screen.getByText('0/0').getAttribute('dir')).toBe('ltr');
 const signal=state.read.mock.calls[0][1];state.role='instructor';state.read.mockRejectedValue(new Error('denied'));rerender(<LessonProgressPanel courseId="course"/>);
 expect(signal.aborted).toBe(true);await screen.findByRole('alert');expect(screen.queryByText('Actual lesson')).toBeNull();
});
it('keeps instructor conditions on a failed save without silently clearing unavailable activities',async()=>{
 state.role='instructor';state.read.mockResolvedValue({...data,student:false,canManage:true,topics:[{...topic,mode:'any',examIds:['removed-exam']}]});state.rule.mockRejectedValueOnce(new CompletionError('unavailable'));
 render(<LessonProgressPanel courseId="course"/>);const unavailable=await screen.findByLabelText('Unavailable activity; remove it to revise the conditions');
 expect((unavailable as HTMLInputElement).checked).toBe(true);fireEvent.click(screen.getByLabelText('Verified exam'));fireEvent.click(screen.getByText('Save conditions'));
 await screen.findByRole('alert');expect((screen.getByLabelText('Verified exam') as HTMLInputElement).checked).toBe(true);
 expect(state.rule).toHaveBeenCalledWith(expect.anything(),'any',['removed-exam','exam']);
});
