import {createLectureHandler} from './handler.ts';
const get=(key:string)=>Deno.env.get(key)??'';
Deno.serve(createLectureHandler({supabaseUrl:get('SUPABASE_URL'),anonKey:get('SUPABASE_ANON_KEY'),serviceKey:get('SUPABASE_SERVICE_ROLE_KEY'),livekitUrl:get('LIVEKIT_URL'),apiKey:get('LIVEKIT_API_KEY'),apiSecret:get('LIVEKIT_API_SECRET'),reconcileSecret:get('LECTURE_RECONCILE_SECRET'),origins:get('YHUB_BROWSER_ORIGINS').split(',').map(s=>s.trim()).filter(Boolean)}));
