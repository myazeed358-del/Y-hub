import {beforeEach,expect,it,vi} from 'vitest';
const {rpc,from,range,order}=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),range:vi.fn(),order:vi.fn()}));vi.mock('@/utils/supabaseClient',()=>({supabase:{rpc,from}}));
import {engineAccessRepository as repo} from '../repository';
beforeEach(()=>{vi.resetAllMocks();const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),order,range};order.mockReturnValue(query);from.mockReturnValue(query);});
it('sends no actor or role claims and requires a confirmed grant',async()=>{
 rpc.mockResolvedValue({data:'grant-id',error:null});expect(await repo.grant('section','student','ode','date')).toBe('grant-id');
 expect(rpc).toHaveBeenCalledWith('grant_engine_access',{p_course:'section',p_student:'student',p_engine:'ode',p_expires:'date'});
});
it.each([{data:null,error:null},{data:null,error:{code:'42501'}}])('rejects unconfirmed grants',async result=>{rpc.mockResolvedValue(result);await expect(repo.grant('c','s','e','x')).rejects.toBeTruthy();});
it('does not claim a different revocation succeeded',async()=>{rpc.mockResolvedValue({data:'other',error:null});await expect(repo.revoke('id')).rejects.toThrow('not confirmed');});
it('accepts only the confirmed revoked identity',async()=>{rpc.mockResolvedValue({data:'id',error:null});await expect(repo.revoke('id')).resolves.toBeUndefined();});

it('loads all section directory pages in stable order',async()=>{
 const page=Array.from({length:100},(_,i)=>({id:String(i)}));range.mockResolvedValueOnce({data:page,error:null}).mockResolvedValueOnce({data:[{id:'last'}],error:null});
 expect(await repo.sections()).toHaveLength(101);expect(range.mock.calls).toEqual([[0,99],[100,199]]);expect(order).toHaveBeenCalledWith('id');
});
it('pages grant history on the server and propagates query failures',async()=>{
 range.mockResolvedValueOnce({data:[],error:null}).mockResolvedValueOnce({data:null,error:{code:'42501'}});
 expect(await repo.grants('c',100)).toEqual([]);expect(range).toHaveBeenCalledWith(100,199);expect(order).toHaveBeenCalledWith('id');await expect(repo.grants('c')).rejects.toEqual({code:'42501'});
});
