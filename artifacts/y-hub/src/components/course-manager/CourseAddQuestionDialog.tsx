import type {
  ChangeEvent,
  Dispatch,
  SetStateAction,
} from 'react';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/y-hub-ds/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/y-hub-ds/components/ui/select';
import { Plus } from 'lucide-react';

type QuestionType = 'mcq' | 'tf' | 'math';

interface CourseAddQuestionDialogProps {
  isAddQuestionOpen: boolean;
  setIsAddQuestionOpen: Dispatch<SetStateAction<boolean>>;
  qType: QuestionType;
  setQType: Dispatch<SetStateAction<QuestionType>>;
  qContent: string;
  setQContent: Dispatch<SetStateAction<string>>;
  qCorrect: string;
  setQCorrect: Dispatch<SetStateAction<string>>;
  qOptions: string[];
  setQOptions: Dispatch<SetStateAction<string[]>>;
  handleAddQuestion: () => Promise<void>;
}

export function CourseAddQuestionDialog({
  isAddQuestionOpen,
  setIsAddQuestionOpen,
  qType,
  setQType,
  qContent,
  setQContent,
  qCorrect,
  setQCorrect,
  qOptions,
  setQOptions,
  handleAddQuestion,
}: CourseAddQuestionDialogProps) {
  return (
                    <Dialog open={isAddQuestionOpen} onOpenChange={setIsAddQuestionOpen}>
                      <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus size={16} /> إضافة سؤال</Button></DialogTrigger>
                      <DialogContent dir="rtl" className="max-w-xl">
                        <DialogHeader><DialogTitle>سؤال جديد</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-4">
                          <div>
                            <label className="text-sm font-bold mb-1 block">النوع</label>
                            <Select value={qType} onValueChange={(v:any)=>setQType(v)}>
                              <SelectTrigger><SelectValue/></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="mcq">اختيار من متعدد</SelectItem>
                                <SelectItem value="tf">صح أو خطأ</SelectItem>
                                <SelectItem value="math">إجابة رياضية قصيرة</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div><label className="text-sm font-bold mb-1 block">نص السؤال</label><Input value={qContent} onChange={(e: ChangeEvent<HTMLInputElement>) =>setQContent(e.target.value)} /></div>

                          {qType === 'mcq' && (
                            <div className="space-y-2">
                              <label className="text-sm font-bold mb-1 block">الخيارات (امسح الفراغ للإلغاء)</label>
                              {qOptions.map((opt, i) => (
                                <Input key={i} value={opt} onChange={(e: ChangeEvent<HTMLInputElement>) => { const newOpts = [...qOptions]; newOpts[i] = e.target.value; setQOptions(newOpts); }} placeholder={`خيار ${i+1}`} />
                              ))}
                            </div>
                          )}

                          <div>
                            <label className="text-sm font-bold mb-1 block">الإجابة الصحيحة (يجب أن تطابق أحد الخيارات تماماً إن وجدت)</label>
                            {qType === 'tf' ? (
                              <Select value={qCorrect} onValueChange={setQCorrect}>
                                <SelectTrigger><SelectValue placeholder="اختر الإجابة"/></SelectTrigger>
                                <SelectContent><SelectItem value="صح">صح</SelectItem><SelectItem value="خطأ">خطأ</SelectItem></SelectContent>
                              </Select>
                            ) : (
                              <Input value={qCorrect} onChange={(e: ChangeEvent<HTMLInputElement>) =>setQCorrect(e.target.value)} dir="auto" />
                            )}
                          </div>

                          <Button className="w-full mt-4" onClick={handleAddQuestion}>حفظ السؤال</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
  );
}
