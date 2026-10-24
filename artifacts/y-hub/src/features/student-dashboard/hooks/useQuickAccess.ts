import {useCallback,useEffect,useRef,useState} from 'react';
import {moduleRegistry} from '@/modules';
import {MODULE_ICON_COMPONENTS} from '@/shared/ui/moduleIcons';
import type {ModuleIcon} from '@/modules';
import {quickAccessRepository as repo,type QuickSnapshot} from '../services/quickAccessRepository';

/** One account snapshot; background sync never silently rebases a user's open editor. */
export function useQuickAccess(owner:string|undefined,language:'ar'|'en'){
 const [snapshot,setSnapshot]=useState<{owner:string;data:QuickSnapshot}|null>(null);
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState<string[]>([]),[base,setBase]=useState(0);
 const [error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const identity=useRef(owner);identity.current=owner;const generation=useRef(0),pending=useRef(false);
 const refresh=useCallback(async()=>{
  if(!owner){setLoading(false);return;}const request=++generation.current;
  try{const data=await repo.read();if(identity.current===owner&&request===generation.current){setSnapshot({owner,data});setLoading(false);}}
  catch{if(identity.current===owner&&request===generation.current){setError('load');setLoading(false);setSnapshot(null);}}
 },[owner]);
 useEffect(()=>{setSnapshot(null);setDraft([]);setEditing(false);setError(null);setLoading(true);setBusy(false);pending.current=false;void refresh();
  const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);
  return()=>{++generation.current;clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[refresh]);
 const data=snapshot&&snapshot.owner===owner?snapshot.data:null;
 const available=(data?.available??[]).filter(a=>moduleRegistry.routes.some(r=>r.path===a.path&&r.module.id===a.moduleId));
 const optionMap=new Map(available.map(a=>[a.path,a]));
 const tools=(data?.paths??[]).flatMap(path=>{const item=optionMap.get(path);return item?[{path,name:item.title[language],icon:MODULE_ICON_COMPONENTS[item.icon as ModuleIcon]??MODULE_ICON_COMPONENTS.box}]:[];});
 function begin(){if(!data)return;setDraft([...data.paths]);setBase(data.revision);setEditing(true);setError(null);}
 async function save(){
  if(!owner||!data||pending.current||draft.some(path=>!optionMap.has(path)))return;
  const requestOwner=owner,paths=[...draft];pending.current=true;++generation.current;setBusy(true);setError(null);
  try{const revision=await repo.save(base,paths);if(identity.current!==requestOwner)return;
   setSnapshot({owner:requestOwner,data:{...data,revision,paths}});setEditing(false);await refresh();
  }catch(e){if(identity.current===requestOwner)setError(e instanceof Error?e.message:'unavailable');}
  finally{if(identity.current===requestOwner){pending.current=false;setBusy(false);}}
 }
 return {tools,available,loading,error,busy,editing,draft,setDraft,begin,save,refresh,
  cancel:()=>{setEditing(false);setError(null);},reload:begin,
  changedElsewhere:editing&&data!==null&&base!==data.revision,
  invalidSelection:draft.some(path=>!optionMap.has(path))};
}
export type QuickAccessController=ReturnType<typeof useQuickAccess>;
