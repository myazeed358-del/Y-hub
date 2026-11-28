import { z } from 'zod';
import { supabase } from '@/utils/supabaseClient';
import { DirectoryError } from '../workspace/directoryRepository';
const entry = z.object({id:z.string().uuid(),rootId:z.string().uuid(),kind:z.enum(['folder','workbook']),name:z.string(),deletedAt:z.string(),expiresAt:z.string(),fileCount:z.number().int().nonnegative(),folderCount:z.number().int().nonnegative()});
export type TrashEntry = z.infer<typeof entry>;
async function call(actor:string,name:string,args:Record<string,unknown>) {
  const user=await supabase.auth.getUser();
  if(user.error||user.data.user?.id!==actor)throw new DirectoryError('denied');
  const {data,error}=await supabase.rpc(name,{p_actor:actor,...args});
  if(error)throw new DirectoryError(error.code==='42501'?'denied':error.code==='PT409'?'conflict':error.code==='22023'?'invalid':'unavailable');
  return data;
}
export const trashRepository={
 async list(actor:string,offset=0){return z.array(entry).max(51).parse(await call(actor,'list_y_sheets_trash',{p_offset:offset}));},
 async trash(actor:string,kind:'workbook'|'folder',id:string,revision:number){return z.string().uuid().parse(await call(actor,'trash_y_sheets',{p_kind:kind,p_id:id,p_revision:revision}));},
 async restore(actor:string,id:string){return z.string().uuid().parse(await call(actor,'restore_y_sheets_trash',{p_entry:id}));},
 async purge(actor:string,id:string){await call(actor,'purge_y_sheets_trash',{p_entry:id});},
};
