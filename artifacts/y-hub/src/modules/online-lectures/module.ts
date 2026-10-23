import type {ModuleManifest} from '../contracts';
export default {
 id:'online-lectures',version:'1.0.0',apiVersion:2,kind:'application',category:'education',
 title:{ar:'المحاضرات المباشرة',en:'Online lectures'},access:{roles:['student','instructor','admin','super_admin']},
 routes:[{path:'/online-lectures',load:()=>import('@/features/online-lectures'),navigation:{group:'learning',iconId:'box',order:55}}],
} satisfies ModuleManifest;
