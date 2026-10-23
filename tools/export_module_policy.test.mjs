import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {modulePolicies} from './export_module_policy.mjs';
test('all enabled current modules export policy without entry execution',async()=>{
 const modules=await modulePolicies();assert(modules.some(m=>m.id==='engine-access'));assert(!modules.some(m=>m.id==='discovery-example'));assert(modules.filter(m=>m.kind==='engine').length>=7);
});
test('a compliant new module needs no central export registration',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'yhub-policy-'));
 try {await mkdir(path.join(root,'new-tool'));await writeFile(path.join(root,'new-tool/module.ts'),`export default {id:'new-tool',apiVersion:2,kind:'application',title:{en:'New',ar:'جديد'},access:{roles:['student']},routes:[{path:'/new-tool',load:()=>{throw new Error('must stay lazy')}}]}`);assert.equal((await modulePolicies(root))[0].id,'new-tool');}
 finally{await rm(root,{recursive:true});}
});
