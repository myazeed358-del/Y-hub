import {beforeEach,expect,it,vi} from 'vitest';
const rpc=vi.hoisted(()=>vi.fn());vi.mock('@/utils/supabaseClient',()=>({supabase:{rpc}}));
import {grantWorkflows} from '../workflowRepository';
beforeEach(()=>{rpc.mockReset();});
it('sends only target and selected engines, never trusted actor or role claims',async()=>{
 const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'];rpc.mockResolvedValue({data:ids,error:null});
 expect(await grantWorkflows.grant('c','s',['linear-algebra','ode'],null)).toEqual(ids);
 expect(rpc).toHaveBeenCalledWith('grant_engine_access_batch',{p_course:'c',p_student:'s',p_engines:['linear-algebra','ode'],p_expires:null});
});
it.each([null,[],['unknown'],['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001']])('rejects unconfirmed/partial/duplicate batch %j',async data=>{
 rpc.mockResolvedValue({data,error:null});await expect(grantWorkflows.grant('c','s',['ode','linear-algebra'],null)).rejects.toThrow();
});
it('propagates database authorization errors',async()=>{
 rpc.mockResolvedValue({data:null,error:{code:'42501'}});await expect(grantWorkflows.search('','name')).rejects.toEqual({code:'42501'});
});
it('sends active/history selection and paging to the server',async()=>{
 rpc.mockResolvedValue({data:{rows:[],total:0},error:null});await grantWorkflows.history('','',false,100);
 expect(rpc).toHaveBeenCalledWith('engine_grant_history',{p_course:null,p_student:null,p_active:false,p_offset:100});
});
