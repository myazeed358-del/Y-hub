import { supabase } from '@/utils/supabaseClient';
import type { StudentDashboardCourse, StudentDashboardProfile } from '../types';
export const repository = {
 async currentUser(){return (await supabase.auth.getUser()).data.user},
 async profile(id:string){const {data}=await supabase.from('users').select('*').eq('id',id).single();return data as StudentDashboardProfile|null},
 async publishedCourses(){const {data}=await supabase.from('courses').select('*').eq('is_published',true).order('created_at',{ascending:false});return data as StudentDashboardCourse[]|null},
 async activeEnrollments(id:string){const {data}=await supabase.from('course_enrollments').select('course_id').eq('student_id',id).eq('status','active');return data as {course_id:string}[]|null},
 async enroll(courseId:string,studentId:string){const {error}=await supabase.from('course_enrollments').insert({course_id:courseId,student_id:studentId,status:'active'});return error}
};
