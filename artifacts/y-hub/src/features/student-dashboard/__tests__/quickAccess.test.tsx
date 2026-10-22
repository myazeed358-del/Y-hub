import {act,renderHook,waitFor} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({read:vi.fn(),save:vi.fn()}));
vi.mock('../services/quickAccessRepository',()=>({quickAccessRepository:mocks}));
vi.mock('@/modules',()=>({moduleRegistry:{routes:[{path:'/a',module:{id:'a'}},{path:'/b',module:{id:'b'}}]}}));
import {useQuickAccess} from '../hooks/useQuickAccess';
const snapshot=(revision=0,paths=['/a'])=>({revision,paths,available:['a','b'].map(id=>({path:'/'+id,moduleId:id,title:{ar:id,en:id},icon:'box',dashboardOrder:null}))});
beforeEach(()=>{vi.resetAllMocks();mocks.read.mockResolvedValue(snapshot());mocks.save.mockResolvedValue(1);});
describe('existing Quick Access preferences',()=>{
 it('handles the signed-out transition without accessing another account',()=>{
  const {result}=renderHook(()=>useQuickAccess(undefined,'en'));expect(result.current.tools).toEqual([]);expect(result.current.loading).toBe(false);expect(mocks.read).not.toHaveBeenCalled();
 });
 it('loads account choices and saves an explicitly empty selection',async()=>{
  const {result}=renderHook(()=>useQuickAccess('one','en'));await waitFor(()=>expect(result.current.tools).toHaveLength(1));
  act(()=>result.current.begin());act(()=>result.current.setDraft([]));mocks.read.mockResolvedValue(snapshot(1,[]));
  await act(()=>result.current.save());expect(mocks.save).toHaveBeenCalledWith(0,[]);expect(result.current.tools).toEqual([]);
 });
 it('retains draft and original revision when another device changes preferences',async()=>{
  const {result}=renderHook(()=>useQuickAccess('one','en'));await waitFor(()=>expect(result.current.loading).toBe(false));
  act(()=>result.current.begin());act(()=>result.current.setDraft(['/b','/a']));mocks.read.mockResolvedValue(snapshot(1,['/b']));
  await act(()=>result.current.refresh());expect(result.current.changedElsewhere).toBe(true);
  mocks.save.mockRejectedValue(new Error('conflict'));await act(()=>result.current.save());
  expect(mocks.save).toHaveBeenCalledWith(0,['/b','/a']);expect(result.current.draft).toEqual(['/b','/a']);expect(result.current.editing).toBe(true);
 });
 it('retains selection when acknowledgement is lost and reconciles by explicit account reload',async()=>{
  const {result}=renderHook(()=>useQuickAccess('one','en'));await waitFor(()=>expect(result.current.loading).toBe(false));
  act(()=>result.current.begin());act(()=>result.current.setDraft(['/b']));mocks.save.mockRejectedValue(new Error('unavailable'));
  await act(()=>result.current.save());expect(result.current.draft).toEqual(['/b']);
  mocks.read.mockResolvedValue(snapshot(1,['/b']));await act(()=>result.current.refresh());expect(result.current.changedElsewhere).toBe(true);
  act(()=>result.current.reload());expect(result.current.changedElsewhere).toBe(false);expect(result.current.draft).toEqual(['/b']);
 });
 it('hides revoked tools on focus and blocks saving a now forbidden selection',async()=>{
  const {result}=renderHook(()=>useQuickAccess('one','en'));await waitFor(()=>expect(result.current.loading).toBe(false));act(()=>result.current.begin());
  mocks.read.mockResolvedValue({...snapshot(1,[]),available:[]});act(()=>window.dispatchEvent(new Event('focus')));
  await waitFor(()=>expect(result.current.tools).toHaveLength(0));expect(result.current.invalidSelection).toBe(true);
  await act(()=>result.current.save());expect(mocks.save).not.toHaveBeenCalled();
 });
 it('ignores previous account acknowledgement',async()=>{
  let resolve!:(value:number)=>void;mocks.save.mockReturnValue(new Promise<number>(r=>resolve=r));
  const {result,rerender}=renderHook(({owner})=>useQuickAccess(owner,'en'),{initialProps:{owner:'one'}});
  await waitFor(()=>expect(result.current.loading).toBe(false));act(()=>result.current.begin());act(()=>result.current.setDraft(['/b']));
  let pending!:Promise<void>;act(()=>{pending=result.current.save();});mocks.read.mockResolvedValue(snapshot(8,[]));rerender({owner:'two'});
  await waitFor(()=>expect(result.current.loading).toBe(false));await act(async()=>{resolve(1);await pending;});expect(result.current.tools).toEqual([]);expect(result.current.editing).toBe(false);
 });
 it('does not replace an unsaved selection after an offline refresh',async()=>{
  const {result}=renderHook(()=>useQuickAccess('one','ar'));await waitFor(()=>expect(result.current.loading).toBe(false));act(()=>result.current.begin());
  mocks.read.mockRejectedValue(new Error('offline'));await act(()=>result.current.refresh());expect(result.current.draft).toEqual(['/a']);expect(result.current.tools).toEqual([]);
 });
});
