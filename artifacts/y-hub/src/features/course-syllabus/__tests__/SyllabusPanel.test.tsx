import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
const state=vi.hoisted(()=>({language:'en' as 'en'|'ar',read:vi.fn(),save:vi.fn()}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'synthetic'}})}));
vi.mock('@/i18n/LanguageContext',()=>({useLanguage:()=>({language:state.language})}));
vi.mock('../services/syllabusRepository',async importOriginal=>({...await importOriginal<object>(),syllabusRepository:{read:state.read,save:state.save}}));
import { SyllabusPanel } from '../components/SyllabusPanel';
import { SyllabusError } from '../services/syllabusRepository';
beforeEach(()=>{state.language='en';vi.resetAllMocks();state.read.mockResolvedValue({courseId:'section',revision:0,units:[]});state.save.mockImplementation(async value=>({...value,revision:1}));});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('creates units/topics, reorders, confirms deletion and saves the edited section',async()=>{
 render(<SyllabusPanel courseId="section" editable />);
 await screen.findByText('No syllabus has been added for this section.');
 fireEvent.click(screen.getByText('Add unit'));fireEvent.change(screen.getByLabelText('Unit 1'),{target:{value:'Unit A'}});
 fireEvent.click(screen.getByText('Add topic'));fireEvent.change(screen.getByLabelText('Unit 1 Topic 1'),{target:{value:'Topic A'}});
 fireEvent.click(screen.getByText('Add unit'));fireEvent.change(screen.getByLabelText('Unit 2'),{target:{value:'Unit B'}});
 fireEvent.click(screen.getAllByText('Move up')[2]);expect((screen.getByLabelText('Unit 1') as HTMLInputElement).value).toBe('Unit B');
 vi.spyOn(window,'confirm').mockReturnValue(false);fireEvent.click(screen.getAllByText('Delete')[0]);expect(screen.getAllByRole('textbox')).toHaveLength(3);
 vi.mocked(window.confirm).mockReturnValue(true);fireEvent.click(screen.getAllByText('Delete')[0]);expect(screen.getAllByRole('textbox')).toHaveLength(2);
 await act(async()=>fireEvent.click(screen.getByText('Save syllabus')));
 expect(state.save.mock.calls[0][0].units[0].sections[0].title).toBe('Topic A');
});
it.each(['en','ar'] as const)('renders read-only section syllabus in %s',async language=>{
 state.language=language;state.read.mockResolvedValue({courseId:'section',revision:2,units:[{id:'u',title:'Actual unit',sections:[{id:'s',title:'Actual topic'}]}]});
 render(<SyllabusPanel courseId="section" />);await screen.findByText('Actual topic');
 expect(screen.queryByRole('textbox')).toBeNull();expect(screen.getByRole('region').getAttribute('dir')).toBe(language==='ar'?'rtl':'ltr');
});
it('conflict preserves editable draft and reload requires confirmation',async()=>{
 render(<SyllabusPanel courseId="section" editable />);await screen.findByText('No syllabus has been added for this section.');
 fireEvent.click(screen.getByText('Add unit'));fireEvent.change(screen.getByLabelText('Unit 1'),{target:{value:'Keep this'}});
 state.save.mockRejectedValue(new SyllabusError('conflict'));await act(async()=>fireEvent.click(screen.getByText('Save syllabus')));
 expect(screen.getByRole('alert').textContent).toContain('Your draft is retained');
 vi.spyOn(window,'confirm').mockReturnValue(false);fireEvent.click(screen.getByText('Reload'));expect((screen.getByLabelText('Unit 1') as HTMLInputElement).value).toBe('Keep this');
 vi.mocked(window.confirm).mockReturnValue(true);fireEvent.click(screen.getByText('Reload'));await waitFor(()=>expect(screen.queryByRole('textbox')).toBeNull());
});
