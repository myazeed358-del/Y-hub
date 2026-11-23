import type {LectureConnection, LectureProvider} from './provider';

export type ConnectionStatus = 'connecting' | 'ready' | 'reconnecting' | 'failed';

/** Every transport recovery obtains a new admission receipt; old rooms close first. */
export function startLectureConnection(options: {
 join: () => Promise<{url: string; token: string; moderator: boolean}>;
 connect: LectureProvider['connect'];
 status: (status: ConnectionStatus, connection: LectureConnection | null, moderator: boolean) => void;
 update: () => void;
 chat: Parameters<LectureProvider['connect']>[3];
}) {
 let stopped = false, pending = false, retries = 0;
 let current: LectureConnection | null = null;
 let unclosed: LectureConnection | null = null;
 let timer: ReturnType<typeof setTimeout> | undefined;
 const status = (value: ConnectionStatus) => {if (!stopped) options.status(value, current, false);};

 async function attempt() {
  if (stopped || pending) return;
  pending = true;
  let lost = false, recovering = false;
  status(retries ? 'reconnecting' : 'connecting');
  async function recover() {
   if (stopped || recovering) return;
   recovering = true;
   pending = true;
   const old = current;
   current = null;
   status('reconnecting');
   try {await old?.disconnect();} catch {unclosed = old; pending = false; status('failed'); return;}
   pending = false;
   if (stopped) return;
   if (retries >= 3) {status('failed'); return;}
   timer = setTimeout(() => {timer = undefined; void attempt();}, 1000 * 2 ** retries++);
  }
  try {
   const receipt = await options.join();
   if (stopped) return;
   const connected = await options.connect(receipt.url, receipt.token,
    () => {if (!stopped && !lost) options.update();},
    chat => {if (!stopped && !lost) options.chat(chat);},
    () => {if (stopped || lost) return; lost = true; if (!pending) void recover();});
   if (stopped || lost) {
    try {await connected.disconnect();} catch {unclosed = connected; throw new Error('Room cleanup failed');}
    if (!stopped) await recover();
    return;
   }
   current = connected;
   pending = false;
   options.status('ready', current, receipt.moderator);
   options.update();
  } catch {
   pending = false;
   status('failed'); // Admission failures never trigger an automatic retry loop.
  }
 }
 void attempt();
 return {
  retry() {
   if (stopped || pending || current || timer !== undefined) return;
   pending = true;
   void (async () => {
    try {await unclosed?.disconnect(); unclosed = null;} catch {pending = false; status('failed'); return;}
    pending = false; retries = 0; void attempt();
   })();
  },
  stop() {
   stopped = true; clearTimeout(timer); const old = current ?? unclosed; current = null; unclosed = null;
   void (async () => {try {await old?.disconnect();} catch {/* Already leaving; never open another room. */}})();
  },
 };
}
