import { beforeEach,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),abort:vi.fn()}));
vi.mock('@/utils/supabaseClient',()=>({supabase:{rpc:mocks.rpc}}));
import {parsePages,sourcesRepository,type PracticeSource} from '../sourcesRepository';
const id='00000000-0000-4000-8000-000000000001',rev='00000000-0000-4000-8000-000000000002';
const source:PracticeSource={id,revision:rev,title:'Book',kind:'pdf',status:'ready',role:'lecture',policyRevision:0,pages:[2,4,5,6]};
beforeEach(()=>{vi.resetAllMocks();mocks.rpc.mockReturnValue({abortSignal:mocks.abort});});
it('accepts explicit physical page lists/ranges with Arabic digits and no guessed gaps',()=>{
 expect(parsePages('٢،۴-۶,2',source.pages)).toEqual([2,4,5,6]);expect(parsePages('',source.pages)).toEqual([]);
 for(const input of ['1','2-4','0','301','6-4','2.5','2,','Infinity','2-999','<script>'])expect(()=>parsePages(input,source.pages)).toThrow();
});
it('loads a validated scoped catalog and propagates cancellation',async()=>{
 const data={courseId:id,primaryId:null,canManage:false,limited:false,sources:[source],units:[]};mocks.abort.mockResolvedValue({data,error:null});const signal=new AbortController().signal;
 expect(await sourcesRepository.read(id,signal)).toEqual(data);expect(mocks.rpc).toHaveBeenCalledWith('get_ai_practice_sources',{p_course:id});expect(mocks.abort).toHaveBeenCalledWith(signal);
 mocks.abort.mockResolvedValue({data:{...data,courseId:rev},error:null});await expect(sourcesRepository.read(id,signal)).rejects.toThrow();
});
it('sends IDs, revisions and scope without accepting client evidence',async()=>{
 mocks.abort.mockResolvedValue({data:{evidence:[],hasMore:false},error:null});const selection=[{sourceId:id,revision:rev,pages:[2]}];
 await sourcesRepository.preview(id,selection,[],'المشتقة',new AbortController().signal);
 expect(mocks.rpc).toHaveBeenCalledWith('preview_ai_practice_sources',{p_course:id,p_selection:selection,p_units:[],p_query:'المشتقة'});
 await expect(sourcesRepository.preview(id,[{...selection[0],text:'forged'}] as typeof selection,[],'',new AbortController().signal)).rejects.toThrow();
});
it('rejects evidence outside the requested source generation/page/unit',async()=>{
 const e={id,source_id:id,revision:rev,title:'Book',text:'Evidence',page:2,unit_id:null,score:1};const selection=[{sourceId:id,revision:rev,pages:[2]}];const signal=new AbortController().signal;
 mocks.abort.mockResolvedValue({data:{evidence:[e],hasMore:false},error:null});expect((await sourcesRepository.preview(id,selection,[],'',signal)).evidence).toHaveLength(1);
 for(const wrong of [{...e,revision:id},{...e,source_id:rev},{...e,page:4},{...e,text:''}]){
  mocks.abort.mockResolvedValue({data:{evidence:[wrong],hasMore:false},error:null});await expect(sourcesRepository.preview(id,selection,[],'',signal)).rejects.toThrow();
 }
 mocks.abort.mockResolvedValue({data:{evidence:[e],hasMore:false},error:null});await expect(sourcesRepository.preview(id,selection,[rev],'',signal)).rejects.toThrow();
});
it('classifies with both CAS revision and expected primary identity',async()=>{
 mocks.rpc.mockResolvedValue({data:1,error:null});expect(await sourcesRepository.classify(source,'primary',null)).toBe(1);
 expect(mocks.rpc).toHaveBeenCalledWith('set_ai_practice_reference',{p_source:id,p_source_revision:rev,p_expected_revision:0,p_role:'primary',p_expected_primary:null});
});
it('distinguishes terminal conflicts, revoked access and uncertain network errors',async()=>{
 for(const [code,kind] of [['PT409','conflict'],['42501','denied'],['PGRST301','denied'],['XX000','unavailable']]){
  mocks.rpc.mockResolvedValue({data:null,error:{code}});await expect(sourcesRepository.classify(source,'primary',null)).rejects.toMatchObject({kind});
 }
});
