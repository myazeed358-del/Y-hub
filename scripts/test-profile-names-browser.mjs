// Actual routes/forms/React/CSS; all non-local HTTP intercepted. Not live Supabase proof.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.YHUB_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.YHUB_PLAYWRIGHT_MODULE).href : 'playwright-core');
const base = new URL(process.env.YHUB_BROWSER_BASE_URL || 'http://127.0.0.1:5175');
assert(['localhost','127.0.0.1'].includes(base.hostname));
const output = process.env.YHUB_SCREENSHOTS || '/workspace/profile-names-screenshots';
await mkdir(output,{recursive:true});
const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const id='00000000-0000-4000-8000-000000000001';
const user={id,email:'names@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const exp=Math.floor(Date.now()/1000)+3600;
const token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,aud:'authenticated',exp})).toString('base64url')}.synthetic`;
try {
 for(const [width,language,theme,role] of [[390,'ar','dark','student'],[1280,'en','light','instructor']]) {
  const context=await browser.newContext({viewport:{width,height:900}});
  let profile={...user,role,full_name:'Legacy Student',full_name_ar:null,full_name_en:null,major:'mathematics',user_number:'001234567'};
  let attempts=0;
  const requests=[];
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin===base.origin)return route.continue();
   const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(url.pathname==='/auth/v1/user')return json(user);
   if(url.pathname==='/rest/v1/users')return json(profile);
   if(url.pathname==='/rest/v1/rpc/complete_own_profile_names'){
    const data=route.request().postDataJSON();requests.push(data);attempts++;
    if(attempts===1)return json({message:'fixture connection failure'},503);
    profile={...profile,full_name_ar:data.p_ar,full_name_en:data.p_en};return route.fulfill({status:204});
   }
   if(url.pathname.startsWith('/rest/v1/'))return json([]);
   return route.abort();
  });
  await context.addInitScript(({user,token,exp,theme,language})=>{
   localStorage.setItem('sb-rspdfdrmswixcmpozgzr-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_at:exp,expires_in:3600,token_type:'bearer',user}));
   localStorage.setItem('yhub-language',language);localStorage.setItem('theme',theme);
  },{user,token,exp,theme,language});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('/profile',base).href);
  const arabic=page.locator('#profile-name-ar'),english=page.locator('#profile-name-en');
  await arabic.fill('أحمد عبد الله');await english.fill('Ahmad Abdullah');
  assert.equal(await arabic.getAttribute('dir'),'rtl');assert.equal(await english.getAttribute('dir'),'ltr');
  const submit=page.getByRole('button',{name:language==='ar'?'استكمال الاسمين':'Complete names',exact:true});
  await submit.click();await page.getByRole('alert').waitFor();
  assert.equal(await english.inputValue(),'Ahmad Abdullah');
  await submit.click();await page.waitForFunction(()=>document.querySelector('#profile-name-en')?.readOnly===true);
  assert.equal(requests.length,2);assert.deepEqual(requests[1],{p_ar:'أحمد عبد الله',p_en:'Ahmad Abdullah'});
  assert.equal(profile.full_name,'Legacy Student');assert.equal(profile.user_number,'001234567');
  await page.getByRole('heading',{name:language==='ar'?'أحمد عبد الله':'Ahmad Abdullah',exact:true}).waitFor();
  await page.getByTestId('button-language-toggle').click();
  await page.getByRole('heading',{name:language==='ar'?'Ahmad Abdullah':'أحمد عبد الله',exact:true}).waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`${output}/${width}-${language}-${role}.png`,fullPage:true});
  assert.deepEqual(errors,[]);console.log(`PASS profile ${width}/${language}/${role}: retry, immutable number, localized identity, read-only saved names, responsive.`);
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:900}});
 let submitted;
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin===base.origin)return route.continue();
  if(url.pathname==='/auth/v1/signup'){
   submitted=route.request().postDataJSON();return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user,session:null})});
  }
  return route.abort();
 });
 await context.addInitScript(()=>localStorage.setItem('yhub-language','en'));
 const page=await context.newPage();await page.goto(new URL('/login?mode=signup',base).href);
 await page.locator('#full_name_ar').fill('أحمد عبد الله');await page.locator('#full_name_en').fill('Ahmad Abdullah');
 await page.locator('#age').fill('20');await page.locator('#phone').fill('0790000000');
 await page.locator('input[type="email"]').fill('fixture@example.invalid');await page.locator('input[type="password"]').fill('Local-fixture-only-123!');
 await page.getByRole('combobox').nth(0).click();await page.getByRole('option',{name:'Mathematics',exact:true}).click();
 await page.getByRole('combobox').nth(1).click();await page.getByRole('option').first().click();
 await page.locator('button[type="submit"]').click();
 await page.waitForFunction(()=>!document.querySelector('#full_name_ar'));
 assert.equal(submitted.data.full_name_ar,'أحمد عبد الله');assert.equal(submitted.data.full_name_en,'Ahmad Abdullah');assert.equal(submitted.data.role,undefined);
 console.log('PASS signup: actual form submits both localized names without a client-selected role.');
 await context.close();
} finally { await browser.close(); }
