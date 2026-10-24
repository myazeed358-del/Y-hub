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
