import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {startLectureConnection} from '../connectionLifecycle';
import type {LectureConnection,LectureProvider} from '../provider';
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>vi.useRealTimers());
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function setup(){
 const callbacks:(()=>void)[]=[];
 const rooms:LectureConnection[]=[];
 const join=vi.fn().mockResolvedValue({url:'wss://test',token:'initial',moderator:false});
 const connect=vi.fn<LectureProvider['connect']>().mockImplementation(async(_url,_token,_update,_chat,lost)=>{
  callbacks.push(lost);
  const room={participants:()=>[],microphone:vi.fn(),camera:vi.fn(),screen:vi.fn(),send:vi.fn(),audio:vi.fn(),disconnect:vi.fn().mockResolvedValue(undefined)};
  rooms.push(room);return room;
 });
 const status=vi.fn(),update=vi.fn(),chat=vi.fn();
 const lifecycle=startLectureConnection({join,connect,status,update,chat});
 return {join,connect,status,update,chat,lifecycle,rooms,callbacks};
}
it('closes the old room, coalesces duplicate loss events and obtains a fresh token',async()=>{
 const s=setup();await flush();s.join.mockResolvedValue({url:'wss://test',token:'fresh',moderator:false});
 s.callbacks[0]();s.callbacks[0]();await flush();
 expect(s.rooms[0].disconnect).toHaveBeenCalledOnce();expect(s.join).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(1000);expect(s.join).toHaveBeenCalledTimes(2);expect(s.connect.mock.calls[1][1]).toBe('fresh');
 expect(s.rooms[1].microphone).not.toHaveBeenCalled();expect(s.rooms[1].camera).not.toHaveBeenCalled();s.lifecycle.stop();
});
it('waits for old-room cleanup before admitting another participant',async()=>{
 const s=setup();await flush();let close!:()=>void;
 vi.mocked(s.rooms[0].disconnect).mockReturnValue(new Promise<void>(r=>close=r));s.callbacks[0]();
 s.lifecycle.retry();s.lifecycle.retry();
 await vi.advanceTimersByTimeAsync(5000);expect(s.join).toHaveBeenCalledTimes(1);
 close();await flush();await vi.advanceTimersByTimeAsync(1000);expect(s.join).toHaveBeenCalledTimes(2);s.lifecycle.stop();
});
it('fails closed when renewed admission is denied and permits a deliberate retry',async()=>{
 const s=setup();await flush();s.join.mockRejectedValue(new Error('withdrawn'));s.callbacks[0]();await vi.advanceTimersByTimeAsync(1000);
 expect(s.connect).toHaveBeenCalledTimes(1);expect(s.status).toHaveBeenLastCalledWith('failed',null,false);
 await vi.advanceTimersByTimeAsync(60000);expect(s.join).toHaveBeenCalledTimes(2);
 s.join.mockResolvedValue({url:'wss://test',token:'renewed',moderator:false});s.lifecycle.retry();s.lifecycle.retry();await flush();
 expect(s.join).toHaveBeenCalledTimes(3);expect(s.connect).toHaveBeenCalledTimes(2);s.lifecycle.stop();
});
it('bounds automatic recovery to three attempts with backoff',async()=>{
 const s=setup();await flush();
 for(const [index,delay] of [1000,2000,4000].entries()){s.callbacks[index]();await vi.advanceTimersByTimeAsync(delay);}
 expect(s.join).toHaveBeenCalledTimes(4);s.callbacks[3]();await flush();expect(s.status).toHaveBeenLastCalledWith('failed',null,false);
 await vi.advanceTimersByTimeAsync(60000);expect(s.join).toHaveBeenCalledTimes(4);s.lifecycle.stop();
});
it('cancels scheduled retries on leave and ignores late peer messages',async()=>{
 const s=setup();await flush();s.callbacks[0]();await flush();s.lifecycle.stop();await vi.advanceTimersByTimeAsync(60000);
 s.connect.mock.calls[0][3]({id:'late',sender:'peer',message:'old'});expect(s.chat).not.toHaveBeenCalled();expect(s.join).toHaveBeenCalledTimes(1);
});
it('disconnects a late connection after the view leaves',async()=>{
 const s=setup();let resolve!:(room:LectureConnection)=>void;s.connect.mockImplementation(()=>new Promise(r=>resolve=r));await flush();s.lifecycle.stop();
 const room={disconnect:vi.fn().mockResolvedValue(undefined)} as unknown as LectureConnection;resolve(room);await flush();expect(room.disconnect).toHaveBeenCalledOnce();expect(s.status).not.toHaveBeenCalledWith('ready',expect.anything(),expect.anything());
});
it('does not reconnect while cleanup is failing; manual retry retries cleanup first',async()=>{
 const s=setup();await flush();vi.mocked(s.rooms[0].disconnect).mockRejectedValue(new Error('cleanup'));s.callbacks[0]();await flush();
 s.lifecycle.retry();await flush();await vi.advanceTimersByTimeAsync(60000);expect(s.join).toHaveBeenCalledTimes(1);
 vi.mocked(s.rooms[0].disconnect).mockResolvedValue();s.lifecycle.retry();await flush();expect(s.join).toHaveBeenCalledTimes(2);s.lifecycle.stop();
});
it('recovers a transport loss reported before connect resolves without publishing a stale room',async()=>{
 const s=setup();const implementation=s.connect.getMockImplementation()!;
 s.connect.mockImplementationOnce(async(...args)=>{const room=await implementation(...args);args[4]();return room;});await flush();
 expect(s.rooms[0].disconnect).toHaveBeenCalledOnce();expect(s.status.mock.calls.some(c=>c[0]==='ready')).toBe(false);
 await vi.advanceTimersByTimeAsync(1000);expect(s.join).toHaveBeenCalledTimes(2);s.lifecycle.stop();
});
