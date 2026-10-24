import {z} from 'zod';
import {supabase} from '@/utils/supabaseClient';
import {academicRpc} from '@/shared/academic/lectures';
const record=z.object({id:z.string(),session_id:z.string(),student_id:z.string(),full_name:z.string().nullable(),title:z.string(),starts_at:z.string(),status:z.enum(['present','absent','excused']),method:z.string(),state:z.string()});
const report=z.object({rows:z.array(record),total:z.number(),stats:z.object({eligible:z.number(),absent:z.number(),present:z.number(),excused:z.number()})});
export type AttendanceReport=z.infer<typeof report>;
export const attendanceRepository={
 sections(){return academicRpc('my_attendance_sections',{},z.array(z.object({id:z.string(),title:z.string(),section_label:z.string().nullable()})));},
 async session(lecture:string){const {data,error}=await supabase.from('attendance_sessions').select('id,state').eq('lecture_id',lecture).maybeSingle();if(error)throw error;return z.object({id:z.string(),state:z.enum(['open','closed'])}).nullable().parse(data);},
 open(lecture:string){return academicRpc('open_attendance',{p_lecture:lecture},z.string().uuid());},
 close(id:string){return academicRpc('close_attendance',{p_session:id},z.literal(id));},
 qr(id:string){return academicRpc('attendance_qr',{p_session:id},z.object({token:z.string(),expiresAt:z.string(),serverTime:z.string()}));},
 checkIn(token:string){return academicRpc('check_in_attendance',{p_token:token},z.string().uuid());},
 correct(session:string,student:string,status:string,reason:string){return academicRpc('correct_attendance',{p_session:session,p_student:student,p_status:status,p_reason:reason},z.string().uuid());},
 report(course:string,offset=0){return academicRpc('attendance_report',{p_course:course,p_offset:offset,p_limit:100},report);},
 sessionRoster(session:string){return academicRpc('attendance_session_roster',{p_session:session},z.array(z.object({student_id:z.string(),full_name:z.string().nullable()})));},
 async roster(course:string){return academicRpc('get_managed_course_enrollment_roster_v2',{p_course_id:course},z.array(z.object({student_id:z.string(),full_name:z.string().nullable()})));},
};
/** Formula-safe CSV; data stays within the authorized report RPC. */
export function attendanceCsv(rows:AttendanceReport['rows']){
 const cell=(value:string)=>'"'+(/^[\s]*[=+@\-\t\r]/.test(value)?"'"+value:value).replaceAll('"','""')+'"';
 return '\uFEFF'+[['Student','Student ID','Lecture','Date','Status'],...rows.map(r=>[r.full_name??'',r.student_id,r.title,r.starts_at,r.status])].map(row=>row.map(cell).join(',')).join('\r\n');
}
