// Synthetic HTTP transport only. Every non-local request is intercepted before navigation.
export async function sheetsFixture(browser,base,{theme,language,width}) {
 const context=await browser.newContext({viewport:{width,height:844},acceptDownloads:true,timezoneId:'UTC'});
 const owner='00000000-0000-4000-8000-000000000001';
 const user={id:owner,email:'local-test@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 const expires=Math.floor(Date.now()/1000)+3600;
 const token=[{alg:'HS256',typ:'JWT'},{sub:owner,aud:'authenticated',exp:expires}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.synthetic';
 const state={rows:new Map(),receipts:new Map(),offsets:[],failDelete:false,loseAck:false,folders:new Map(),locations:new Map(),denied:false,loseOrganizationAck:false,grants:new Map(),folderGrants:new Map(),inherited:new Map(),incoming:new Map(),sharedOffline:false,trash:new Map(),failRestore:false};
 for(let i=0;i<51;i++) {const id=`00000000-0000-4000-8000-${String(i+100).padStart(12,'0')}`;state.rows.set(id,{id,name:`Archive ${String(i).padStart(2,'0')}`,updated_at:'2026-01-01T00:00:00Z',revision:1});}
 const archive=(kind,id,revision)=>{
  const item=(kind==='folder'?state.folders:state.rows).get(id);
  if(!item||(kind==='folder'?item.organization_revision:item.revision)!==revision||state.failDelete)return null;
  const folderIds=new Set(kind==='folder'?[id]:[]);let added=true;
  while(added){added=false;for(const f of state.folders.values())if(folderIds.has(f.parent_id)&&!folderIds.has(f.id)){folderIds.add(f.id);added=true;}}
  const fileIds=kind==='workbook'?[id]:[...state.rows.keys()].filter(key=>folderIds.has(state.locations.get(key)?.parent_id));
  const snapshot={folders:[...folderIds].map(key=>structuredClone(state.folders.get(key))),files:fileIds.map(key=>structuredClone(state.rows.get(key))),locations:fileIds.map(key=>[key,structuredClone(state.locations.get(key))])};
  const entry={id:crypto.randomUUID(),rootId:id,kind,name:item.name,deletedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+30*86400000).toISOString(),fileCount:fileIds.length,folderCount:folderIds.size,state:'trashed',snapshot};
  for(const key of fileIds){state.rows.delete(key);state.locations.delete(key);const g=state.grants.get(key);if(g){g.permission='none';g.revision++;}}
  for(const key of folderIds){state.folders.delete(key);const g=state.folderGrants.get(key);if(g){g.permission='none';g.revision++;}}
  state.trash.set(entry.id,entry);return entry.id;
 };
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===base.origin)return route.continue();
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(url.pathname==='/auth/v1/user')return json(user);
  if(url.pathname==='/rest/v1/users')return json({...user,role:'student',full_name:'Synthetic student',major:'mathematics'});
  if(url.pathname==='/rest/v1/y_sheets_workbooks'){
   if(url.searchParams.has('id'))return json(state.rows.get(url.searchParams.get('id').slice(3))??{},state.rows.has(url.searchParams.get('id').slice(3))?200:404);
   const offset=Number(url.searchParams.get('offset')??0);state.offsets.push(offset);
   const search=(url.searchParams.get('name')??'').replace(/^ilike\.%|%$/g,'').replace(/\\([%_\\])/g,'$1').toLowerCase();
   const rows=[...state.rows.values()].filter(r=>r.name.toLowerCase().includes(search)).sort((a,b)=>b.updated_at.localeCompare(a.updated_at)||a.id.localeCompare(b.id));
   return json(rows.slice(offset,offset+Number(url.searchParams.get('limit')??50)).map(({content,...r})=>r));
  }
  if(url.pathname==='/rest/v1/rpc/list_y_sheets_inherited')return json(state.inherited.get(request.postDataJSON().p_id)||[]);
  const grantMap=url.pathname.includes('folder_')?state.folderGrants:state.grants;
  if(['/rest/v1/rpc/preview_y_sheets_recipient','/rest/v1/rpc/preview_y_sheets_folder_recipient'].includes(url.pathname)){
   const p=request.postDataJSON(),g=grantMap.get(p.p_id);
   return json(p.p_number==='123456789'?{id:'00000000-0000-4000-8000-000000000022',number:'123456789',name:'Selected recipient',revision:g?.revision||0}:null);
  }
  if(['/rest/v1/rpc/list_y_sheets_shares','/rest/v1/rpc/list_y_sheets_folder_shares'].includes(url.pathname)){const p=request.postDataJSON(),g=grantMap.get(p.p_id);return json(g?[g]:[]);}
  if(['/rest/v1/rpc/set_y_sheets_share','/rest/v1/rpc/set_y_sheets_folder_share'].includes(url.pathname)){
   const p=request.postDataJSON(),old=grantMap.get(p.p_id);
   if(old?.permission===p.p_permission)return json(old.revision);
   if((old?.revision||0)!==p.p_revision)return json({code:'PT409'},409);
   grantMap.set(p.p_id,{id:p.p_recipient,number:'123456789',name:'Selected recipient',permission:p.p_permission,revision:p.p_revision+1});return json(p.p_revision+1);
  }
  if(url.pathname==='/rest/v1/rpc/list_shared_y_sheets')return json([...state.incoming.values()].filter(r=>r.permission!=='none').map(r=>({id:r.workbook.id,name:r.workbook.name,ownerName:'File owner',permission:r.permission})));
  if(url.pathname==='/rest/v1/rpc/read_shared_y_sheets'){
   const p=request.postDataJSON(),r=state.incoming.get(p.p_id);
   if(state.sharedOffline)return json({code:'unavailable'},503);
   if(!r||r.permission==='none'||(p.p_grant!==null&&p.p_grant!==r.grantRevision))return json({code:'42501'},403);
   return json({...r,workbook:p.p_content?r.workbook:null});
  }
  if(url.pathname==='/rest/v1/rpc/save_shared_y_sheets'){
   const p=request.postDataJSON(),r=state.incoming.get(p.p_id);
   if(state.sharedOffline)return json({code:'unavailable'},503);
   if(!r||r.permission!=='edit'||p.p_grant!==r.grantRevision)return json({code:'42501'},403);
   if(p.p_revision!==r.revision)return json({code:'PT409'},409);
   r.workbook=p.p_content;r.revision++;return json(r.revision);
  }
  if(url.pathname==='/rest/v1/rpc/trash_y_sheets'){
   const p=request.postDataJSON();if(state.denied||p.p_actor!==owner)return json({code:'42501'},403);
   const id=archive(p.p_kind,p.p_id,p.p_revision);return id?json(id):json({code:'PT409'},409);
  }
  if(url.pathname==='/rest/v1/rpc/list_y_sheets_trash'){
   const p=request.postDataJSON();if(state.denied||p.p_actor!==owner)return json({code:'42501'},403);
   for(const e of state.trash.values())if(e.state==='trashed'&&Date.parse(e.expiresAt)<=Date.now()){e.state='purged';e.snapshot=null;}
   return json([...state.trash.values()].filter(e=>e.state==='trashed').slice(p.p_offset||0,(p.p_offset||0)+51).map(({snapshot,state,...e})=>e));
  }
  if(['/rest/v1/rpc/restore_y_sheets_trash','/rest/v1/rpc/purge_y_sheets_trash'].includes(url.pathname)){
   const p=request.postDataJSON(),e=state.trash.get(p.p_entry);if(state.denied||p.p_actor!==owner||!e)return json({code:'42501'},403);
   if(url.pathname.endsWith('/purge_y_sheets_trash')){if(e.state==='restored')return json({code:'PT409'},409);e.state='purged';e.snapshot=null;return json(null);}
   if(state.failRestore)return json({code:'unavailable'},503);
   if(e.state==='restored')return json(e.rootId);
   if(e.state!=='trashed'||Date.parse(e.expiresAt)<=Date.now())return json({code:'PT409'},409);
   for(const f of e.snapshot.folders)state.folders.set(f.id,{...f,parent_id:f.id===e.rootId?null:f.parent_id,organization_revision:f.organization_revision+1});
   for(const f of e.snapshot.files)state.rows.set(f.id,{...f,revision:f.revision+1});
   for(const [id,l] of e.snapshot.locations)state.locations.set(id,{favorite:false,pinned:false,...l,parent_id:e.kind==='folder'?l?.parent_id:null,organization_revision:(l?.organization_revision||0)+1});
   e.state='restored';e.snapshot=null;return json(e.rootId);
  }
  if(url.pathname==='/rest/v1/rpc/browse_y_sheets'){
   const p=request.postDataJSON();if(state.denied||p.p_owner!==owner)return json({code:'42501'},403);
   state.offsets.push(p.p_offset||0);
   const trail=[];let parent=p.p_parent;
   while(parent){const f=state.folders.get(parent);if(!f)return json({code:'42501'},403);trail.unshift({id:f.id,name:f.name});parent=f.parent_id;}
   let rows=[...state.folders.values(),...[...state.rows.values()].map(r=>({kind:'workbook',id:r.id,name:r.name,revision:r.revision,updated_at:r.updated_at,parent_id:null,favorite:false,pinned:false,organization_revision:0,...state.locations.get(r.id)}))];
   rows=rows.filter(r=>(p.p_search||p.p_view!=='folder'||r.parent_id===p.p_parent)&&(!p.p_search||r.name.toLowerCase().includes(p.p_search.toLowerCase()))&&(p.p_view!=='favorite'||r.favorite)&&(p.p_view!=='pinned'||r.pinned));
   rows.sort((a,b)=>Number(b.pinned)-Number(a.pinned)||(p.p_sort==='updated'?b.updated_at.localeCompare(a.updated_at):0)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
   return json({items:rows.slice(p.p_offset||0,(p.p_offset||0)+51),trail});
  }
  if(url.pathname==='/rest/v1/rpc/organize_y_sheets'){
   const p=request.postDataJSON();if(state.denied||p.p_owner!==owner)return json({code:'42501'},403);
   const map=p.p_kind==='folder'?state.folders:state.locations,old=map.get(p.p_id);
   if(old&&old.parent_id===p.p_parent&&old.favorite===p.p_favorite&&old.pinned===p.p_pinned&&(p.p_kind!=='folder'||old.name===p.p_name))return json(old.organization_revision);
   if((old?.organization_revision||0)!==p.p_revision)return json({code:'PT409'},409);
   let parent=p.p_parent;while(parent){if(parent===p.p_id)return json({code:'22023'},400);parent=state.folders.get(parent)?.parent_id;}
   const value={parent_id:p.p_parent,favorite:p.p_favorite,pinned:p.p_pinned,organization_revision:p.p_revision+1};
   map.set(p.p_id,p.p_kind==='folder'?{...value,kind:'folder',id:p.p_id,name:p.p_name,revision:null,updated_at:new Date().toISOString()}:value);
   if(state.loseOrganizationAck){state.loseOrganizationAck=false;return json({code:'unavailable'},503);}
   return json(value.organization_revision);
  }
  if(url.pathname==='/rest/v1/rpc/save_y_sheets_workbook'){
   const p=request.postDataJSON(),row=state.rows.get(p.p_id),key=p.p_id+':'+p.p_request_id;
   if(p.p_expected_owner_id!==owner)return json({code:'42501',message:'Account mismatch'},403);
   if(state.receipts.has(key))return json(state.receipts.get(key));
   if((row?.revision??0)!==p.p_expected_revision)return json({code:'40001',message:'Synthetic revision conflict'},409);
   const revision=(row?.revision??0)+1;
   state.rows.set(p.p_id,{id:p.p_id,name:p.p_content.name,content:p.p_content,revision,updated_at:new Date().toISOString()});state.receipts.set(key,revision);
   if(state.loseAck){state.loseAck=false;return json({message:'Synthetic lost acknowledgement'},503);}
   return json(revision);
  }
  if(url.pathname==='/rest/v1/rpc/delete_y_sheets_workbook'){
   const p=request.postDataJSON(),row=state.rows.get(p.p_id);
   if(state.failDelete||row?.revision!==p.p_expected_revision)return json({code:'40001',message:'Synthetic delete conflict'},409);
   archive('workbook',p.p_id,p.p_expected_revision);return json(p.p_id);
  }
  if(url.pathname.startsWith('/rest/v1/'))return json([]);
  return route.abort();
 });
 await context.addInitScript(({user,token,expires,theme,language})=>{
  localStorage.setItem('sb-rspdfdrmswixcmpozgzr-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_at:expires,expires_in:3600,token_type:'bearer',user}));
  localStorage.setItem('yhub-language',language);localStorage.setItem('theme',theme);
 },{user,token,expires,theme,language});
 return {context,state};
}
