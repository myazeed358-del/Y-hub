import {cleanup,fireEvent,render,screen,waitFor,act} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({read:vi.fn(),save:vi.fn(),language:'en' as 'ar'|'en'}));
vi.mock('@/i18n/LanguageContext',()=>({useLanguage:()=>({language:state.language})}));
vi.mock('../repository',()=>({outlineRepository:{read:state.read,save:state.save}}));
import {SourceOutline} from '../SourceOutline';
import {OutlineEditor} from '../OutlineEditor';
import {PracticeSourceError,type PracticeSource} from '../../sourcesRepository';
import {SourceEvidence} from '../../../knowledge/SourceEvidence';
const id='00000000-0000-4000-8000-000000000001',rev='00000000-0000-4000-8000-000000000002',topic='00000000-0000-4000-8000-000000000003';
const source:PracticeSource={id,revision:rev,title:'Book',kind:'pdf',status:'ready',role:'primary',policyRevision:1,pages:[2,4]};
const a={id,kind:'chapter' as const,title:'تفاضل Calculus',parentId:null,pages:[2,4]},b={id:topic,kind:'topic' as const,title:'Derivative',parentId:id,pages:[2]};
const outline={sourceId:id,sourceRevision:rev,revision:1,canManage:true,stale:false,sections:[a,b]};
const onChoose=vi.fn(),onChanged=vi.fn(),onDenied=vi.fn();
beforeEach(()=>{vi.resetAllMocks();state.language='en';state.read.mockResolvedValue(outline);state.save.mockResolvedValue(2);});afterEach(cleanup);
const view=(choice?:{revision:number;ids:string[]})=><SourceOutline source={source} disabled={false} choice={choice} onChoose={onChoose} onChanged={onChanged}/>;
async function open(){fireEvent.click(screen.getByRole('button',{name:'Chapters and topics: Book'}));await screen.findByLabelText(/Chapter: تفاضل/);}
it('loads lazily and combines selected chapter/topic pages without duplicates',async()=>{
 const v=render(view());expect(state.read).not.toHaveBeenCalled();await open();fireEvent.click(screen.getByLabelText(/Chapter: تفاضل/));expect(onChoose).toHaveBeenLastCalledWith({revision:1,ids:[id]},[2,4]);
 v.rerender(view({revision:1,ids:[id]}));fireEvent.click(screen.getByLabelText(/Topic: Derivative/));expect(onChoose).toHaveBeenLastCalledWith({revision:1,ids:[id,topic]},[2,4]);
 fireEvent.click(screen.getByText('Use all indexed pages'));expect(onChoose).toHaveBeenLastCalledWith(undefined,[]);
});
it('hides editing for students and removes cached names after access rejection',async()=>{
 state.read.mockResolvedValue({...outline,canManage:false});render(view());await open();expect(screen.queryByText('Edit chapter mapping')).toBeNull();
 state.read.mockRejectedValue(new PracticeSourceError('denied'));fireEvent.click(screen.getByText('Reload outline'));await screen.findByRole('alert');expect(screen.queryByLabelText(/Chapter: تفاضل/)).toBeNull();
});
it('rejects a response from another source generation',async()=>{
 state.read.mockResolvedValue({...outline,sourceRevision:id});render(view());fireEvent.click(screen.getByText('Chapters and topics: Book'));expect((await screen.findByRole('alert')).textContent).toContain('source changed');expect(screen.queryByLabelText(/Chapter:/)).toBeNull();
});
it('ignores late responses after closing and aborts the request',async()=>{
 let resolve!:(x:unknown)=>void;state.read.mockImplementation(()=>new Promise(r=>resolve=r));render(view());fireEvent.click(screen.getByText('Chapters and topics: Book'));await waitFor(()=>expect(state.read).toHaveBeenCalled());const signal=state.read.mock.calls[0][1];
 fireEvent.click(screen.getByText('Chapters and topics: Book'));expect(signal.aborted).toBe(true);await act(async()=>resolve(outline));expect(screen.queryByLabelText(/Chapter:/)).toBeNull();
});
it('does not silently reuse IDs from a stale outline revision',async()=>{
 render(view({revision:2,ids:[id]}));await open();expect(screen.getByRole('alert').textContent).toContain('mapping changed');expect((screen.getByLabelText(/Chapter:/) as HTMLInputElement).checked).toBe(false);
 fireEvent.click(screen.getByLabelText(/Topic:/));expect(onChoose).toHaveBeenLastCalledWith({revision:1,ids:[topic]},[2]);
});
function editor(){render(<OutlineEditor outline={outline} source={source} onSaved={onChanged} onCancel={vi.fn()} onDenied={onDenied}/>);}
it('validates actual indexed pages and parent containment before saving',async()=>{
 editor();fireEvent.change(screen.getByLabelText('PDF pages 1'),{target:{value:'2'}});fireEvent.change(screen.getByLabelText('PDF pages 2'),{target:{value:'4'}});fireEvent.click(screen.getByText('Save mapping'));expect(state.save).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toBeTruthy();
 fireEvent.change(screen.getByLabelText('PDF pages 2'),{target:{value:'3'}});fireEvent.click(screen.getByText('Save mapping'));expect(state.save).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('PDF pages 2'),{target:{value:'٢'}});fireEvent.click(screen.getByText('Save mapping'));await waitFor(()=>expect(onChanged).toHaveBeenCalledOnce());expect(state.save).toHaveBeenCalledWith(id,rev,1,[{...a,pages:[2]},b]);
});
it.each(['conflict','unavailable'] as const)('keeps edits and expected revision on %s and permits a retry',async(kind)=>{
 state.save.mockRejectedValueOnce(new PracticeSourceError(kind));editor();fireEvent.change(screen.getByLabelText('Name 1'),{target:{value:'Retained draft'}});fireEvent.click(screen.getByText('Save mapping'));await screen.findByRole('alert');
 expect((screen.getByLabelText('Name 1') as HTMLInputElement).value).toBe('Retained draft');expect(onChanged).not.toHaveBeenCalled();fireEvent.click(screen.getByText('Save mapping'));await waitFor(()=>expect(onChanged).toHaveBeenCalled());expect(state.save.mock.calls[1][2]).toBe(1);
});
it('clears privileged editing immediately on revoked authorization',async()=>{
 state.save.mockRejectedValue(new PracticeSourceError('denied'));render(view());await open();fireEvent.click(screen.getByText('Edit chapter mapping'));fireEvent.click(screen.getByText('Save mapping'));await screen.findByRole('alert');expect(screen.queryByLabelText('Name 1')).toBeNull();expect(screen.queryByLabelText(/Chapter:/)).toBeNull();
});
it('detaches surviving topics when their parent is removed',async()=>{
 editor();fireEvent.click(screen.getByText('Remove entry 1'));fireEvent.click(screen.getByText('Save mapping'));await waitFor(()=>expect(onChanged).toHaveBeenCalled());expect(state.save).toHaveBeenCalledWith(id,rev,1,[{...b,parentId:null}]);
});
it('supports Arabic labels with LTR numeric input and escaped citation names',()=>{
 state.language='ar';editor();expect(screen.getByLabelText('صفحات PDF 1').getAttribute('dir')).toBe('ltr');expect(screen.getByLabelText('الاسم 1').getAttribute('dir')).toBe('auto');
 const {container}=render(<SourceEvidence sources={[{id,source_id:id,revision:rev,title:'Book',text:'Evidence',page:2,unit_id:null,outline:[{id,kind:'chapter',title:'<img src=x onerror=alert(1)>'}]}]}/>);
 expect(container.querySelector('img')).toBeNull();expect(screen.getByText(/Chapter \/ فصل:/).textContent).toContain('<img');
});
