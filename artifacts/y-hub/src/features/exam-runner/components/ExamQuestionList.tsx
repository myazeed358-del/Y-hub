import type { ExamQuestion } from '../types';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@workspace/y-hub-ds/components/ui/card';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import {
  RadioGroup,
  RadioGroupItem,
} from '@workspace/y-hub-ds/components/ui/radio-group';
import { Label } from '@workspace/y-hub-ds/components/ui/label';

interface Props {
  questions: ExamQuestion[];
  isSubmitted: boolean;
  answers: Record<string, string>;
  setAnswers: Dispatch<SetStateAction<Record<string, string>>>;
}

export function ExamQuestionList({
  questions,
  isSubmitted,
  answers,
  setAnswers,
}: Props) {
  return (
      <div className="space-y-6">
        {questions.map((q, i) => (
          <Card key={q.id} className={isSubmitted ? 'opacity-80 grayscale-[20%]' : ''}>
            <CardHeader>
              <CardTitle className="text-lg flex justify-between items-start">
                <span><span className="text-primary ml-2">{i + 1}.</span> {q.content}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {q.type === 'mcq' && (
                <RadioGroup
                  disabled={isSubmitted}
                  value={answers[q.id] || ''}
                  onValueChange={(val: string) => setAnswers(prev => ({...prev, [q.id]: val}))}
                  className="space-y-3"
                >
                  {q.options?.map((opt: string, optIdx: number) => (
                    <div key={optIdx} className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value={opt} id={`q-${q.id}-opt-${optIdx}`} />
                      <Label htmlFor={`q-${q.id}-opt-${optIdx}`}>{opt}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {q.type === 'tf' && (
                <RadioGroup
                  disabled={isSubmitted}
                  value={answers[q.id] || ''}
                  onValueChange={(val: string) => setAnswers(prev => ({...prev, [q.id]: val}))}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="صح" id={`q-${q.id}-t`} />
                    <Label htmlFor={`q-${q.id}-t`}>صح</Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="خطأ" id={`q-${q.id}-f`} />
                    <Label htmlFor={`q-${q.id}-f`}>خطأ</Label>
                  </div>
                </RadioGroup>
              )}

              {q.type === 'math' && (
                <Input
                  disabled={isSubmitted}
                  value={answers[q.id] || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setAnswers(prev => ({...prev, [q.id]: e.target.value}))}
                  placeholder="أدخل الإجابة الرياضية هنا"
                  dir="ltr"
                  className="max-w-md font-mono"
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
  );
}
