// Actual Tutor route/React/KaTeX; all external requests are intercepted fixtures.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.YHUB_PLAYWRIGHT_MODULE?pathToFileURL(process.env.YHUB_PLAYWRIGHT_MODULE).href:'playwright-core');
const base=new URL(process.env.YHUB_BROWSER_BASE_URL||'http://127.0.0.1:5175');assert(['localhost','127.0.0.1'].includes(base.hostname));
const output=process.env.YHUB_SCREENSHOTS||'/workspace/practice-source-screenshots';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const id='00000000-0000-4000-8000-000000000001',course='00000000-0000-4000-8000-000000000002',source='00000000-0000-4000-8000-000000000003',revision='00000000-0000-4000-8000-000000000004';
const user={id,email:'scope@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const exp=Math.floor(Date.now()/1000)+3600,token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,aud:'authenticated',exp})).toString('base64url')}.synthetic`;
try{
 for(const [width,language,theme,role] of [[390,'ar','dark','student'],[1280,'en','light','student'],[390,'ar','light','instructor'],[1280,'en','dark','instructor']]){
  const context=await browser.newContext({viewport:{width,height:900}}),requests=[],writes=[],errors=[];
  let allowed=true,referenceRole='primary',policyRevision=1;
  const item=()=>({id:source,revision,title:'Approved book',kind:'pdf',status:'ready',role:referenceRole,policyRevision,pages:[2,4],material_id:id});
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());if(u.origin===base.origin)return route.continue();
   const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(u.pathname==='/auth/v1/user')return json(user);
   if(u.pathname==='/rest/v1/users')return json({...user,role,full_name:'Source test',full_name_ar:'مستخدم تجريبي',full_name_en:'Local Test',user_number:'001234567',major:'mathematics'});
   if(u.pathname==='/rest/v1/rpc/ai_tutor_access'){const args=route.request().postDataJSON();return json(!args.p_manage||role==='instructor');}
   if(u.pathname==='/rest/v1/courses')return json({id:course,title:'Calculus'});
   if(u.pathname==='/rest/v1/ai_tutor_sources')return json([item()]);
   if(u.pathname==='/rest/v1/rpc/get_ai_practice_sources')return allowed?json({courseId:course,canManage:role==='instructor',primaryId:referenceRole==='primary'?source:null,limited:false,sources:[item()],units:[]}):json({code:'42501'},403);
   if(u.pathname==='/rest/v1/rpc/set_ai_practice_reference'){const args=route.request().postDataJSON();writes.push(args);referenceRole=args.p_role;return json(++policyRevision);}
   if(u.pathname==='/rest/v1/rpc/preview_ai_practice_sources'){
    requests.push(route.request().postDataJSON());return json({hasMore:false,evidence:[{id,source_id:source,revision,title:'Approved book',page:2,unit_id:null,score:1,text:String.raw`مشتقة الدالة derivative: \[\frac{d}{dx}(x^2)=2x\]`}]});
   }
   if(u.pathname.startsWith('/rest/v1/'))return json([]);return route.abort();
  });
  await context.addInitScript(({user,token,exp,language,theme})=>{localStorage.setItem('sb-rspdfdrmswixcmpozgzr-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_at:exp,expires_in:3600,token_type:'bearer',user}));localStorage.setItem('yhub-language',language);localStorage.setItem('theme',theme);},{user,token,exp,language,theme});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(new URL(`/course/${course}/ai-tutor`,base).href);
  const ar=language==='ar',title=ar?'مراجع التدريب ونطاقه':'Practice references and scope';
  try { await page.locator('summary').filter({hasText:title}).click(); } catch(error) {
   console.error({width,language,role,url:page.url(),errors,body:await page.locator('body').innerText()});
   await page.screenshot({path:`${output}/failed-${width}-${role}.png`,fullPage:true});throw error;
  }
  const panel=page.getByRole('region',{name:title,exact:true});
  await panel.getByText(ar?'اختيار الكتاب الأساسي':'Select primary book',{exact:true}).click();assert.equal(requests.length,0);
  const pages=panel.getByLabel((ar?'صفحات PDF':'PDF pages')+': Approved book',{exact:true});await pages.fill(ar?'٢،٤':'2,4');
  await panel.getByRole('button',{name:ar?'معاينة المقاطع':'Preview passages',exact:true}).click();await panel.locator('.katex').first().waitFor();
  assert.deepEqual(requests.at(-1).p_selection,[{sourceId:source,revision,pages:[2,4]}]);assert.equal(requests.at(-1).p_course,course);
  assert.equal(await pages.getAttribute('dir'),'ltr');assert.equal(await panel.getAttribute('dir'),ar?'rtl':'ltr');assert.equal(await panel.locator('.katex-error').count(),0);
  if(role==='instructor'){
   await panel.getByLabel((ar?'نوع المرجع':'Reference role')+': Approved book',{exact:true}).selectOption('reference');await panel.getByRole('button',{name:ar?'حفظ النوع':'Save role',exact:true}).click();
   await page.waitForFunction(()=>!document.querySelector('section input[type=checkbox]')?.disabled);
   assert.equal(writes.at(-1).p_expected_primary,source);assert.equal(writes.at(-1).p_expected_revision,1);
  }else assert.equal(await panel.getByRole('button',{name:ar?'حفظ النوع':'Save role',exact:true}).count(),0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`${output}/${width}-${language}-${role}.png`,fullPage:true});
  allowed=false;await panel.getByRole('button',{name:ar?'إعادة تحميل المراجع':'Reload references',exact:true}).click();await panel.getByRole('alert').waitFor();
  assert.equal(await panel.locator('input[type=checkbox]').count(),0);assert.equal(await panel.locator('.katex').count(),0);assert.deepEqual(errors,[]);
  console.log(`PASS ${width}/${language}/${theme}/${role}: source scope, actual math renderer, classification permissions, revocation, mobile bounds.`);await context.close();
 }
}finally{await browser.close();}
