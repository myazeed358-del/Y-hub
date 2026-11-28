import {beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({listeners:new Map<string,(...args:unknown[])=>void>(),connect:vi.fn(),disconnect:vi.fn(),create:vi.fn()}));
vi.mock('livekit-client',async importOriginal=>{
 const actual=await importOriginal<typeof import('livekit-client')>();
 return {...actual,Room:class {
  constructor(options:unknown){mock.create(options);}
  on(event:string,callback:(...args:unknown[])=>void){mock.listeners.set(event,callback);return this;}
  connect=mock.connect;disconnect=mock.disconnect;
  localParticipant={on:vi.fn()};remoteParticipants=new Map();
 }};
});
import {RoomEvent} from 'livekit-client';
import {livekitProvider} from '../provider';
beforeEach(()=>{vi.resetAllMocks();mock.listeners.clear();mock.connect.mockResolvedValue(undefined);mock.disconnect.mockResolvedValue(undefined);});
it('reports SDK reconnect and disconnect events for fresh application admission',async()=>{
 const lost=vi.fn();const connection=await livekitProvider.connect('wss://test','receipt',vi.fn(),vi.fn(),lost);
 mock.listeners.get(RoomEvent.Reconnecting)!();mock.listeners.get(RoomEvent.Disconnected)!();expect(lost).toHaveBeenCalledTimes(2);
 expect(mock.create).toHaveBeenCalledWith({adaptiveStream:true,dynacast:true});await connection.disconnect();expect(mock.disconnect).toHaveBeenCalledOnce();
});
it('closes the SDK room if connection fails',async()=>{
 mock.connect.mockRejectedValue(new Error('transport'));await expect(livekitProvider.connect('wss://test','receipt',vi.fn(),vi.fn(),vi.fn())).rejects.toThrow('transport');expect(mock.disconnect).toHaveBeenCalledOnce();
});
it('rejects insecure endpoints before constructing a room',async()=>{
 await expect(livekitProvider.connect('ws://test','receipt',vi.fn(),vi.fn(),vi.fn())).rejects.toThrow('Secure');expect(mock.create).not.toHaveBeenCalled();
});
