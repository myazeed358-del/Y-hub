import {supabase} from '@/utils/supabaseClient';
import {z} from 'zod';
const lecture=z.object({id:z.string().uuid(),course_id:z.string().uuid(),title:z.string(),starts_at:z.string(),ends_at:z.string(),cancelled:z.boolean()});
export type AcademicLecture=z.infer<typeof lecture>;
export async function academicRpc<T>(name:string,args:Record<string,unknown>,schema:z.ZodType<T>):Promise<T>{
 const {data,error}=await supabase.rpc(name,args);if(error)throw error;return schema.parse(data);
}
export const academicLectures={
 sections(){return academicRpc('my_online_lecture_sections',{},z.array(z.object({id:z.string(),title:z.string(),section_label:z.string().nullable()})));},
 async upcoming(course:string,offset=0){const {data,error}=await supabase.from('academic_lectures').select('id,course_id,title,starts_at,ends_at,cancelled').eq('course_id',course).eq('cancelled',false).eq('delivery_mode','online').gte('ends_at',new Date().toISOString()).order('starts_at').order('id').range(offset,offset+49);if(error)throw error;return z.array(lecture).parse(data);},
 async list(course:string,offset=0){const {data,error}=await supabase.from('academic_lectures').select('id,course_id,title,starts_at,ends_at,cancelled').eq('course_id',course).order('starts_at',{ascending:false}).order('id').range(offset,offset+49);if(error)throw error;return z.array(lecture).parse(data);},
 schedule(course:string,title:string,start:string,end:string){return academicRpc('schedule_academic_lecture',{p_course:course,p_title:title,p_start:start,p_end:end},z.string().uuid());},
 scheduleOnline(course:string,title:string,start:string,end:string){return academicRpc('schedule_online_lecture',{p_course:course,p_title:title,p_start:start,p_end:end},z.string().uuid());},
 cancel(id:string){return academicRpc('cancel_academic_lecture',{p_lecture:id},z.literal(id));},
};
