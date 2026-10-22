import { beforeEach, expect, it, vi } from 'vitest';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('@/utils/supabaseClient',()=>({supabase:{rpc}}));
import { syllabusRepository } from '../services/syllabusRepository';
const courseId='00000000-0000-4000-8000-000000000001';
const snapshot={courseId,revision:2,units:[{id:'00000000-0000-4000-8000-000000000002',title:' Unit ',sections:[]}]};
beforeEach(()=>rpc.mockReset());
it('reads a single snapshot by section UUID, never by course code',async()=>{
 rpc.mockResolvedValue({data:snapshot,error:null});
 expect((await syllabusRepository.read(courseId)).units[0].title).toBe('Unit');
 expect(rpc).toHaveBeenCalledWith('read_course_syllabus',{p_course_id:courseId});
});
it.each([null,{...snapshot,courseId:'wrong'}, {...snapshot,revision:-1}])('rejects unavailable/mismatched/invalid snapshots',async data=>{
 rpc.mockResolvedValue({data,error:null}); await expect(syllabusRepository.read(courseId)).rejects.toThrow();
});
it('saves with the expected server revision and no claimed actor',async()=>{
 rpc.mockResolvedValue({data:4,error:null});expect((await syllabusRepository.save(snapshot)).revision).toBe(4);
 expect(rpc).toHaveBeenCalledWith('save_course_syllabus',{p_course_id:courseId,p_expected_revision:2,p_units:[{...snapshot.units[0],title:'Unit'}]});
});
it.each(['40001','42501','PGRST202'])('does not claim success on %s',async code=>{
 rpc.mockResolvedValue({data:null,error:{code}});await expect(syllabusRepository.save(snapshot)).rejects.toThrow();
});
it.each([null,1,'4'])('requires a valid save acknowledgment',async data=>{
 rpc.mockResolvedValue({data,error:null});await expect(syllabusRepository.save(snapshot)).rejects.toThrow('invalid');
});
it('validates titles before sending a mutation',async()=>{
 await expect(syllabusRepository.save({...snapshot,units:[{...snapshot.units[0],title:''}]})).rejects.toThrow('invalid');
 expect(rpc).not.toHaveBeenCalled();
});

it.each(['40001','PT409'])('preserves edits as a %s conflict rather than suggesting a network retry',async code=>{
 rpc.mockResolvedValue({data:null,error:{code}});
 await expect(syllabusRepository.save(snapshot)).rejects.toMatchObject({kind:'conflict'});
 expect(snapshot.units[0].title).toBe(' Unit ');
 expect(rpc).toHaveBeenCalledTimes(1);
});
