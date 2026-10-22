import {expect,it} from 'vitest';
import {canAccessModule} from '../access';
import {moduleRegistry} from '../discovery';
import {getModuleNavigation} from '../navigation';
const policy={roles:['student'] as const,majors:['mathematics']};
it('server grants relax only the matching engine major',()=>{
 const context={role:'student' as const,major:'medicine',engineGrants:['ode']};
 expect(canAccessModule(policy,context,'ode')).toBe(true);
 expect(canAccessModule(policy,context,'linear-algebra')).toBe(false);
 expect(canAccessModule(policy,context)).toBe(false);
 expect(canAccessModule({...policy,permissions:['course:manage']},context,'ode')).toBe(false);
 expect(canAccessModule(policy,{...context,role:'instructor'},'ode')).toBe(false);
});
it('granted engine appears in existing navigation and disappears on revocation',()=>{
 const context={role:'student' as const,major:'medicine',engineGrants:['ode']};
 expect(getModuleNavigation(moduleRegistry,context).some(r=>r.href==='/ode')).toBe(true);
 expect(getModuleNavigation(moduleRegistry,{...context,engineGrants:[]}).some(r=>r.href==='/ode')).toBe(false);
});
