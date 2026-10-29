import { z } from 'zod';
import { supabase } from '@/utils/supabaseClient';
const topic = z.object({ id:z.string().uuid(), title:z.string(), mode:z.enum(['manual','all','any']), examIds:z.array(z.string().uuid()).max(20), ruleRevision:z.number().int().nonnegative(), manual:z.boolean().nullable(), revision:z.number().int().nonnegative(), completed:z.boolean(), fulfilled:z.number().int().nonnegative(), updatedAt:z.string().nullable() });
export const progressSchema=z.object({courseId:z.string().uuid(),student:z.boolean(),canManage:z.boolean(),topics:z.array(topic).max(1000),exams:z.array(z.object({id:z.string().uuid(),title:z.string()})).max(200),examChoicesLimited:z.boolean()});
export type LessonProgress=z.infer<typeof progressSchema>;
export type CompletionTopic=z.infer<typeof topic>;
export class CompletionError extends Error {constructor(readonly kind:'conflict'|'unavailable'){super(kind);}}
async function change(name:string,args:Record<string,unknown>){
 const {data,error}=await supabase.rpc(name,args);
 if(error)throw new CompletionError(error.code==='PT409'?'conflict':'unavailable');
 return z.number().int().nonnegative().parse(data);
}
export const completionRepository={
 async read(courseId:string,signal:AbortSignal){
  const {data,error}=await supabase.rpc('read_lesson_progress',{p_course:courseId}).abortSignal(signal);
  if(error)throw new CompletionError('unavailable');
  const result=progressSchema.parse(data);if(result.courseId!==courseId)throw new CompletionError('unavailable');return result;
 },
 mark(topic:CompletionTopic,state:'completed'|'incomplete'|'automatic'){return change('set_lesson_completion',{p_topic:topic.id,p_expected_revision:topic.revision,p_state:state});},
 rule(topic:CompletionTopic,mode:CompletionTopic['mode'],examIds:string[]){return change('set_lesson_completion_rule',{p_topic:topic.id,p_expected_revision:topic.ruleRevision,p_mode:mode,p_exam_ids:mode==='manual'?[]:examIds});},
};
