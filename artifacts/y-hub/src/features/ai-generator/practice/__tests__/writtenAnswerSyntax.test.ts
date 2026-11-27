import {expect,it} from 'vitest';
import {writtenAnswerSyntax} from '../writtenAnswerSyntax';
it.each(['','  ','\n'])('does not judge an empty draft %j',text=>expect(writtenAnswerSyntax(text)).toBe('empty'));
it.each(['2*x+1','−٨٠٠*t^8','۲×x+۱','x^2+C','t+7-C','0','x+x'])('recognizes supported syntax without question metadata: %s',text=>expect(writtenAnswerSyntax(text)).toBe('supported'));
it.each(['(x+1)^2','sqrt(x)','x/2','x^9','x^-1','x+t','801*x','800*x+x','1 2*x','x^','C','x+C+1','x'.repeat(401),'<img src=x>'])('leaves unsupported or incomplete text for review: %s',text=>expect(writtenAnswerSyntax(text)).toBe('review'));
