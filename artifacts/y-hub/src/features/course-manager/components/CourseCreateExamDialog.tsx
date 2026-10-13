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
import { Plus } from 'lucide-react';

interface CourseCreateExamDialogProps {
  isAddExamOpen: boolean;
  setIsAddExamOpen: Dispatch<SetStateAction<boolean>>;
  examTitle: string;
  setExamTitle: Dispatch<SetStateAction<string>>;
  examTimeLimit: number;
  setExamTimeLimit: Dispatch<SetStateAction<number>>;
  handleCreateExam: () => Promise<void>;
}

export function CourseCreateExamDialog({
  isAddExamOpen,
  setIsAddExamOpen,
  examTitle,
  setExamTitle,
  examTimeLimit,
  setExamTimeLimit,
  handleCreateExam,
}: CourseCreateExamDialogProps) {
  return (
            <Dialog open={isAddExamOpen} onOpenChange={setIsAddExamOpen}>
              <DialogTrigger asChild><Button className="gap-2"><Plus size={16} /> إنشاء اختبار</Button></DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader><DialogTitle>إعداد اختبار جديد</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div><label htmlFor="examTitle" className="text-sm font-bold mb-1 block">اسم الاختبار</label><Input id="examTitle" value={examTitle} onChange={(e: ChangeEvent<HTMLInputElement>) =>setExamTitle(e.target.value)} /></div>
                  <div><label htmlFor="examTimeLimit" className="text-sm font-bold mb-1 block">المدة (بالدقائق)</label><Input id="examTimeLimit" type="number" value={examTimeLimit} onChange={(e: ChangeEvent<HTMLInputElement>) =>setExamTimeLimit(parseInt(e.target.value))} /></div>
                  <Button className="w-full" onClick={handleCreateExam}>إنشاء</Button>
                </div>
              </DialogContent>
            </Dialog>
  );
}
