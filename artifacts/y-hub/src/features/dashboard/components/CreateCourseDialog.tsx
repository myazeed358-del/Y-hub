import type { ChangeEvent } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/y-hub-ds/components/ui/dialog';
import type { getDashboardCopy } from '@/i18n/dashboardCopy';

interface CreateCourseDialogProps {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  isArabic: boolean;
  copy: ReturnType<typeof getDashboardCopy>;
  newTitle: string;
  setNewTitle: (value: string) => void;
  newCode: string;
  setNewCode: (value: string) => void;
  newDesc: string;
  setNewDesc: (value: string) => void;
  handleCreateCourse: () => Promise<void>;
}

export function CreateCourseDialog({
  isOpen,
  setIsOpen,
  isArabic,
  copy,
  newTitle,
  setNewTitle,
  newCode,
  setNewCode,
  newDesc,
  setNewDesc,
  handleCreateCourse,
}: CreateCourseDialogProps) {
  return (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="h-12 gap-2 rounded-2xl bg-cyan-400 px-5 font-black text-slate-950 shadow-[0_12px_30px_rgba(34,211,238,.18)] hover:bg-cyan-300">
                <Plus size={18} />
                {copy.newCourse}
              </Button>
            </DialogTrigger>

            <DialogContent
              dir={isArabic ? 'rtl' : 'ltr'}
              className="border-border bg-popover text-popover-foreground dark:border-slate-800 dark:bg-[#0b1220] dark:text-slate-100 sm:max-w-lg"
            >
              <DialogHeader>
                <DialogTitle className="text-xl font-black">
                  {copy.createCourse}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground dark:text-slate-300">
                    {copy.courseTitle}
                  </label>

                  <Input
                    value={newTitle}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setNewTitle(event.target.value)
                    }
                    placeholder={copy.courseTitlePlaceholder}
                    className="h-12 border-input bg-background text-foreground dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground dark:text-slate-300">
                    {copy.courseCode}
                  </label>

                  <Input
                    value={newCode}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setNewCode(event.target.value)
                    }
                    placeholder={copy.courseCodePlaceholder}
                    className="h-12 border-input bg-background text-foreground dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-100"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground dark:text-slate-300">
                    {copy.courseDescription}
                  </label>

                  <Input
                    value={newDesc}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setNewDesc(event.target.value)
                    }
                    placeholder={copy.courseDescriptionPlaceholder}
                    className="h-12 border-input bg-background text-foreground dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-100"
                  />
                </div>

                <Button
                  onClick={handleCreateCourse}
                  className="mt-2 h-12 w-full rounded-xl bg-cyan-400 font-black text-slate-950 hover:bg-cyan-300"
                >
                  {copy.saveCourse}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
  );
}
