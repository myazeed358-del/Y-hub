// Real route/React/KaTeX; synthetic HTTP only. Blocks all external traffic.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.YHUB_PLAYWRIGHT_MODULE?pathToFileURL(process.env.YHUB_PLAYWRIGHT_MODULE).href:'playwright-core');
const base=new URL(process.env.YHUB_BROWSER_BASE_URL||'http://127.0.0.1:5175');assert(['localhost','127.0.0.1'].includes(base.hostname));
const browser=await chromium.launch({executablePath:process.env.YHUB_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const id='00000000-0000-4000-8000-000000000001',course='00000000-0000-4000-8000-000000000002',source='00000000-0000-4000-8000-000000000003';
const user={id,email:'tutor@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const exp=Math.floor(Date.now()/1000)+3600,token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,aud:'authenticated',exp})).toString('base64url')}.synthetic`;
const output=process.env.YHUB_SCREENSHOTS||'/workspace/tutor-math-screenshots';await mkdir(output,{recursive:true});
const arabic=String.raw`نستخدم قاعدة القوة لاشتقاق كل حد على حدة:
\[\frac{d}{dx}(x^n)=nx^{n-1}\]
بالتالي:
\[f'(x)=3x^2+4x-5\]
إذن المشتقة النهائية هي:
\[\boxed{f'(x)=3x^2+4x-5}\]`;
const english=String.raw`Apply the power rule to each term:
\[\frac{d}{dx}(x^n)=nx^{n-1}\]
Combining the terms gives:
\[\boxed{f'(x)=3x^2+4x-5}\]`;
const extra=String.raw`

\[\begin{pmatrix}1&2\\3&4\end{pmatrix}\]

\[\int 2x\,dx=x^2+C\]

\[\sqrt{x^2+1}+\lim_{x\to0}\frac{\sin x}{x}+\alpha+\beta\]

\[\frac{dy}{dx}+2y=e^x\]`;
try{
 for(const [width,theme,role,choice,questionLanguage] of [[1280,'light','student','auto','ar'],[390,'dark','student','auto','ar'],[1280,'dark','instructor','en','ar'],[390,'light','student','ar','en'],[1280,'light','student','auto','en']]){
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
    const language=sent.language||(questionLanguage==='ar'?'ar':'en');
    return json({answer:(language==='ar'?arabic:english)+extra+'\n\n$$'+Array.from({length:70},(_,i)=>`x_{${i}}^2`).join('+')+'=0$$\n\n```python\ndef derivative(x):\n    return 3*x**2+4*x-5\n```',insufficient:false,citations:[{id:'chunk',source_id:source,revision:'revision',title:item.title,page:2,unit_id:null,text:'The derivative of x squared is twice x.'}]});
   }
   if(u.pathname.startsWith('/rest/v1/'))return json([]);return route.abort();
  });
  await context.addInitScript(({user,token,exp,theme})=>{localStorage.setItem('sb-rspdfdrmswixcmpozgzr-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_at:exp,expires_in:3600,token_type:'bearer',user}));localStorage.setItem('theme',theme);},{user,token,exp,theme});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL(`/course/${course}/ai-tutor`,base).href);
  await page.getByRole('heading',{name:'AI Tutor: Calculus'}).waitFor();
  if(role==='instructor'){await page.getByRole('button',{name:'Reindex / إعادة فهرسة'}).click();await page.getByRole('button',{name:'Reindex / إعادة فهرسة'}).waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('select[aria-label="Source / المصدر"]')?.disabled);assert.equal(indexed,1);}else assert.equal(await page.getByRole('button',{name:'Reindex / إعادة فهرسة'}).count(),0);
  await page.getByRole('combobox',{name:'Source / المصدر'}).selectOption(source);
  await page.getByRole('combobox',{name:'لغة الشرح / Explanation language'}).selectOption(choice);
  const input=page.getByPlaceholder('Ask about the course / اسأل عن مواد الشعبة');await input.fill((questionLanguage==='ar'?'احسب مشتقة الدالة ':'Differentiate ')+String.raw`\(f(x)=x^3+2x^2-5x+1\)`);await page.getByRole('button',{name:'Send message'}).click();
  await page.locator('[data-message-role=ai] .katex-display').first().waitFor();assert.deepEqual(Object.keys(sent).sort(),choice==='auto'?['courseId','question','sourceId']:['courseId','language','question','sourceId']);
  const expected=(choice==='auto'?questionLanguage:choice)==='ar'?'rtl':'ltr';
  assert.equal(await page.locator('[data-message-role=ai] .ai-tutor-message').getAttribute('dir'),expected);
  assert.equal(await page.locator('[data-message-role=user] .ai-tutor-message').getAttribute('dir'),questionLanguage==='ar'?'rtl':'ltr');
  assert.equal(await page.locator('.katex-error').count(),0);assert(await page.locator('.mtable').count()>0);
  assert(await page.locator('[data-message-role=user] .katex').count()>0);
  assert(await page.locator('.katex').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).direction==='ltr')));
  assert.equal(await page.locator('[data-message-role=ai] pre').count(),1);assert((await page.locator('[data-message-role=ai] pre').innerText()).includes('def derivative'));
  const long=page.locator('[data-message-role=ai] .katex-display').last();
  assert(await long.evaluate(e=>e.scrollWidth>e.clientWidth));
  await long.evaluate(e=>{e.scrollLeft=e.scrollWidth;});assert(await long.evaluate(e=>e.scrollLeft>0));
  await page.locator('[data-message-role=ai]').evaluate(e=>{const panel=e.parentElement;panel.scrollTop+=e.getBoundingClientRect().top-panel.getBoundingClientRect().top;});
  await page.screenshot({fullPage:true,path:`${output}/${width}-${theme}-${choice}-${questionLanguage}.png`});
  await page.locator('summary').filter({hasText:'Trusted lecture'}).click();await page.getByText('The derivative of x squared is twice x.',{exact:true}).waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  allowed=false;await input.fill('Second question');await page.getByRole('button',{name:'Send message'}).click();await page.getByText('التسجيل مطلوب',{exact:true}).waitFor();assert.equal(await page.locator('.katex').count(),0);assert.deepEqual(errors,[]);
  console.log(`PASS tutor ${width}/${theme}/${role}: section source selection, trusted evidence, math, management controls, revoked access clears conversation.`);await context.close();
 }
}finally{await browser.close();}
