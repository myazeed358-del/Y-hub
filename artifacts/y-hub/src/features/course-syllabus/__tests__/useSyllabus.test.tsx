import { act,cleanup,renderHook,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
const repo=vi.hoisted(()=>({read:vi.fn(),save:vi.fn()}));
vi.mock('../services/syllabusRepository',async importOriginal=>({...await importOriginal<object>(),syllabusRepository:repo}));
import { useSyllabus } from '../hooks/useSyllabus';
import { SyllabusError } from '../services/syllabusRepository';
const snapshot={courseId:'section-a',revision:2,units:[{id:'unit-a',title:'Saved',sections:[]}]};
beforeEach(()=>{vi.resetAllMocks();repo.read.mockResolvedValue(structuredClone(snapshot));});
afterEach(cleanup);
it.each(['conflict','unavailable'] as const)('retains draft and expected revision after %s',async kind=>{
 const {result}=renderHook(()=>useSyllabus('section-a','user'));
 await waitFor(()=>expect(result.current.snapshot).not.toBeNull());
 act(()=>result.current.update([{...snapshot.units[0],title:'Retain me'}]));
 repo.save.mockRejectedValue(new SyllabusError(kind));
 await act(async()=>{await result.current.save();});
 expect(result.current.snapshot?.units[0].title).toBe('Retain me');
 expect(result.current.snapshot?.revision).toBe(2);expect(result.current.dirty).toBe(true);expect(result.current.error).toBe(kind);
});
it('does not invent a default syllabus on read failure',async()=>{
 repo.read.mockRejectedValue(Error('offline'));const {result}=renderHook(()=>useSyllabus('section-a','user'));
 await waitFor(()=>expect(result.current.error).toBe('unavailable'));expect(result.current.snapshot).toBeNull();
});
it('ignores delayed reads from another section/account',async()=>{
 let resolve!:(v:typeof snapshot)=>void;repo.read.mockReturnValueOnce(new Promise(r=>resolve=r));
 const {result,rerender}=renderHook(({id,user})=>useSyllabus(id,user),{initialProps:{id:'section-a',user:'first'}});
 repo.read.mockResolvedValue({...snapshot,courseId:'section-b'});rerender({id:'section-b',user:'second'});
 await waitFor(()=>expect(result.current.snapshot?.courseId).toBe('section-b'));
 await act(async()=>resolve(snapshot));expect(result.current.snapshot?.courseId).toBe('section-b');
});
it('serializes duplicate save clicks and accepts only the confirmed server revision',async()=>{
 const {result}=renderHook(()=>useSyllabus('section-a','user'));await waitFor(()=>expect(result.current.snapshot).not.toBeNull());
 act(()=>result.current.update([{...snapshot.units[0],title:'Changed'}]));
 let resolve!:(v:typeof snapshot)=>void;repo.save.mockReturnValue(new Promise(r=>resolve=r));
 act(()=>{void result.current.save();void result.current.save();});expect(repo.save).toHaveBeenCalledTimes(1);
 await act(async()=>resolve({...snapshot,revision:5}));expect(result.current.dirty).toBe(false);expect(result.current.snapshot?.revision).toBe(5);
});
it('does not apply an old save after switching sections',async()=>{
 const {result,rerender}=renderHook(({id})=>useSyllabus(id,'user'),{initialProps:{id:'section-a'}});
 await waitFor(()=>expect(result.current.snapshot).not.toBeNull());
 let resolve!:(v:typeof snapshot)=>void;repo.save.mockReturnValue(new Promise(r=>resolve=r));act(()=>{void result.current.save();});
 repo.read.mockResolvedValue({...snapshot,courseId:'section-b',revision:7});rerender({id:'section-b'});
 await waitFor(()=>expect(result.current.snapshot?.courseId).toBe('section-b'));
 await act(async()=>resolve({...snapshot,revision:8}));expect(result.current.snapshot?.courseId).toBe('section-b');expect(result.current.snapshot?.revision).toBe(7);
});
