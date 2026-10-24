// Real current route/React/CSS with synthetic HTTP. No external traffic is allowed.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.YHUB_PLAYWRIGHT_MODULE?pathToFileURL(process.env.YHUB_PLAYWRIGHT_MODULE).href:'playwright-core');
const base=new URL(process.env.YHUB_BROWSER_BASE_URL||'http://127.0.0.1:5175');assert(['localhost','127.0.0.1'].includes(base.hostname));
const browser=await chromium.launch({executablePath:process.env.YHUB_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const id='00000000-0000-4000-8000-000000000001',course='00000000-0000-4000-8000-000000000002',lecture='00000000-0000-4000-8000-000000000003',session='00000000-0000-4000-8000-000000000004';
const user={id,email:'attendance@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const exp=Math.floor(Date.now()/1000)+3600,token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,aud:'authenticated',exp})).toString('base64url')}.synthetic`;
const output=process.env.YHUB_SCREENSHOTS||'/workspace/attendance-screenshots';await mkdir(output,{recursive:true});
try{
 for(const [width,language,theme] of [[390,'ar','dark'],[1280,'en','light']]){
  const context=await browser.newContext({viewport:{width,height:900}});let state=null,config,correction;
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());if(u.origin===base.origin)return route.continue();
   const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(u.pathname==='/auth/v1/user')return json(user);
   if(u.pathname==='/rest/v1/users')return json({...user,role:'instructor',full_name:'Attendance test',major:'mathematics'});
   if(u.pathname==='/rest/v1/rpc/my_attendance_sections')return json([{id:course,title:'Section / شعبة',section_label:'01'}]);
   if(u.pathname==='/rest/v1/academic_lectures')return json([{id:lecture,course_id:course,title:'Lecture / محاضرة',starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+3600000).toISOString(),cancelled:false}]);
   if(u.pathname==='/rest/v1/rpc/get_attendance_session')return json(state?{id:session,state,expires_at:new Date(Date.now()+300000).toISOString(),qr_interval_seconds:30,serverTime:new Date().toISOString()}:null);
   if(u.pathname==='/rest/v1/rpc/attendance_session_roster_v2')return json([{student_id:id,full_name:'طالب تجريبي / Student',user_number:'202600001'}]);
   if(u.pathname==='/rest/v1/rpc/open_attendance_v2'){config=route.request().postDataJSON();state='open';return json(session);}
   if(u.pathname==='/rest/v1/rpc/attendance_qr')return json({token:'synthetic-qr',serverTime:new Date().toISOString(),expiresAt:new Date(Date.now()+30000).toISOString(),intervalSeconds:30});
   if(u.pathname==='/rest/v1/rpc/correct_attendance'){correction=route.request().postDataJSON();return json(id);}
   if(u.pathname==='/rest/v1/rpc/cancel_attendance'){state='cancelled';return json(session);}
   if(u.pathname==='/rest/v1/rpc/attendance_report')return json({rows:[],total:0,stats:{eligible:0,present:0,absent:0,excused:0}});
   if(u.pathname.startsWith('/rest/v1/'))return json([]);return route.abort();
  });
  await context.addInitScript(({user,token,exp,theme,language})=>{localStorage.setItem('sb-rspdfdrmswixcmpozgzr-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_at:exp,expires_in:3600,token_type:'bearer',user}));localStorage.setItem('theme',theme);localStorage.setItem('yhub-language',language);localStorage.setItem('language',language);},{user,token,exp,theme,language});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(new URL('/y-attendance',base).href);await page.getByRole('heading',{name:'Y-Attendance',exact:true}).waitFor();
  const ar=language==='ar';await page.getByRole('combobox',{name:ar?'الشعبة':'Section',exact:true}).selectOption(course);
  await page.getByRole('combobox',{name:ar?'المحاضرة':'Lecture',exact:true}).selectOption(lecture);
  await page.getByRole('button',{name:ar?'15 دقيقة':'15 min',exact:true}).click();await page.getByRole('button',{name:ar?'30 ثانية':'30 sec',exact:true}).click();
  await page.getByRole('button',{name:ar?'فتح جلسة حضور':'Open attendance',exact:true}).click();
  await page.getByRole('img',{name:ar?'رمز الحضور المتجدد':'Rotating attendance QR'}).waitFor();
  assert.deepEqual(config,{p_lecture:lecture,p_duration_minutes:15,p_qr_seconds:30});
  const students=page.getByRole('combobox',{name:ar?'الطالب':'Student',exact:true});await students.selectOption(id);
  await page.getByRole('button',{name:ar?'حفظ التصحيح':'Save correction',exact:true}).click();
  await page.getByText(ar?'أكد الخادم إتمام الطلب.':'The server confirmed the request.',{exact:true}).waitFor();
  assert.deepEqual(correction,{p_session:session,p_student:id,p_status:'present',p_reason:null});
  assert.equal(await page.getByRole('option',{name:/excused|بعذر/i}).count(),0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`${output}/${width}-${language}-${theme}.png`,fullPage:true});
  await page.getByRole('button',{name:ar?'إلغاء جلسة الحضور':'Cancel attendance session',exact:true}).click();
  await page.getByText(ar?/ملغاة ·/:/Cancelled ·/).waitFor();assert.equal(await page.getByRole('button',{name:ar?'حفظ التصحيح':'Save correction',exact:true}).count(),0);
  assert.deepEqual(errors,[]);console.log(`PASS ${width}/${language}/${theme}: configuration, QR, correction without reason, cancellation and no page overflow.`);await context.close();
 }
}finally{await browser.close();}
