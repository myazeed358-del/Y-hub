import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),abort:vi.fn()}));
vi.mock('@/utils/supabaseClient',()=>({supabase:{rpc:mocks.rpc}}));
import {outlineRepository} from '../repository';
import {sourcesRepository} from '../../sourcesRepository';
import {practiceCitationSchema} from '../../sessionsRepository';
const id='00000000-0000-4000-8000-000000000001',revision='00000000-0000-4000-8000-000000000002';
const row={id,kind:'chapter' as const,title:'التفاضل',parentId:null,pages:[2]};
const data={sourceId:id,sourceRevision:revision,revision:1,canManage:false,stale:false,sections:[row]};
beforeEach(()=>{vi.resetAllMocks();mocks.rpc.mockReturnValue({abortSignal:mocks.abort});mocks.abort.mockResolvedValue({data,error:null});});
it('reads only the requested source and propagates cancellation',async()=>{
 const signal=new AbortController().signal;expect(await outlineRepository.read(id,signal)).toEqual(data);
 expect(mocks.rpc).toHaveBeenCalledWith('get_ai_practice_outline',{p_source:id});expect(mocks.abort).toHaveBeenCalledWith(signal);
 mocks.abort.mockResolvedValue({data:{...data,sourceId:revision},error:null});await expect(outlineRepository.read(id,signal)).rejects.toThrow();
});
it('saves bounded instructor metadata with both expected revisions and no supplied actor',async()=>{
 mocks.rpc.mockResolvedValue({data:2,error:null});expect(await outlineRepository.save(id,revision,1,[row])).toBe(2);
 expect(mocks.rpc).toHaveBeenCalledWith('set_ai_practice_outline',{p_source:id,p_source_revision:revision,p_revision:1,p_sections:[row]});
 await expect(outlineRepository.save(id,revision,1,[{...row,actor:id} as typeof row])).rejects.toThrow();expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
it.each([['PT409','conflict'],['42501','denied'],['PGRST301','denied'],['PGRST303','denied'],['XX000','unavailable']])('maps %s to a safe error',async(code,kind)=>{
 mocks.abort.mockResolvedValue({data:null,error:{code,message:'private SQL'}});await expect(outlineRepository.read(id,new AbortController().signal)).rejects.toMatchObject({kind});
});
it('rejects malformed catalogs and unacknowledged saves',async()=>{
 mocks.abort.mockResolvedValue({data:{...data,sections:[{...row,pages:[0]}]},error:null});await expect(outlineRepository.read(id,new AbortController().signal)).rejects.toThrow();
 mocks.rpc.mockResolvedValue({data:null,error:null});await expect(outlineRepository.save(id,revision,1,[])).rejects.toThrow();
});
it('retains strict source selection and legacy citation compatibility',async()=>{
 const pick={sourceId:id,revision,pages:[2],outline:{revision:1,ids:[id]}};
 mocks.abort.mockResolvedValue({data:{evidence:[],hasMore:false},error:null});const signal=new AbortController().signal;
 await sourcesRepository.preview(id,[pick],[],'',signal);expect(mocks.rpc.mock.calls[0][1].p_selection).toEqual([pick]);
 await expect(sourcesRepository.preview(id,[{...pick,outline:{...pick.outline,title:'forged'}}] as typeof pick[],[],'',signal)).rejects.toThrow();
 const citation={id,source_id:id,revision,title:'Book',text:'Text',page:2,unit_id:null};
 expect(practiceCitationSchema.parse(citation)).toEqual(citation);
 expect(practiceCitationSchema.parse({...citation,outline:[{id,kind:'chapter',title:'التفاضل'}]}).outline).toHaveLength(1);
 expect(()=>practiceCitationSchema.parse({...citation,outline:[{id,kind:'invented',title:'Fake'}]})).toThrow();
});
