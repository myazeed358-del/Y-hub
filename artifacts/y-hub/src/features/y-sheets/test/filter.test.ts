import {expect,it} from 'vitest';
import {applySheetFilter} from '../data/filter';
import {createDefaultWorkbook} from '../state/defaultWorkbook';
const range={startRow:0,startCol:0,endRow:2,endCol:0};
const sheet=()=>({...createDefaultWorkbook().sheets[0],cells:{'0,0':{raw:'Header'},'1,0':{raw:'Keep'},'2,0':{raw:'Hide'}}});
it('keeps an enabled filter range before any column constraints are chosen',()=>{
 const filtered=applySheetFilter(sheet(),{range,columns:{}});expect(filtered.filter?.range).toEqual(range);expect(filtered.hiddenRows).toEqual({});
});
it('preserves existing value-filter behavior and clears it only on explicit disable',()=>{
 const filtered=applySheetFilter(sheet(),{range,columns:{0:{col:0,allSelected:false,selectedValues:['Keep']}}});expect(filtered.hiddenRows).toEqual({2:true});const cleared=applySheetFilter(filtered,undefined);expect(cleared.filter).toBeUndefined();expect(cleared.hiddenRows).toEqual({});
});
