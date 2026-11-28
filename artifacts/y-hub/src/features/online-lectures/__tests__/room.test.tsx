import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({join:vi.fn(),remove:vi.fn(),connect:vi.fn(),disconnect:vi.fn(),microphone:vi.fn(),camera:vi.fn(),screen:vi.fn(),send:vi.fn(),audio:vi.fn()}));
vi.mock('../repository',()=>({lectureAccess:mock}));
vi.mock('../provider',()=>({livekitProvider:mock}));
import {LectureRoom} from '../LectureRoom';
afterEach(cleanup);
beforeEach(()=>{vi.resetAllMocks();mock.join.mockResolvedValue({url:'wss://media.test',token:'server-token',moderator:false});mock.connect.mockResolvedValue({...mock,participants:()=>[{id:'student',name:'Student',local:false,moderator:false,tracks:[]}]});});
it('does not connect or request camera/mic when server admission is denied',async()=>{
 mock.join.mockRejectedValue(new Error('denied'));render(<LectureRoom lecture="l" ar={false} onLeave={()=>{}}/>);
 expect(await screen.findByRole('alert')).toBeTruthy();expect(mock.connect).not.toHaveBeenCalled();expect(mock.camera).not.toHaveBeenCalled();
});
it('connects with server-issued token and enables devices only on explicit clicks',async()=>{
 render(<LectureRoom lecture="l" ar={false} onLeave={()=>{}}/>);await screen.findByText('Student');expect(mock.microphone).not.toHaveBeenCalled();expect(mock.camera).not.toHaveBeenCalled();
 expect(mock.connect.mock.calls[0].slice(0,2)).toEqual(['wss://media.test','server-token']);fireEvent.click(screen.getByText('Enable microphone'));await waitFor(()=>expect(mock.microphone).toHaveBeenCalledWith(true));
 expect(screen.queryByText('Remove participant')).toBeNull();
});
it('disconnects a connection that resolves after leaving the room',async()=>{
 let resolve!:(c:unknown)=>void;mock.connect.mockReturnValue(new Promise(r=>resolve=r));const view=render(<LectureRoom lecture="l" ar={false} onLeave={()=>{}}/>);
 await waitFor(()=>expect(mock.connect).toHaveBeenCalled());view.unmount();await act(async()=>resolve({...mock,participants:()=>[]}));expect(mock.disconnect).toHaveBeenCalledOnce();
});
it('keeps an unsent chat message when the media transport fails',async()=>{
 mock.send.mockRejectedValue(new Error('offline'));render(<LectureRoom lecture="l" ar={false} onLeave={()=>{}}/>);await screen.findByText('Student');
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'retain my message'}});fireEvent.click(screen.getByText('Send'));await screen.findByRole('alert');expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('retain my message');
});
it('renders remote chat as text and restricts removal UI to server-confirmed moderators',async()=>{
 mock.join.mockResolvedValue({url:'wss://media.test',token:'server-token',moderator:true});render(<LectureRoom lecture="l" ar={false} onLeave={()=>{}}/>);await screen.findByText('Student');
 act(()=>mock.connect.mock.calls[0][3]({id:'chat',sender:'User',message:'<img src=x onerror=attack()>'}));expect(screen.getByText('<img src=x onerror=attack()>')).toBeTruthy();expect(screen.queryByRole('img')).toBeNull();expect(screen.getByText('Remove participant')).toBeTruthy();
});
it('offers a manual retry after denied admission without enabling devices',async()=>{
 mock.join.mockRejectedValueOnce(new Error('offline'));render(<LectureRoom lecture="l" ar={false} onLeave={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Retry connection'}));await screen.findByText('Student');
 expect(mock.join).toHaveBeenCalledTimes(2);expect(mock.camera).not.toHaveBeenCalled();expect(mock.microphone).not.toHaveBeenCalled();expect(screen.queryByText('Retry connection')).toBeNull();
});
it('clears media and moderator controls while reconnecting, keeping the unsent message',async()=>{
 mock.join.mockResolvedValue({url:'wss://media.test',token:'server-token',moderator:true});
 const view=render(<LectureRoom lecture="l" ar={true} onLeave={()=>{}}/>);await screen.findByText('Student');
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'رسالة غير مرسلة'}});
 await act(async()=>mock.connect.mock.calls[0][4]());
 expect(screen.getByRole('status').textContent).toContain('التحقق من صلاحية الدخول');expect(screen.queryByText('Student')).toBeNull();
 expect(screen.queryByText('إزالة المشارك')).toBeNull();expect((screen.getByRole('button',{name:'تشغيل الميكروفون'}) as HTMLButtonElement).disabled).toBe(true);
 expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('رسالة غير مرسلة');view.unmount();
});
it('ignores a late microphone operation from the disconnected room',async()=>{
 let finish!:()=>void;mock.microphone.mockReturnValue(new Promise<void>(r=>finish=r));
 const view=render(<LectureRoom lecture="l" ar={false} onLeave={()=>{}}/>);await screen.findByText('Student');
 fireEvent.click(screen.getByText('Enable microphone'));await act(async()=>mock.connect.mock.calls[0][4]());await act(async()=>finish());
 expect(screen.queryByText('Mute microphone')).toBeNull();expect(screen.getByText('Enable microphone')).toBeTruthy();view.unmount();
});
it('keeps newer chat text when an earlier send succeeds, even after editing back to the same text',async()=>{
 let finish!:()=>void;mock.send.mockReturnValue(new Promise<void>(r=>finish=r));
 render(<LectureRoom lecture="l" ar={false} onLeave={()=>{}}/>);await screen.findByText('Student');
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'same'}});fireEvent.click(screen.getByText('Send'));
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'new'}});fireEvent.change(screen.getByRole('textbox'),{target:{value:'same'}});
 await act(async()=>finish());expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('same');
});
it('clears only the unchanged message after a successful send',async()=>{
 mock.send.mockResolvedValue(undefined);render(<LectureRoom lecture="l" ar={false} onLeave={()=>{}}/>);await screen.findByText('Student');
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'sent'}});fireEvent.click(screen.getByText('Send'));
 await waitFor(()=>expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe(''));
});
it('releases old pending actions on room change and ignores their late failure',async()=>{
 let reject!:(error:Error)=>void;mock.microphone.mockReturnValue(new Promise<void>((_r,j)=>reject=j));
 const view=render(<LectureRoom lecture="old" ar={false} onLeave={()=>{}}/>);await screen.findByText('Student');fireEvent.click(screen.getByText('Enable microphone'));
 view.rerender(<LectureRoom lecture="new" ar={false} onLeave={()=>{}}/>);await screen.findByText('Student');
 expect((screen.getByRole('button',{name:'Enable camera'}) as HTMLButtonElement).disabled).toBe(false);
 await act(async()=>reject(new Error('old failure')));expect(screen.queryByRole('alert')).toBeNull();
});
it('does not release a new pending action when an old action settles',async()=>{
 let oldDone!:()=>void,newDone!:()=>void;mock.microphone.mockReturnValue(new Promise<void>(r=>oldDone=r));mock.camera.mockReturnValue(new Promise<void>(r=>newDone=r));
 const view=render(<LectureRoom lecture="old" ar={false} onLeave={()=>{}}/>);await screen.findByText('Student');fireEvent.click(screen.getByText('Enable microphone'));
 view.rerender(<LectureRoom lecture="new" ar={false} onLeave={()=>{}}/>);await screen.findByText('Student');fireEvent.click(screen.getByText('Enable camera'));
 await act(async()=>oldDone());expect((screen.getByRole('button',{name:'Enable microphone'}) as HTMLButtonElement).disabled).toBe(true);
 await act(async()=>newDone());expect(screen.getByText('Stop camera')).toBeTruthy();
});
it('does not erase a draft on late acknowledgment from the previous room',async()=>{
 let finish!:()=>void;mock.send.mockReturnValue(new Promise<void>(r=>finish=r));
 const view=render(<LectureRoom lecture="old" ar={false} onLeave={()=>{}}/>);await screen.findByText('Student');
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'retain'}});fireEvent.click(screen.getByText('Send'));
 view.rerender(<LectureRoom lecture="new" ar={false} onLeave={()=>{}}/>);await screen.findByText('Student');await act(async()=>finish());
 expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('retain');
});
