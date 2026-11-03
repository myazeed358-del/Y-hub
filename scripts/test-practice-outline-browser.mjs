// Actual Tutor React/CSS at mobile/desktop sizes. External HTTP is fixture-based.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.YHUB_PLAYWRIGHT_MODULE||'/workspace/.yhub-browser/node_modules/playwright-core/index.mjs').href);
const base=new URL(process.env.YHUB_BROWSER_BASE_URL||'http://127.0.0.1:5175');assert(['localhost','127.0.0.1'].includes(base.hostname));
const output=process.env.YHUB_SCREENSHOTS||'/workspace/practice-outline-screenshots';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const id='00000000-0000-4000-8000-000000000001',course='00000000-0000-4000-8000-000000000002',source='00000000-0000-4000-8000-000000000003',revision='00000000-0000-4000-8000-000000000004';
const user={id,email:'outline@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const exp=Math.floor(Date.now()/1000)+3600,token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,aud:'authenticated',exp})).toString('base64url')}.synthetic`;
try{
 for(const [width,language,theme,role] of [[390,'ar','dark','student'],[1280,'en','light','student'],[390,'ar','light','instructor'],[1280,'en','dark','instructor']]){
  const context=await browser.newContext({viewport:{width,height:900}}),previews=[],writes=[],creates=[],errors=[];
  const ar=language==='ar',item={id:source,revision,title:'Approved book',kind:'pdf',status:'ready',role:'primary',policyRevision:1,pages:[2,4],material_id:id};
  let allowed=true,conflict=true,version=1,state=null;
  let sections=[{id:source,kind:'chapter',title:'التفاضل Calculus',parentId:null,pages:[2]},{id,kind:'topic',title:'Vectors المتجهات',parentId:null,pages:[4]}];
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());if(u.origin===base.origin)return route.continue();
   const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(u.pathname==='/auth/v1/user')return json(user);
   if(u.pathname==='/rest/v1/users')return json({...user,role,full_name_ar:'مستخدم تجريبي',full_name_en:'Local Test',user_number:'001234567',major:'mathematics'});
   if(u.pathname==='/rest/v1/rpc/ai_tutor_access')return json(!route.request().postDataJSON().p_manage||role==='instructor');
   if(u.pathname==='/rest/v1/courses')return json({id:course,title:'Calculus'});
   if(u.pathname==='/rest/v1/ai_tutor_sources')return json([item]);
   if(u.pathname==='/rest/v1/rpc/get_ai_practice_sources')return json({courseId:course,canManage:role==='instructor',primaryId:source,limited:false,sources:[item],units:[]});
   if(u.pathname==='/rest/v1/rpc/get_ai_practice_outline')return allowed?json({sourceId:source,sourceRevision:revision,revision:version,canManage:role==='instructor',stale:false,sections}):json({code:'42501'},403);
   if(u.pathname==='/rest/v1/rpc/set_ai_practice_outline'){
    const args=route.request().postDataJSON();writes.push(args);assert.equal(role,'instructor');
    if(conflict){conflict=false;return json({code:'PT409'},409);}sections=args.p_sections;return json(++version);
   }
   if(u.pathname==='/rest/v1/rpc/preview_ai_practice_sources'){
    previews.push(route.request().postDataJSON());return json({hasMore:false,evidence:[{id,source_id:source,revision,title:'Approved book',page:2,unit_id:null,score:1,text:String.raw`مشتقة الدالة: \[\frac{d}{dx}(x^2)=2x\]`}]});
   }
   if(u.pathname==='/rest/v1/rpc/list_ai_practice_sessions')return json([]);
   if(u.pathname==='/rest/v1/rpc/create_ai_practice_session'){
    const args=route.request().postDataJSON();creates.push(args);state={id:args.p_id,courseId:course,mode:args.p_mode,difficulty:args.p_difficulty,language:args.p_language,target:args.p_target,revision:1,submittedAt:null,questions:[]};return json(args.p_id);
   }
   if(u.pathname==='/rest/v1/rpc/read_ai_practice_session')return json(state);
   if(u.pathname==='/rest/v1/rpc/get_ai_practice_assessment')return json({earned:0,graded:0,pending:0,excluded:0,items:[]});
   if(u.pathname.startsWith('/rest/v1/'))return json([]);return route.abort();
  });
  await context.addInitScript(({user,token,exp,language,theme})=>{localStorage.setItem('sb-rspdfdrmswixcmpozgzr-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_at:exp,expires_in:3600,token_type:'bearer',user}));localStorage.setItem('yhub-language',language);localStorage.setItem('theme',theme);},{user,token,exp,language,theme});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(new URL(`/course/${course}/ai-tutor`,base).href);
  const title=ar?'مراجع التدريب ونطاقه':'Practice references and scope';await page.locator('summary').filter({hasText:title}).click();const panel=page.getByRole('region',{name:title,exact:true});
  const choosePrimary=()=>panel.getByRole('button',{name:ar?'اختيار الكتاب الأساسي':'Select primary book',exact:true}).click();
  const openOutline=()=>panel.getByRole('button',{name:(ar?'الفصول والموضوعات':'Chapters and topics')+': Approved book',exact:true}).click();
  await choosePrimary();await openOutline();await panel.getByLabel(/التفاضل Calculus/).check();await panel.getByLabel(/Vectors المتجهات/).check();
  const pages=panel.getByLabel((ar?'صفحات PDF':'PDF pages')+': Approved book',{exact:true});assert.equal(await pages.inputValue(),'2,4');
  await panel.getByRole('button',{name:ar?'معاينة المقاطع':'Preview passages',exact:true}).click();await panel.locator('.katex').first().waitFor();
  const selected={sourceId:source,revision,pages:[2,4],outline:{revision:1,ids:[source,id]}};assert.deepEqual(previews.at(-1).p_selection,[selected]);
  await panel.getByRole('button',{name:ar?'جلسات التدريب المحفوظة':'Saved practice sessions',exact:true}).click();
  await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/rest/v1/rpc/read_ai_practice_session'),panel.getByRole('button',{name:ar?'إنشاء جلسة':'Create session',exact:true}).click()]);
  assert.deepEqual(creates.at(-1).p_selection,[selected]);
  await pages.fill(ar?'٢':'2');await panel.getByRole('button',{name:ar?'معاينة المقاطع':'Preview passages',exact:true}).click();await panel.locator('.katex').first().waitFor();assert.deepEqual(previews.at(-1).p_selection,[{sourceId:source,revision,pages:[2]}]);
  if(role==='instructor'){
   await panel.getByRole('button',{name:ar?'تعديل ربط الفصول':'Edit chapter mapping',exact:true}).click();
   const name=panel.getByLabel(ar?'الاسم 1':'Name 1',{exact:true});await name.fill('Revised فصل');
   const save=panel.getByRole('button',{name:ar?'حفظ الربط':'Save mapping',exact:true});await save.click();await panel.getByRole('alert').filter({hasText:ar?'تغير الربط':'The mapping changed'}).waitFor();assert.equal(await name.inputValue(),'Revised فصل');
   assert.equal(writes.at(-1).p_revision,1);assert.equal(writes.at(-1).p_source_revision,revision);await save.click();await name.waitFor({state:'detached'});await choosePrimary();await openOutline();await panel.getByLabel(/Revised فصل/).waitFor();assert.equal(version,2);
  }else assert.equal(await panel.getByRole('button',{name:ar?'تعديل ربط الفصول':'Edit chapter mapping',exact:true}).count(),0);
  assert.equal(await panel.getAttribute('dir'),ar?'rtl':'ltr');assert.equal(await pages.getAttribute('dir'),'ltr');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await panel.getByRole('button',{name:ar?'استخدام جميع الصفحات المفهرسة':'Use all indexed pages',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:`${output}/${width}-${language}-${role}.png`,fullPage:true});
  allowed=false;await panel.getByRole('button',{name:ar?'إعادة تحميل الفهرس':'Reload outline',exact:true}).click();await panel.getByRole('alert').filter({hasText:ar?'سُحبت صلاحية الوصول':'Access to this outline was withdrawn'}).waitFor();assert.equal(await panel.getByLabel(/Vectors المتجهات/).count(),0);assert.deepEqual(errors,[]);
  console.log(`PASS ${width}/${language}/${theme}/${role}: chapter scope, real session wiring, manual scope reset, CAS draft retention, denial and responsive layout.`);await context.close();
 }
}finally{await browser.close();}
