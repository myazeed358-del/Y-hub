import { z } from 'zod';
import { supabase } from '@/utils/supabaseClient';
const uuid = z.string().uuid();
const page = z.number().int().min(1).max(300);
export const catalogSchema = z.object({
 courseId: uuid, canManage: z.boolean(), primaryId: uuid.nullable(), limited: z.boolean(),
 sources: z.array(z.object({id:uuid, revision:uuid, title:z.string(), kind:z.enum(['pdf','syllabus']), status:z.enum(['pending','ready','unreadable']), role:z.enum(['primary','reference','lecture','syllabus']), policyRevision:z.number().int().nonnegative(), pages:z.array(page).max(300)})).max(100),
 units: z.array(z.object({id:uuid,title:z.string()})).max(100),
});
const selectionSchema = z.array(z.object({sourceId:uuid,revision:uuid,pages:z.array(page).max(300)}).strict()).min(1).max(10);
const evidenceSchema = z.object({id:uuid,source_id:uuid,revision:uuid,title:z.string(),page:page.nullable(),unit_id:uuid.nullable(),text:z.string().min(1).max(1800),score:z.number().finite()});
export type SourceCatalog = z.infer<typeof catalogSchema>;
export type PracticeSource = SourceCatalog['sources'][number];
export type SourceSelection = z.infer<typeof selectionSchema>;
export type SourcePreview = {evidence:z.infer<typeof evidenceSchema>[];hasMore:boolean};
export class PracticeSourceError extends Error {constructor(readonly kind:'conflict'|'denied'|'unavailable'){super(kind);}}
function check(error:{code?:string}|null){if(error)throw new PracticeSourceError(error.code==='PT409'?'conflict':['42501','PGRST301','PGRST303'].includes(error.code??'')?'denied':'unavailable');}
/** Physical PDF positions that actually have indexed text; never infer printed book pages. */
export function parsePages(input:string,available:number[]):number[]{
 if(!input.trim())return [];
 const normalized=input.replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c>='۰'?0x6f0:0x660))).replace(/،/g,',');
 const result=new Set<number>();
 if(normalized.length>1500)throw new Error('Invalid pages');
 for(const term of normalized.split(',')){
  const match=/^\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?\s*$/.exec(term);
  if(!match)throw new Error('Invalid pages');
  const start=Number(match[1]),end=Number(match[2]??match[1]);
  if(start<1||end>300||start>end)throw new Error('Invalid pages');
  for(let p=start;p<=end;p++){if(!available.includes(p))throw new Error('Unindexed page');result.add(p);}
 }
 return [...result].sort((a,b)=>a-b);
}
export const sourcesRepository={
 async read(courseId:string,signal:AbortSignal):Promise<SourceCatalog>{
  const {data,error}=await supabase.rpc('get_ai_practice_sources',{p_course:uuid.parse(courseId)}).abortSignal(signal);check(error);
  const result=catalogSchema.parse(data);if(result.courseId!==courseId)throw new PracticeSourceError('unavailable');return result;
 },
 async preview(courseId:string,selection:SourceSelection,units:string[],query:string,signal:AbortSignal):Promise<SourcePreview>{
  const picks=selectionSchema.parse(selection);
  const {data,error}=await supabase.rpc('preview_ai_practice_sources',{p_course:uuid.parse(courseId),p_selection:picks,p_units:z.array(uuid).max(100).parse(units),p_query:z.string().max(1500).parse(query)}).abortSignal(signal);check(error);
  const result=z.object({evidence:z.array(evidenceSchema).max(6),hasMore:z.boolean()}).parse(data);
  if(result.evidence.some(e=>!picks.some(s=>s.sourceId===e.source_id&&s.revision===e.revision&&(!s.pages.length||(e.page!==null&&s.pages.includes(e.page))))||(units.length&&(!e.unit_id||!units.includes(e.unit_id)))))throw new PracticeSourceError('unavailable');
  return result;
 },
 async classify(source:PracticeSource,role:'primary'|'reference'|'lecture',primaryId:string|null){
  const {data,error}=await supabase.rpc('set_ai_practice_reference',{p_source:source.id,p_source_revision:source.revision,p_expected_revision:source.policyRevision,p_role:role,p_expected_primary:primaryId});check(error);return z.number().int().positive().parse(data);
 },
};
