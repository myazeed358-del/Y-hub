import type { ModuleManifest } from '../contracts';
export default {
 id:'engine-access',version:'1.0.0',apiVersion:2,kind:'application',category:'education',
 title:{ar:'صلاحيات المحركات',en:'Engine permissions'},
 access:{roles:['instructor','admin','super_admin']},
 routes:[{path:'/engine-access',load:()=>import('@/features/engine-access'),navigation:{group:'learning',iconId:'box',order:45}}],
} satisfies ModuleManifest;
