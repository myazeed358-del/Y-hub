import {z} from 'zod';
import {supabase} from '@/utils/supabaseClient';
const option=z.object({path:z.string(),moduleId:z.string(),title:z.object({ar:z.string(),en:z.string()}),icon:z.string(),dashboardOrder:z.number().nullable()});
export const quickSnapshot=z.object({revision:z.number().int().nonnegative(),paths:z.array(z.string()).max(3),available:z.array(option)});
export type QuickSnapshot=z.infer<typeof quickSnapshot>;
export const quickAccessRepository={
 async read():Promise<QuickSnapshot>{const {data,error}=await supabase.rpc('read_quick_access');if(error)throw error;return quickSnapshot.parse(data);},
 async save(revision:number,paths:string[]):Promise<number>{
  // Keep shortcuts unique and within the three-item limit.
  if(paths.length>3||new Set(paths).size!==paths.length)throw new Error('invalid');
  const {data,error}=await supabase.rpc('save_quick_access',{p_revision:revision,p_paths:paths});
  if(error)throw new Error(error.code==='PT409'?'conflict':'unavailable');
  if(!Number.isSafeInteger(data)||data<=revision)throw new Error('unconfirmed');return data;
 },
};
