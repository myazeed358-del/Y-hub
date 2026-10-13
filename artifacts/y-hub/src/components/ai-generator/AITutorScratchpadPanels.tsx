import type { Dispatch, SetStateAction } from 'react';
import { Scratchpad } from '@/features/ai-generator/scratchpad/Scratchpad';
import {
  Sheet,
  SheetContent,
} from '@workspace/y-hub-ds/components/ui/sheet';

interface Props {
  showScratchpad: boolean;
  setShowScratchpad: Dispatch<SetStateAction<boolean>>;
}

export function AITutorScratchpadPanels({
  showScratchpad,
  setShowScratchpad,
}: Props) {
  return (
    <>
        {/* Scratchpad (Desktop) */}
        {showScratchpad && (
          <div className="hidden md:flex md:w-[40%] flex-col min-h-0 border-l border-[hsl(var(--border))]">
            <Scratchpad />
          </div>
        )}

        {/* Scratchpad (Mobile) */}
        <Sheet open={showScratchpad} onOpenChange={setShowScratchpad}>
          <SheetContent side="bottom" className="h-[80vh] p-0 flex flex-col md:hidden">
            <Scratchpad />
          </SheetContent>
        </Sheet>
    </>
  );
}
