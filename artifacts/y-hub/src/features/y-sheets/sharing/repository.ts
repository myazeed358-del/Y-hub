import { z } from 'zod';
import { supabase } from '@/utils/supabaseClient';
import { validateWorkbook } from '../io/workbookValidation';
import type { WorkbookData } from '../types/workbook';
import { WorkbookStorageError } from '../integration/storageErrors';
const person = z.object({ id: z.string().uuid(), number: z.string(), name: z.string().nullable(), revision: z.number().int().nonnegative() });
export const shareSchema = person.extend({ permission: z.enum(['view','edit','none']), revision: z.number().int().positive() });
export type Share = z.infer<typeof shareSchema>;
export type Person = z.infer<typeof person>;
export type Permission = Share['permission'];
const incoming = z.object({ id: z.string().uuid(), name: z.string(), ownerName: z.string().nullable(), permission: z.enum(['view','edit']) });
export type Incoming = z.infer<typeof incoming>;
async function rpc(actor: string, name: string, args: Record<string, unknown>) {
 const user = await supabase.auth.getUser();
 if (user.error || user.data.user?.id !== actor) throw new WorkbookStorageError('session','Session changed');
 const { data, error } = await supabase.rpc(name, { p_actor: actor, ...args });
 if (error) throw new WorkbookStorageError(error.code==='PT409'?'conflict':error.code==='42501'?'session':error.code==='22023'?'invalid':'network', 'Sharing unavailable');
 return data;
}
export type ShareKind = 'workbook' | 'folder';
const inherited = z.object({id:z.string().uuid(),number:z.string(),name:z.string().nullable(),permission:z.enum(['view','edit']),folderId:z.string().uuid(),folderName:z.string()});
export type InheritedShare = z.infer<typeof inherited>;
export const sharingRepository = {
 async inherited(actor: string,id: string,offset=0) { return z.array(inherited).max(51).parse(await rpc(actor,'list_y_sheets_inherited',{p_id:id,p_offset:offset})); },
 async preview(actor: string,id: string,number: string,kind: ShareKind = 'workbook') { return person.nullable().parse(await rpc(actor,kind==='folder'?'preview_y_sheets_folder_recipient':'preview_y_sheets_recipient',{p_id:id,p_number:number})); },
 async shares(actor: string,id: string,offset=0,kind: ShareKind = 'workbook') { return z.array(shareSchema).max(51).parse(await rpc(actor,kind==='folder'?'list_y_sheets_folder_shares':'list_y_sheets_shares',{p_id:id,p_offset:offset})); },
 async set(actor: string,id: string,recipient: string,permission: Permission,revision: number,kind: ShareKind = 'workbook') { return z.number().int().nonnegative().parse(await rpc(actor,kind==='folder'?'set_y_sheets_folder_share':'set_y_sheets_share',{p_id:id,p_recipient:recipient,p_permission:permission,p_revision:revision})); },
 async incoming(actor: string,offset=0) { return z.array(incoming).max(51).parse(await rpc(actor,'list_shared_y_sheets',{p_offset:offset})); },
 async read(actor: string,id: string,grant: number | null = null,content=true) {
  const data=z.object({permission:z.enum(['view','edit']),grantRevision:z.number().int().positive(),revision:z.number().int().positive(),workbook:z.unknown()}).parse(await rpc(actor,'read_shared_y_sheets',{p_id:id,p_grant:grant,p_content:content}));
  return {...data,workbook:content?validateWorkbook(data.workbook):null};
 },
 async save(actor: string,id: string,grant: number,request: string,revision: number,workbook: WorkbookData) {
  return z.number().int().positive().parse(await rpc(actor,'save_shared_y_sheets',{p_id:id,p_grant:grant,p_request:request,p_revision:revision,p_content:validateWorkbook(workbook)}));
 },
};
