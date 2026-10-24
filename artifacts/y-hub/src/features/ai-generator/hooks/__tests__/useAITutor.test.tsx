import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {useAITutor} from '../useAITutor';
const mocks=vi.hoisted(()=>({user:'student-a',course:'section-a',reply:vi.fn(),listener:undefined as undefined|((event:string,session:unknown)=>void)}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:mocks.user}})}));
vi.mock('wouter',()=>({useRoute:()=>[true,{id:mocks.course}]}));
vi.mock('../../ai-chat/generateTutorReply',()=>({generateTutorReply:mocks.reply}));
vi.mock('@/utils/supabaseClient',()=>({supabase:{
 rpc:async()=>({data:true,error:null}),
 from:(table:string)=>({select:()=>({eq:()=>({single:async()=>({data:{id:mocks.course,title:'Section'},error:null}),order:async()=>({data:table==='ai_tutor_sources'?[{id:'s',title:'Lecture',kind:'pdf',status:'ready',material_id:'m'}]:[],error:null})})})}),
 auth:{onAuthStateChange:(listener:(event:string,session:unknown)=>void)=>{mocks.listener=listener;return{data:{subscription:{unsubscribe:vi.fn()}}};}}
}}));
beforeEach(()=>{mocks.user='student-a';mocks.course='section-a';mocks.reply.mockReset();});
afterEach(()=>cleanup());
it.each(['account','section'])('discards in-flight old %s replies',async kind=>{
 let resolve!:(value:unknown)=>void;mocks.reply.mockReturnValue(new Promise(r=>{resolve=r;}));
 const {result,rerender}=renderHook(()=>useAITutor());await waitFor(()=>expect(result.current.isLoading).toBe(false));
 act(()=>result.current.setInput('Explain'));let pending!:Promise<void>;act(()=>{pending=result.current.handleSend();});
 expect(result.current.messages).toHaveLength(1);
 if(kind==='account')mocks.user='student-b';else mocks.course='section-b';rerender();await waitFor(()=>expect(result.current.isLoading).toBe(false));
 await act(async()=>{resolve({id:'old',role:'ai',content:'Private old answer'});await pending;});
 expect(result.current.messages).toEqual([]);expect(result.current.input).toBe('');
});
it('clears protected conversation on session loss while waiting',async()=>{
 let resolve!:(value:unknown)=>void;mocks.reply.mockReturnValue(new Promise(r=>{resolve=r;}));const {result}=renderHook(()=>useAITutor());await waitFor(()=>expect(result.current.isLoading).toBe(false));
 act(()=>result.current.setInput('Explain'));let pending!:Promise<void>;act(()=>{pending=result.current.handleSend();});
 act(()=>mocks.listener?.('SIGNED_OUT',null));await act(async()=>{resolve({id:'old',role:'ai',content:'Private answer'});await pending;});
 expect(result.current.messages).toEqual([]);expect(result.current.isEnrolled).toBe(false);
});
