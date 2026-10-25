import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {SectionActivityLinks,authorizedSectionSelection} from '../SectionActivityLinks';
afterEach(cleanup);
it('links the existing modules to the exact section without creating a route',()=>{
 render(<SectionActivityLinks sectionId="section-id" ar={false}/>);
 expect(screen.getByRole('link',{name:'Attendance'}).getAttribute('href')).toBe('/y-attendance?section=section-id');
 expect(screen.getByRole('link',{name:'Online lectures'}).getAttribute('href')).toBe('/online-lectures?section=section-id');
});
it('renders Arabic labels and encodes the section identifier',()=>{
 render(<SectionActivityLinks sectionId="x&other=y" ar/>);
 expect(screen.getByRole('link',{name:'الحضور والغياب'}).getAttribute('href')).toBe('/y-attendance?section=x%26other%3Dy');
 expect(screen.getByRole('navigation',{name:'أنشطة الشعبة'})).toBeTruthy();
});
it('never selects a URL section outside the authorized directory',()=>{
 expect(authorizedSectionSelection('?section=foreign',[{id:'own'}])).toBe('');
 expect(authorizedSectionSelection('?section=own',[{id:'own'}])).toBe('own');
 expect(authorizedSectionSelection('?section=own',[],'own')).toBe('');
});
it('preserves manual selection on refresh and drops revoked selections',()=>{
 expect(authorizedSectionSelection('?section=first',[{id:'first'},{id:'second'}],'second')).toBe('second');
 expect(authorizedSectionSelection('',[{id:'first'}],'second')).toBe('');
});
