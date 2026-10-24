import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({read:vi.fn(),save:vi.fn()}));
vi.mock('@/features/student-dashboard/services/quickAccessRepository',()=>({quickAccessRepository:mocks}));
import {StudentDashboardSidebar} from '@/features/student-dashboard/components/StudentDashboardSidebar';
import {useQuickAccess} from '@/features/student-dashboard/hooks/useQuickAccess';
import type {useLanguage} from '@/i18n/LanguageContext';
const options=[['linear-algebra','/linear-algebra'],['y-sheets','/y-sheets'],['y-attendance','/y-attendance'],['online-lectures','/online-lectures']].map(([moduleId,path])=>({moduleId,path,title:{ar:moduleId,en:moduleId},icon:'box',dashboardOrder:null}));
function Card(){const state=useQuickAccess('student','en');return <StudentDashboardSidebar t={((key:string)=>key) as ReturnType<typeof useLanguage>['t']} tools={state.tools} quickAccess={state} setLocation={()=>{}}/>;}
beforeEach(()=>{vi.clearAllMocks();mocks.read.mockResolvedValue({revision:0,paths:options.slice(0,3).map(o=>o.path),available:options});mocks.save.mockResolvedValue(1);});afterEach(cleanup);
it('enhances exactly one existing card and enforces the three-tool limit',async()=>{
 render(<Card/>);await waitFor(()=>expect((screen.getByText('Customize tools') as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByText('Customize tools'));
 expect(screen.getAllByText('quickTools')).toHaveLength(1);expect(screen.getAllByRole('combobox')).toHaveLength(3);expect((screen.getByText('Add') as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getAllByText('Remove')[0]);expect(screen.getAllByRole('combobox')).toHaveLength(2);expect((screen.getByText('Add') as HTMLButtonElement).disabled).toBe(false);
});
it('supports replacing and reordering tools without creating a second preference system',async()=>{
 render(<Card/>);await waitFor(()=>expect((screen.getByText('Customize tools') as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByText('Customize tools'));
 fireEvent.change(screen.getByLabelText('Tool 1'),{target:{value:'/online-lectures'}});fireEvent.click(screen.getAllByText('Down')[0]);fireEvent.click(screen.getByText('Save'));
 await waitFor(()=>expect(mocks.save).toHaveBeenCalledWith(0,['/y-sheets','/online-lectures','/y-attendance']));
});
it('allows removing every tool and saves an explicit empty selection',async()=>{
 render(<Card/>);await waitFor(()=>expect((screen.getByText('Customize tools') as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByText('Customize tools'));
 for(let i=0;i<3;i++)fireEvent.click(screen.getAllByText('Remove')[0]);expect(screen.queryAllByRole('combobox')).toHaveLength(0);fireEvent.click(screen.getByText('Save'));
 await waitFor(()=>expect(mocks.save).toHaveBeenCalledWith(0,[]));
});
it('keeps the editor selection after a server conflict',async()=>{
 mocks.save.mockRejectedValue(new Error('conflict'));render(<Card/>);await waitFor(()=>expect((screen.getByText('Customize tools') as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByText('Customize tools'));
 fireEvent.change(screen.getByLabelText('Tool 1'),{target:{value:'/online-lectures'}});fireEvent.click(screen.getByText('Save'));await screen.findByRole('alert');expect((screen.getByLabelText('Tool 1') as HTMLSelectElement).value).toBe('/online-lectures');
});
