// Synthetic HTTP transport only. Every non-local request is intercepted before navigation.
export async function sheetsFixture(browser,base,{theme,language,width}) {
 const context=await browser.newContext({viewport:{width,height:844},acceptDownloads:true,timezoneId:'UTC'});
 const owner='00000000-0000-4000-8000-000000000001';
 const user={id:owner,email:'local-test@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 const expires=Math.floor(Date.now()/1000)+3600;
 const token=[{alg:'HS256',typ:'JWT'},{sub:owner,aud:'authenticated',exp:expires}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.synthetic';
 const state={rows:new Map(),receipts:new Map(),offsets:[],failDelete:false,loseAck:false};
 for(let i=0;i<51;i++) {const id=`00000000-0000-4000-8000-${String(i+100).padStart(12,'0')}`;state.rows.set(id,{id,name:`Archive ${String(i).padStart(2,'0')}`,updated_at:'2026-01-01T00:00:00Z',revision:1});}
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
   state.rows.delete(p.p_id);return json(p.p_id);
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
