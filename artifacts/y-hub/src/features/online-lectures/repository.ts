import {z} from 'zod';
import {supabase} from '@/utils/supabaseClient';
export const lectureAccess={
 async join(lectureId:string){const {data,error}=await supabase.functions.invoke('lecture-access',{body:{action:'join',lectureId}});if(error)throw error;return z.object({url:z.string().startsWith('wss://'),token:z.string().min(20),moderator:z.boolean()}).parse(data);},
 async remove(lectureId:string,studentId:string,reason:string){const {data,error}=await supabase.functions.invoke('lecture-access',{body:{action:'remove',lectureId,studentId,reason}});if(error)throw error;z.object({blocked:z.literal(true)}).parse(data);},
};
