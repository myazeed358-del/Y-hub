import {useState} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {WrittenAnswerInput} from '../WrittenAnswerInput';
afterEach(cleanup);
function Editor({initial='',disabled=false,ar=false}:{initial?:string;disabled?:boolean;ar?:boolean}){
 const [value,setValue]=useState(initial);
 return <fieldset disabled={disabled}><WrittenAnswerInput value={value} onChange={setValue} label="Answer" ar={ar}/></fieldset>;
}
it('inserts parser syntax into the selected range and restores the caret',()=>{
 render(<Editor initial="2x+old+1"/>);const input=screen.getByRole('textbox',{name:'Answer'}) as HTMLInputElement;input.focus();input.setSelectionRange(3,6);
 fireEvent.click(screen.getByRole('button',{name:'Insert x²'}));expect(input.value).toBe('2x+x^2+1');expect(input.selectionStart).toBe(6);expect(document.activeElement).toBe(input);
});
it('maps displayed multiplication and subtraction to supported ASCII syntax',()=>{
 render(<Editor initial="2"/>);const input=screen.getByRole('textbox',{name:'Answer'}) as HTMLInputElement;input.setSelectionRange(1,1);
 for(const symbol of ['×','x','−','t'])fireEvent.click(screen.getByRole('button',{name:`Insert ${symbol}`}));
 expect(input.value).toBe('2*x-t');
});
it('does not submit a form when a symbol is chosen',()=>{
 const submit=vi.fn(e=>e.preventDefault());render(<form onSubmit={submit}><Editor/></form>);
 fireEvent.click(screen.getByRole('button',{name:'Insert +C'}));expect(submit).not.toHaveBeenCalled();
});
it('refuses overflow without truncating existing text and permits replacement at the limit',()=>{
 render(<Editor initial={'1'.repeat(400)}/>);const input=screen.getByRole('textbox',{name:'Answer'}) as HTMLInputElement;input.setSelectionRange(400,400);
 fireEvent.click(screen.getByRole('button',{name:'Insert x'}));expect(input.value.length).toBe(400);expect(screen.getByText('Symbol not inserted: maximum 400 characters.')).toBeTruthy();
 input.setSelectionRange(0,3);fireEvent.click(screen.getByRole('button',{name:'Insert x²'}));expect(input.value.startsWith('x^2')).toBe(true);expect(input.value.length).toBe(400);expect(screen.queryByText('Symbol not inserted: maximum 400 characters.')).toBeNull();
});
it('preserves unsupported typed text and explains the review boundary',()=>{
 render(<Editor/>);const input=screen.getByRole('textbox',{name:'Answer'}) as HTMLInputElement;fireEvent.change(input,{target:{value:'sqrt(x)/2'}});
 expect(input.value).toBe('sqrt(x)/2');expect(screen.getByText(/Fractions, roots, functions/)).toBeTruthy();
});
it('respects an enclosing disabled fieldset',()=>{
 render(<Editor initial="x" disabled/>);fireEvent.click(screen.getByRole('button',{name:'Insert +C'}));expect((screen.getByRole('textbox',{name:'Answer'}) as HTMLInputElement).value).toBe('x');
});
it('has Arabic labels and keeps mathematical input left-to-right',()=>{
 render(<Editor ar/>);expect(screen.getByRole('group',{name:'رموز كثيرات الحدود'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'إدراج t²'}));
 expect((screen.getByRole('textbox',{name:'Answer'}) as HTMLInputElement).value).toBe('t^2');expect(screen.getByRole('textbox',{name:'Answer'}).getAttribute('dir')).toBe('ltr');
});

it('shows syntax advice without blocking or rewriting unsupported text',()=>{
 render(<Editor/>);const input=screen.getByRole('textbox',{name:'Answer'}) as HTMLInputElement;
 fireEvent.change(input,{target:{value:'(x+1)^2'}});expect(screen.getByText(/outside the current parser/)).toBeTruthy();expect(input.value).toBe('(x+1)^2');
 fireEvent.change(input,{target:{value:'2*x+1'}});expect(screen.getByText(/this is not an answer grade/)).toBeTruthy();expect(screen.queryByText(/outside the current parser/)).toBeNull();
 fireEvent.change(input,{target:{value:''}});expect(screen.queryByText(/this is not an answer grade/)).toBeNull();
});
it('connects Arabic syntax advice to the input description',()=>{
 render(<Editor ar initial="x^9"/>);const input=screen.getByRole('textbox',{name:'Answer'});const advice=screen.getByText(/خارج نطاق المحلّل الحالي/);
 expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(advice.id);
 expect((input as HTMLInputElement).value).toBe('x^9');
});
