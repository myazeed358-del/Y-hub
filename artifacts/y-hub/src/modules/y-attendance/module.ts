import type {ModuleManifest} from '../contracts';
export default {
 id:'y-attendance',version:'1.0.0',apiVersion:2,kind:'application',category:'education',
 title:{ar:'الحضور والغياب',en:'Y-Attendance'},access:{roles:['student','instructor','admin','super_admin']},
 routes:[{path:'/y-attendance',load:()=>import('@/features/y-attendance'),navigation:{group:'learning',iconId:'activity',order:50}}],
} satisfies ModuleManifest;
