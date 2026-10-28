// Actual route/React/CSS with all remote requests intercepted; not hosted Supabase evidence.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.YHUB_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.YHUB_PLAYWRIGHT_MODULE).href : 'playwright-core');
const base = new URL(process.env.YHUB_BROWSER_BASE_URL || 'http://127.0.0.1:5175');
assert(['localhost','127.0.0.1'].includes(base.hostname));
const output = process.env.YHUB_SCREENSHOTS || '/workspace/learning-path-screenshots';
await mkdir(output,{recursive:true});
const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const id='00000000-0000-4000-8000-000000000001', one='10000000-0000-4000-8000-000000000001', two='10000000-0000-4000-8000-000000000002';
const user={id,email:'learning@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const exp=Math.floor(Date.now()/1000)+3600;
const token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,aud:'authenticated',exp})).toString('base64url')}.synthetic`;
try {
 for(const [width,language,theme,role,path] of [[390,'ar','dark','student','/legacy-home'],[1280,'en','light','instructor','/legacy-home'],[390,'ar','light','student','/legacy-course'],[1280,'en','dark','admin','/legacy-course']]) {
  const context=await browser.newContext({viewport:{width,height:900}}),requests=[],reads=[],errors=[];
  let revoked=false;
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin===base.origin)return route.continue();
   const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   if(url.pathname==='/auth/v1/user')return json(user);
   if(url.pathname==='/rest/v1/users')return json({...user,role,full_name:'Learner',full_name_ar:'طالب تجريبي',full_name_en:'Test Learner',major:'mathematics',user_number:'001234567'});
   if(url.pathname==='/rest/v1/courses') {requests.push(url);return json(revoked?[]:[{id:one,title:'Same course',section_label:'01',academic_term:'Fall'},{id:two,title:'Same course',section_label:'02',academic_term:'Fall'}]);}
   if(url.pathname==='/rest/v1/rpc/read_course_syllabus') {
    const {p_course_id}=route.request().postDataJSON();reads.push(p_course_id);
    return json(revoked?null:{courseId:p_course_id,revision:0,units:[{id:'20000000-0000-4000-8000-000000000001',title:language==='ar'?'وحدة فعلية':'Actual unit',sections:[{id:'30000000-0000-4000-8000-000000000001',title:p_course_id===one?'First section topic':'Second section topic'}]}]});
   }
   if(url.pathname.startsWith('/rest/v1/'))return json([]);
   return route.abort();
  });
  await context.addInitScript(({user,token,exp,language,theme})=>{
   localStorage.setItem('sb-rspdfdrmswixcmpozgzr-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_at:exp,expires_in:3600,token_type:'bearer',user}));
   localStorage.setItem('yhub-language',language);localStorage.setItem('theme',theme);
  },{user,token,exp,language,theme});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL(path,base).href);
  const select=page.getByLabel(language==='ar'?'الشعبة':'Section',{exact:true});await select.waitFor();
  assert.equal(reads.length,0);
  await select.selectOption(one);await page.getByText('First section topic',{exact:true}).waitFor();
  await select.selectOption(two);await page.getByText('Second section topic',{exact:true}).waitFor();
  assert.equal(await page.getByText('First section topic',{exact:true}).count(),0);
  const materialLink=page.getByRole('link',{name:language==='ar'?'فتح مواد الشعبة':'Open section materials',exact:true});
  assert.equal(await materialLink.getAttribute('href'),role==='student'?`/course/${two}/view`:`/course/${two}`);
  assert.equal(requests.at(-1).searchParams.get('limit'),'26');
  if(role==='student') {assert.equal(requests.at(-1).searchParams.get('course_enrollments.student_id'),'eq.'+id);assert.equal(requests.at(-1).searchParams.get('course_enrollments.status'),'eq.active');}
  assert(!/37%|٣٧٪|You completed one milestone|أكملت محطة واحدة/.test(await page.locator('body').innerText()));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`${output}/${width}-${language}-${role}-${path.slice(1)}.png`,fullPage:true});
  revoked=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByText(language==='ar'?'لا توجد شعب متاحة لحسابك. يحتاج الطالب إلى تسجيل فعال في شعبة منشورة.':'No sections are available for your account. Students need an active enrollment in a published section.',{exact:true}).waitFor();
  assert.equal(await page.getByText('Second section topic',{exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  console.log(`PASS ${path} ${width}/${language}/${role}: actual composition, section identity, zero fabricated progress, permissions refresh, mobile bounds.`);
  await context.close();
 }
} finally {await browser.close();}
