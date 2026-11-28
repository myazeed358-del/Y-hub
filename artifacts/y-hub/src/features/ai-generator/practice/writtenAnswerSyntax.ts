import {parseWrittenPolynomial} from '@/services/practice-math';

/** Syntax only; no question, expected answer, score or grading metadata is read. */
export function writtenAnswerSyntax(text:string):'empty'|'supported'|'review'{
 if(!text.trim())return 'empty';
 for(const variable of ['x','t'] as const)for(const family of [false,true]){
  try{parseWrittenPolynomial(text,variable,family);return 'supported';}catch{/* Try the other explicitly supported grammar. */}
 }
 return 'review';
}
