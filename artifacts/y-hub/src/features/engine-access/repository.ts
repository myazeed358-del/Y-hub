import { supabase } from '@/utils/supabaseClient';
export interface Grant {id:string;course_id:string;student_id:string;engine_id:string;expires_at:string;revoked_at:string|null}
export const engineAccessRepository={
 async sections(){const {data,error}=await supabase.from('courses').select('id,title,section_label,instructor_id').order('title').limit(100);if(error)throw error;return data??[];},
 async roster(course:string){const {data,error}=await supabase.rpc('get_managed_course_enrollment_roster_v2',{p_course_id:course});if(error)throw error;return (data??[]) as {student_id:string;full_name:string}[];},
 async engines(){const {data,error}=await supabase.rpc('delegable_engines');if(error)throw error;return (data??[]).map((r:{module_id:string})=>r.module_id) as string[];},
 async grants(course:string){const {data,error}=await supabase.from('engine_grants').select('id,course_id,student_id,engine_id,expires_at,revoked_at').eq('course_id',course).order('created_at',{ascending:false}).limit(100);if(error)throw error;return (data??[]) as Grant[];},
 async grant(course:string,student:string,engine:string,expires:string){const {data,error}=await supabase.rpc('grant_engine_access',{p_course:course,p_student:student,p_engine:engine,p_expires:expires});if(error||typeof data!=='string')throw error??new Error('Grant not confirmed');return data;},
 async revoke(id:string){const {data,error}=await supabase.rpc('revoke_engine_access',{p_grant:id});if(error||data!==id)throw error??new Error('Revocation not confirmed');},
};
