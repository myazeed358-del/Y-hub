import {beforeEach,expect,it,vi} from 'vitest';
const rpc=vi.hoisted(()=>vi.fn());vi.mock('@/utils/supabaseClient',()=>({supabase:{rpc}}));
import {engineAccessRepository as repo} from '../repository';
beforeEach(()=>rpc.mockReset());
it('sends no actor or role claims and requires a confirmed grant',async()=>{
 rpc.mockResolvedValue({data:'grant-id',error:null});expect(await repo.grant('section','student','ode','date')).toBe('grant-id');
 expect(rpc).toHaveBeenCalledWith('grant_engine_access',{p_course:'section',p_student:'student',p_engine:'ode',p_expires:'date'});
});
it.each([{data:null,error:null},{data:null,error:{code:'42501'}}])('rejects unconfirmed grants',async result=>{rpc.mockResolvedValue(result);await expect(repo.grant('c','s','e','x')).rejects.toBeTruthy();});
it('does not claim a different revocation succeeded',async()=>{rpc.mockResolvedValue({data:'other',error:null});await expect(repo.revoke('id')).rejects.toThrow('not confirmed');});
it('accepts only the confirmed revoked identity',async()=>{rpc.mockResolvedValue({data:'id',error:null});await expect(repo.revoke('id')).resolves.toBeUndefined();});
