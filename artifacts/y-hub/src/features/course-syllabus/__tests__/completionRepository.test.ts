import {beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({rpc:vi.fn(),abortSignal:vi.fn()}));vi.mock('@/utils/supabaseClient',()=>({supabase:{rpc:state.rpc}}));
import {completionRepository,type CompletionTopic} from '../services/completionRepository';
const id='00000000-0000-4000-8000-000000000001';
const topic:CompletionTopic={id,title:'Topic',mode:'manual',examIds:[],ruleRevision:2,manual:null,revision:3,completed:false,fulfilled:0,updatedAt:null};
beforeEach(()=>vi.resetAllMocks());
it('reads a scoped validated snapshot with cancellation',async()=>{
 state.rpc.mockReturnValue({abortSignal:state.abortSignal});const data={courseId:id,student:true,canManage:false,topics:[topic],exams:[],examChoicesLimited:false};state.abortSignal.mockResolvedValue({data,error:null});
 const signal=new AbortController().signal;expect(await completionRepository.read(id,signal)).toEqual(data);expect(state.rpc).toHaveBeenCalledWith('read_lesson_progress',{p_course:id});expect(state.abortSignal).toHaveBeenCalledWith(signal);
});
it('never submits a claimed student identity or a client grade',async()=>{
 state.rpc.mockResolvedValue({data:4,error:null});await completionRepository.mark(topic,'incomplete');expect(state.rpc).toHaveBeenCalledWith('set_lesson_completion',{p_topic:id,p_expected_revision:3,p_state:'incomplete'});
});
it('clears activity IDs when returning a rule to manual mode',async()=>{
 state.rpc.mockResolvedValue({data:3,error:null});await completionRepository.rule(topic,'manual',[id]);expect(state.rpc).toHaveBeenCalledWith('set_lesson_completion_rule',{p_topic:id,p_expected_revision:2,p_mode:'manual',p_exam_ids:[]});
});
it('distinguishes real database conflicts from uncertain failures',async()=>{
 state.rpc.mockResolvedValue({data:null,error:{code:'PT409'}});await expect(completionRepository.mark(topic,'completed')).rejects.toMatchObject({kind:'conflict'});
 state.rpc.mockResolvedValue({data:null,error:{message:'secret'}});await expect(completionRepository.mark(topic,'completed')).rejects.toMatchObject({kind:'unavailable'});
});
it('rejects malformed successful acknowledgments',async()=>{state.rpc.mockResolvedValue({data:null,error:null});await expect(completionRepository.mark(topic,'completed')).rejects.toThrow();});
