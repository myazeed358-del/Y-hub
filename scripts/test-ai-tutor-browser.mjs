// Real route/React/KaTeX; synthetic HTTP only. Blocks all external traffic.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.YHUB_PLAYWRIGHT_MODULE?pathToFileURL(process.env.YHUB_PLAYWRIGHT_MODULE).href:'playwright-core');
const base=new URL(process.env.YHUB_BROWSER_BASE_URL||'http://127.0.0.1:5175');assert(['localhost','127.0.0.1'].includes(base.hostname));
const browser=await chromium.launch({executablePath:process.env.YHUB_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const id='00000000-0000-4000-8000-000000000001',course='00000000-0000-4000-8000-000000000002',source='00000000-0000-4000-8000-000000000003';
const user={id,email:'tutor@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const exp=Math.floor(Date.now()/1000)+3600,token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,aud:'authenticated',exp})).toString('base64url')}.synthetic`;
try{
 for(const [width,theme,role] of [[1280,'light','student'],[390,'dark','student'],[1280,'dark','instructor']]){
  const context=await browser.newContext({viewport:{width,height:850}});let allowed=true,indexed=0,sent;
  const item={id:source,title:'Trusted lecture / محاضرة',status:'ready',kind:'pdf',material_id:'material',revision:'revision'};
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());if(u.origin===base.origin)return route.continue();
   const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(u.pathname==='/auth/v1/user')return json(user);
   if(u.pathname==='/rest/v1/users')return json({...user,role,full_name:'Tutor test',major:'mathematics'});
   if(u.pathname==='/rest/v1/rpc/ai_tutor_access'){const data=route.request().postDataJSON();return json(allowed&&(!data.p_manage||role==='instructor'));}
   if(u.pathname==='/rest/v1/courses')return json({id:course,title:'Calculus'});
   if(u.pathname==='/rest/v1/ai_tutor_sources')return json(allowed?[item]:[]);
   if(u.pathname==='/functions/v1/ai-tutor-index'){indexed++;return json({status:'ready',chunks:1});}
   if(u.pathname==='/functions/v1/ai-tutor-chat'){
    sent=route.request().postDataJSON();if(!allowed)return json({error:'Denied'},403);
    return json({answer:'The derivative is \\(2x\\).',insufficient:false,citations:[{id:'chunk',source_id:source,revision:'revision',title:item.title,page:2,unit_id:null,text:'The derivative of x squared is twice x.'}]});
   }
   if(u.pathname.startsWith('/rest/v1/'))return json([]);return route.abort();
  });
  await context.addInitScript(({user,token,exp,theme})=>{localStorage.setItem('sb-rspdfdrmswixcmpozgzr-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_at:exp,expires_in:3600,token_type:'bearer',user}));localStorage.setItem('theme',theme);},{user,token,exp,theme});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL(`/course/${course}/ai-tutor`,base).href);
  await page.getByRole('heading',{name:'AI Tutor: Calculus'}).waitFor();
  if(role==='instructor'){await page.getByRole('button',{name:'Reindex / إعادة فهرسة'}).click();await page.getByRole('button',{name:'Reindex / إعادة فهرسة'}).waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('select[aria-label="Source / المصدر"]')?.disabled);assert.equal(indexed,1);}else assert.equal(await page.getByRole('button',{name:'Reindex / إعادة فهرسة'}).count(),0);
  await page.getByRole('combobox',{name:'Source / المصدر'}).selectOption(source);
  const input=page.getByPlaceholder('Ask about the course / اسأل عن مواد الشعبة');await input.fill('Explain derivative');await page.getByRole('button',{name:'Send message'}).click();
  await page.locator('.katex').waitFor();assert.deepEqual(Object.keys(sent).sort(),['courseId','question','sourceId']);
  await page.locator('summary').filter({hasText:'Trusted lecture'}).click();await page.getByText('The derivative of x squared is twice x.',{exact:true}).waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  allowed=false;await input.fill('Second question');await page.getByRole('button',{name:'Send message'}).click();await page.getByText('التسجيل مطلوب',{exact:true}).waitFor();assert.equal(await page.locator('.katex').count(),0);assert.deepEqual(errors,[]);
  console.log(`PASS tutor ${width}/${theme}/${role}: section source selection, trusted evidence, math, management controls, revoked access clears conversation.`);await context.close();
 }
}finally{await browser.close();}
