// Real composed pages, synthetic HTTP only; PostgreSQL authorization is tested separately.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const {chromium}=await import(process.env.YHUB_PLAYWRIGHT_MODULE?pathToFileURL(process.env.YHUB_PLAYWRIGHT_MODULE).href:'playwright-core');
const base=new URL(process.env.YHUB_BROWSER_BASE_URL||'http://127.0.0.1:5175');
assert(['localhost','127.0.0.1'].includes(base.hostname));
const browser=await chromium.launch({executablePath:process.env.YHUB_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const id='10000000-0000-4000-8000-000000000001',owner='00000000-0000-4000-8000-000000000001';
try {
 for(const language of ['ar','en']) for(const role of ['instructor','student']) {
  const user={id:role==='instructor'?owner:'00000000-0000-4000-8000-000000000004',email:'synthetic@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
  const expires=Math.floor(Date.now()/1000)+3600;
  const token=`${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',exp:expires})).toString('base64url')}.synthetic`;
  let revision=0,units=role==='student'?[{id:'10000000-0000-4000-8000-000000000002',title:'Enrolled section only',sections:[]}]:[];
  const context=await browser.newContext({viewport:language==='ar'?{width:390,height:844}:{width:1366,height:768}});
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url()); if(url.origin===base.origin)return route.continue();
   const json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
   if(url.pathname==='/auth/v1/user')return json(user);
   if(url.pathname==='/rest/v1/users')return json({...user,role,major:'mathematics',full_name:'Synthetic tester'});
   if(url.pathname==='/rest/v1/courses')return json({id,instructor_id:owner,title:'Section fixture',description:'',course_code:'SAME',is_published:true,enrollment_open:true});
   if(url.pathname==='/rest/v1/course_enrollments')return json({id:'enrollment'});
   if(url.pathname==='/rest/v1/rpc/read_course_syllabus')return json({courseId:id,revision,units});
   if(url.pathname==='/rest/v1/rpc/save_course_syllabus') {
    const body=route.request().postDataJSON();
    assert.equal(body.p_course_id,id);assert.equal(role,'instructor');
    if(body.p_expected_revision!==revision)return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({code:'40001',message:'Synthetic conflict'})});
    units=body.p_units;return json(++revision);
   }
   if(url.pathname.startsWith('/rest/v1/'))return json([]);
   return route.abort();
  });
  await context.addInitScript(({user,token,expires,language})=>{
   localStorage.setItem('sb-rspdfdrmswixcmpozgzr-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_at:expires,expires_in:3600,token_type:'bearer',user}));
   localStorage.setItem('yhub-language',language);localStorage.setItem('theme',language==='ar'?'dark':'light');
  },{user,token,expires,language});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL(`/course/${id}${role==='student'?'/view':''}`,base).href);
  const panel=page.getByRole('region',{name:language==='ar'?'سيلابس الشعبة':'Section syllabus'});
  await panel.waitFor();
  if(role==='instructor') {
   const add=panel.getByRole('button',{name:language==='ar'?'إضافة وحدة':'Add unit',exact:true});await add.click();
   const input=panel.getByLabel(language==='ar'?'الوحدة 1':'Unit 1',{exact:true});await input.fill('Manual unit');
   await panel.getByRole('button',{name:language==='ar'?'إضافة عنوان فرعي':'Add topic',exact:true}).click();
   await panel.getByLabel(language==='ar'?'الوحدة 1 العنوان الفرعي 1':'Unit 1 Topic 1',{exact:true}).fill('Manual topic');
   const save=panel.getByRole('button',{name:language==='ar'?'حفظ السيلابس':'Save syllabus',exact:true});await save.click();
   await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(e=>['Save syllabus','حفظ السيلابس'].includes(e.textContent)&&e.disabled));
   assert.equal(units[0].sections[0].title,'Manual topic');
   revision++; // Another editor committed; local draft must not be overwritten.
   await input.fill('Retain draft');await save.click();await panel.getByRole('alert').waitFor();assert.equal(await input.inputValue(),'Retain draft');
   const reload=panel.getByRole('button',{name:language==='ar'?'إعادة تحميل':'Reload',exact:true});
   page.once('dialog',d=>d.dismiss());await reload.click();assert.equal(await input.inputValue(),'Retain draft');
   page.once('dialog',d=>d.accept());await reload.click();await page.waitForFunction(()=>document.querySelector('input[aria-label="Unit 1"],input[aria-label="الوحدة 1"]')?.value==='Manual unit');
  } else {
   await panel.getByText('Enrolled section only').waitFor();assert.equal(await panel.getByRole('textbox').count(),0);
   assert.equal(await panel.getByRole('button').count(),1,'Only reload is exposed to student');
  }
  assert.equal(await panel.getAttribute('dir'),language==='ar'?'rtl':'ltr');
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: real manager/student composition, Arabic dark mobile + English light laptop, manual units/topics/save, conflict draft retention and confirmed reload. Synthetic HTTP; no Supabase writes.');
} finally {await browser.close();}
