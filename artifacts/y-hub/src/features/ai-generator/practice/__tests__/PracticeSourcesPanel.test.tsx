import { cleanup,fireEvent,render,screen,waitFor,act } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
const state=vi.hoisted(()=>({read:vi.fn(),preview:vi.fn(),classify:vi.fn(),role:'student',language:'en' as 'ar'|'en'}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'viewer'},role:state.role})}));
vi.mock('@/i18n/LanguageContext',()=>({useLanguage:()=>({language:state.language})}));
vi.mock('../sourcesRepository',async orig=>({...await orig<object>(),sourcesRepository:{read:state.read,preview:state.preview,classify:state.classify}}));
vi.mock('../../knowledge/SourceEvidence',()=>({SourceEvidence:()=>null}));
import {PracticeSourcesPanel} from '../PracticeSourcesPanel';
import {PracticeSourceError} from '../sourcesRepository';
const book={id:'source',revision:'generation',title:'Approved book',kind:'pdf',status:'ready',role:'primary',policyRevision:1,pages:[2,4]};
const catalog={courseId:'course',primaryId:'source',canManage:false,limited:false,sources:[book,{...book,id:'pending',title:'Unreadable file',status:'unreadable',role:'lecture'}],units:[]};
beforeEach(()=>{vi.clearAllMocks();state.role='student';state.language='en';state.read.mockResolvedValue(catalog);state.preview.mockResolvedValue({evidence:[],hasMore:false});state.classify.mockResolvedValue(1);});afterEach(cleanup);
async function open(){render(<PracticeSourcesPanel courseId="course"/>);const details=screen.getByText('Practice references and scope').closest('details')!;details.open=true;fireEvent(details,new Event('toggle'));await screen.findByText('Select primary book');return details;}
it('loads lazily and selects the primary book without a generation request or write',async()=>{
 await open();expect(state.classify).not.toHaveBeenCalled();expect(state.preview).not.toHaveBeenCalled();
 fireEvent.click(screen.getByText('Select primary book'));expect(screen.getByLabelText('PDF pages: Approved book')).toBeTruthy();
 expect((screen.getByLabelText(/Unreadable file/) as HTMLInputElement).disabled).toBe(true);expect(screen.queryByText('Save role')).toBeNull();
});
it('validates pages and sends only the chosen scope',async()=>{
 await open();fireEvent.click(screen.getByText('Select primary book'));const input=screen.getByLabelText('PDF pages: Approved book');
 fireEvent.change(input,{target:{value:'3'}});fireEvent.click(screen.getByText('Preview passages'));await screen.findByRole('alert');expect(state.preview).not.toHaveBeenCalled();
 fireEvent.change(input,{target:{value:'٢،٤'}});fireEvent.click(screen.getByText('Preview passages'));await screen.findByText(/No indexed passages match/);
 expect(state.preview).toHaveBeenCalledWith('course',[{sourceId:'source',revision:'generation',pages:[2,4]}],[],'',expect.any(AbortSignal));
});
it('renders trusted math and removes stale evidence when scope changes',async()=>{
 state.preview.mockResolvedValue({evidence:[{id:'chunk',source_id:'source',revision:'generation',title:'Approved book',text:'اشتقاق $x^2$: $2x$',page:2,unit_id:null,score:1}],hasMore:false});
 await open();fireEvent.click(screen.getByText('Select primary book'));fireEvent.click(screen.getByText('Preview passages'));
 const region=await screen.findByRole('region',{name:'Verified passages'});expect(region.querySelector('.katex')).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Search within selected sources'),{target:{value:'new scope'}});expect(screen.queryByRole('region',{name:'Verified passages'})).toBeNull();
});
it('retains a rejected instructor choice and uses expected catalog primary',async()=>{
 state.role='instructor';state.read.mockResolvedValue({...catalog,canManage:true});state.classify.mockRejectedValueOnce(new PracticeSourceError('conflict'));
 await open();const select=screen.getByLabelText('Reference role: Approved book');fireEvent.change(select,{target:{value:'reference'}});fireEvent.click(screen.getAllByText('Save role')[0]);
 expect((await screen.findByRole('alert')).textContent).toContain('changed');expect((select as HTMLSelectElement).value).toBe('reference');expect(state.classify).toHaveBeenCalledWith(book,'reference','source');
});
it('clears source data when access is withdrawn instead of showing stale cached evidence',async()=>{
 state.preview.mockRejectedValue(new PracticeSourceError('denied'));await open();fireEvent.click(screen.getByText('Select primary book'));fireEvent.click(screen.getByText('Preview passages'));
 await screen.findByRole('alert');expect(screen.queryByLabelText(/Approved book/)).toBeNull();expect(screen.queryByRole('region',{name:'Verified passages'})).toBeNull();
});
it('aborts previews when closed and ignores an in-flight response after account scope changes',async()=>{
 let resolve!:(value:unknown)=>void;state.preview.mockImplementation(()=>new Promise(r=>{resolve=r;}));const details=await open();fireEvent.click(screen.getByText('Select primary book'));fireEvent.click(screen.getByText('Preview passages'));
 await waitFor(()=>expect(state.preview).toHaveBeenCalled());const signal=state.preview.mock.calls[0][4];details.open=false;fireEvent(details,new Event('toggle'));expect(signal.aborted).toBe(true);
 await act(async()=>resolve({evidence:[],hasMore:false}));expect(screen.queryByText(/No indexed passages match/)).toBeNull();
});
it('supports Arabic direction and keeps page numbers LTR',async()=>{
 state.language='ar';render(<PracticeSourcesPanel courseId="course"/>);const details=screen.getByText('مراجع التدريب ونطاقه').closest('details')!;details.open=true;fireEvent(details,new Event('toggle'));
 fireEvent.click(await screen.findByText('اختيار الكتاب الأساسي'));expect(screen.getByRole('region').getAttribute('dir')).toBe('rtl');expect(screen.getByLabelText('صفحات PDF: Approved book').getAttribute('dir')).toBe('ltr');
});
