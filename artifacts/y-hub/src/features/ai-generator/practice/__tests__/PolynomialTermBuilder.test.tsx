import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {useState} from 'react';
import {PolynomialTermBuilder} from '../PolynomialTermBuilder';
import {WrittenAnswerInput} from '../WrittenAnswerInput';
import {parseWrittenPolynomial} from '@/services/practice-math';
afterEach(cleanup);
function setup(ar=false){const insert=vi.fn();render(<PolynomialTermBuilder ar={ar} onInsert={insert}/>);fireEvent.click(screen.getByText(ar?'بناء حدّ رياضي':'Build a polynomial term'));return insert;}
it('previews and inserts a signed term without grading it',()=>{
 const insert=setup();fireEvent.change(screen.getByLabelText('Integer coefficient'),{target:{value:'-3'}});fireEvent.change(screen.getByLabelText('Variable'),{target:{value:'t'}});fireEvent.change(screen.getByLabelText('Power'),{target:{value:'8'}});
 expect(screen.getByRole('img',{name:'Term preview: -3*t^8'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Insert term'}));expect(insert).toHaveBeenCalledWith('-3*t^8');
 expect(parseWrittenPolynomial(insert.mock.calls[0][0],'t',false)).toEqual([0,0,0,0,0,0,0,0,-3]);
});
it.each(['1.5','801','-801','1e2','NaN',''])('rejects invalid coefficient %s without rounding or inserting',value=>{
 const insert=setup();fireEvent.change(screen.getByLabelText('Integer coefficient'),{target:{value}});expect(screen.getByRole('status')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Insert term'}));expect(insert).not.toHaveBeenCalled();
});
it('supports Arabic digits and the degree-zero constant',()=>{
 const insert=setup(true);fireEvent.change(screen.getByLabelText('المعامل الصحيح'),{target:{value:'−٨٠٠'}});fireEvent.change(screen.getByLabelText('الأسّ'),{target:{value:'0'}});fireEvent.click(screen.getByRole('button',{name:'إدراج الحدّ'}));expect(insert).toHaveBeenCalledWith('-800');
 expect(parseWrittenPolynomial(insert.mock.calls[0][0],'x',false)).toEqual([-800]);
});
it('renders zero as a constant and exposes exactly the supported powers',()=>{
 const insert=setup();fireEvent.change(screen.getByLabelText('Integer coefficient'),{target:{value:'0'}});fireEvent.change(screen.getByLabelText('Power'),{target:{value:'8'}});
 fireEvent.click(screen.getByRole('button',{name:'Insert term'}));expect(insert).toHaveBeenCalledWith('0');expect((screen.getByLabelText('Power') as HTMLSelectElement).options.length).toBe(9);
});
it('inserts into the answer selection without destroying surrounding text',()=>{
 function Editor(){const [value,setValue]=useState('x+old+1');return <WrittenAnswerInput value={value} onChange={setValue} label="Answer" ar={false}/>;}
 render(<Editor/>);const answer=screen.getByLabelText('Answer') as HTMLInputElement;answer.setSelectionRange(2,5);
 fireEvent.click(screen.getByText('Build a polynomial term'));fireEvent.change(screen.getByLabelText('Integer coefficient'),{target:{value:'3'}});fireEvent.change(screen.getByLabelText('Power'),{target:{value:'2'}});
 fireEvent.click(screen.getByRole('button',{name:'Insert term'}));expect(answer.value).toBe('x+3*x^2+1');expect(document.activeElement).toBe(answer);
});
it('respects the enclosing disabled fieldset',()=>{
 const insert=vi.fn();render(<fieldset disabled><PolynomialTermBuilder ar={false} onInsert={insert}/></fieldset>);fireEvent.click(screen.getByText('Build a polynomial term'));fireEvent.click(screen.getByRole('button',{name:'Insert term'}));expect(insert).not.toHaveBeenCalled();
});
