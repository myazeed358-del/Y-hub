import {Room,RoomEvent,ParticipantEvent,Track,type Participant} from 'livekit-client';
export interface LectureParticipant {id:string;name:string;local:boolean;moderator:boolean;tracks:{id:string;kind:'audio'|'video';track:MediaStreamTrack}[]}
export interface LectureChat {id:string;sender:string;message:string}
export interface LectureConnection {
 participants():LectureParticipant[];
 microphone(on:boolean):Promise<void>;camera(on:boolean):Promise<void>;screen(on:boolean):Promise<void>;
 send(message:string):Promise<void>;audio():Promise<void>;disconnect():Promise<void>;
}
export interface LectureProvider {connect(url:string,token:string,onUpdate:()=>void,onChat:(chat:LectureChat)=>void,onDisconnect:()=>void):Promise<LectureConnection>}
/** Replaceable SFU adapter; application components never handle provider secrets. */
export const livekitProvider:LectureProvider={
 async connect(url,token,onUpdate,onChat,onDisconnect){
  if(!url.startsWith('wss://'))throw new Error('Secure media endpoint required');
  const room=new Room({adaptiveStream:true,dynacast:true});
  const update=()=>onUpdate();
  for(const event of [RoomEvent.ParticipantConnected,RoomEvent.ParticipantDisconnected,RoomEvent.TrackSubscribed,RoomEvent.TrackUnsubscribed,RoomEvent.LocalTrackPublished,RoomEvent.LocalTrackUnpublished,RoomEvent.TrackMuted,RoomEvent.TrackUnmuted])room.on(event,update);
  room.on(RoomEvent.Disconnected,onDisconnect);
  room.on(RoomEvent.DataReceived,(bytes,participant)=>{
   if(!participant||bytes.length>4096)return;
   try{const data=JSON.parse(new TextDecoder().decode(bytes));if(typeof data.message==='string'&&data.message.length<=1000)onChat({id:crypto.randomUUID(),sender:participant.name||participant.identity,message:data.message});}catch{/* Ignore malformed peer data. */}
  });
  function snapshot(p:Participant):LectureParticipant{
   let moderator=false;try{moderator=JSON.parse(p.metadata??'{}').moderator===true;}catch{/* Unrecognized metadata has no UI privileges. */}
   return {id:p.identity,name:p.name||p.identity,local:p===room.localParticipant,moderator,tracks:Array.from(p.trackPublications.values()).flatMap(pub=>{
    const track=pub.track;if(!track||pub.isMuted||(track.kind!==Track.Kind.Audio&&track.kind!==Track.Kind.Video))return [];
    return [{id:pub.trackSid,kind:track.kind,track:track.mediaStreamTrack}];
   })};
  }
  try{await room.connect(url,token);}catch(e){await room.disconnect();throw e;}
  room.localParticipant.on(ParticipantEvent.LocalTrackPublished,update);
  return {participants:()=>[room.localParticipant,...room.remoteParticipants.values()].map(snapshot),
   microphone:async on=>{await room.localParticipant.setMicrophoneEnabled(on);update();},
   camera:async on=>{await room.localParticipant.setCameraEnabled(on);update();},
   screen:async on=>{await room.localParticipant.setScreenShareEnabled(on);update();},
   send:async message=>{const trimmed=message.trim();if(!trimmed||trimmed.length>1000)throw new Error('Invalid chat length');const data=new TextEncoder().encode(JSON.stringify({message:trimmed}));if(data.length>4096)throw new Error('Message too large');await room.localParticipant.publishData(data,{reliable:true});onChat({id:crypto.randomUUID(),sender:room.localParticipant.name||room.localParticipant.identity,message:trimmed});},
   audio:()=>room.startAudio(),disconnect:()=>room.disconnect(),
  };
 },
};
