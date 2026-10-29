vi.mock('../components/LessonProgressPanel',()=>({LessonProgressPanel:()=>null}));
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ language:'en' as 'en'|'ar', role:'student', id:'viewer', list:vi.fn(), read:vi.fn(), save:vi.fn() }));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:state.id ? {id:state.id}:null,role:state.role})}));
vi.mock('@/i18n/LanguageContext',()=>({useLanguage:()=>({language:state.language})}));
vi.mock('../services/learningPathRepository',()=>({listLearningSections:state.list}));
vi.mock('../services/syllabusRepository',async original=>({...await original<object>(),syllabusRepository:{read:state.read,save:state.save}}));
import { LearningPathPanel } from '../components/LearningPathPanel';
import { SyllabusError } from '../services/syllabusRepository';
const one={id:'section-one',title:'Same course',section_label:'01',academic_term:'Fall'}, two={...one,id:'section-two',section_label:'02'};
beforeEach(()=>{vi.resetAllMocks();state.language='en';state.role='student';state.id='viewer';state.list.mockResolvedValue({sections:[one,two],hasNext:false});state.read.mockImplementation(async id=>({courseId:id,revision:0,units:[{id:'unit',title:`Unit ${id}`,sections:[{id:'topic',title:`Topic ${id}`}]}]}));});
afterEach(cleanup);
it('requires an explicit section and reads its real topics by ID despite identical course names',async()=>{
 render(<LearningPathPanel />);await screen.findByLabelText('Section', { exact: true });expect(state.read).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Section', { exact: true }),{target:{value:one.id}});await screen.findByText('Topic section-one');
 expect(screen.getByText('Open section materials').getAttribute('href')).toBe('/course/section-one/view');
 fireEvent.change(screen.getByLabelText('Section', { exact: true }),{target:{value:two.id}});await screen.findByText('Topic section-two');
 expect(screen.queryByText('Topic section-one')).toBeNull();expect(state.save).not.toHaveBeenCalled();
 expect(screen.queryByRole('progressbar')).toBeNull();expect(screen.getByText(/counted from your saved choices/)).toBeTruthy();
});
it('clears selection on page changes and does not fetch every directory page',async()=>{
 state.list.mockResolvedValueOnce({sections:[one],hasNext:true});render(<LearningPathPanel />);
 fireEvent.change(await screen.findByLabelText('Section', { exact: true }),{target:{value:one.id}});await screen.findByText('Topic section-one');
 fireEvent.click(screen.getByText('Next sections'));await waitFor(()=>expect(state.list).toHaveBeenLastCalledWith('viewer','student',1,expect.any(AbortSignal)));
 expect(screen.queryByText('Topic section-one')).toBeNull();expect(state.read).toHaveBeenCalledTimes(1);
});
it('revalidates enrollment on focus and removes revoked sections without showing cached topics',async()=>{
 render(<LearningPathPanel />);fireEvent.change(await screen.findByLabelText('Section', { exact: true }),{target:{value:one.id}});await screen.findByText('Topic section-one');
 state.list.mockResolvedValueOnce({sections:[],hasNext:false});fireEvent.focus(window);
 await screen.findByText(/No sections are available/);expect(screen.queryByText('Topic section-one')).toBeNull();
});
it('clears content after a denied syllabus reload while preserving existing editing behavior elsewhere',async()=>{
 render(<LearningPathPanel />);fireEvent.change(await screen.findByLabelText('Section', { exact: true }),{target:{value:one.id}});await screen.findByText('Topic section-one');
 state.read.mockRejectedValueOnce(new SyllabusError('denied'));fireEvent.click(screen.getByText('Reload'));
 await screen.findByRole('alert');expect(screen.queryByText('Topic section-one')).toBeNull();
});
it('aborts old directory requests across accounts and ignores late responses',async()=>{
 let resolve!:(data:unknown)=>void;state.list.mockReturnValueOnce(new Promise(done=>{resolve=done;}));
 const {rerender}=render(<LearningPathPanel />);const signal=state.list.mock.calls[0][3];
 state.id='different';state.list.mockResolvedValue({sections:[],hasNext:false});rerender(<LearningPathPanel />);
 expect(signal.aborted).toBe(true);await act(async()=>resolve({sections:[one],hasNext:false}));
 await screen.findByText(/No sections are available/);expect(screen.queryByRole('combobox')).toBeNull();
});
it('shows safe errors, retries, and distinguishes a valid empty syllabus',async()=>{
 state.list.mockRejectedValueOnce(new Error('database secret'));render(<LearningPathPanel />);await screen.findByRole('alert');expect(screen.queryByText('database secret')).toBeNull();
 fireEvent.click(screen.getByText('Refresh sections'));await screen.findByLabelText('Section', { exact: true });
 state.read.mockResolvedValueOnce({courseId:one.id,revision:0,units:[]});fireEvent.change(screen.getByLabelText('Section', { exact: true }),{target:{value:one.id}});
 await screen.findByText('No syllabus has been added for this section.');expect(screen.queryByText(/Fuzzy/)).toBeNull();
});
it('supports Arabic RTL and the existing instructor route without enabling editing',async()=>{
 state.language='ar';state.role='instructor';render(<LearningPathPanel />);
 fireEvent.change(await screen.findByLabelText('الشعبة', { exact: true }),{target:{value:one.id}});await screen.findByText('Topic section-one');
 expect(screen.getByRole('region',{name:'مسارك الدراسي'}).getAttribute('dir')).toBe('rtl');
 expect(screen.getByText('فتح مواد الشعبة').getAttribute('href')).toBe('/course/section-one');expect(screen.queryByRole('textbox')).toBeNull();
});
it('does not fetch anonymous data',()=>{state.id='';render(<LearningPathPanel />);expect(state.list).not.toHaveBeenCalled();});
