import type { CalculusHistoryEntry } from '../types';
import { calculusHistoryStorage } from '../services/calculusHistoryStorage';
import type {
  Dispatch,
  SetStateAction,
} from 'react';
import {
  Copy,
  History,
  Trash2,
} from 'lucide-react';
import { BlockMath } from 'react-katex';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@workspace/y-hub-ds/components/ui/card';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import type { getCalculusCopy } from '@/i18n/calculusCopy';

interface CalculusHistoryProps {
  copy: ReturnType<typeof getCalculusCopy>;
  history: CalculusHistoryEntry[];
  setHistory: Dispatch<SetStateAction<CalculusHistoryEntry[]>>;
  copyToClipboard: (text: string) => void;
}

export function CalculusHistory({
  copy,
  history,
  setHistory,
  copyToClipboard,
}: CalculusHistoryProps) {
  return (
            <Card className="shadow-md border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><History size={20}/> {copy.history} ({copy.savedProblems})</CardTitle>
                <CardDescription>{copy.recentProblems}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {history.length === 0 ? <p className="text-muted-foreground text-sm">{copy.noHistory}</p> : history.map(item => (
                  <div key={item.id} className="p-4 bg-muted/30 rounded-xl border flex justify-between items-center">
                    <div>
                      <p className="font-mono font-bold" dir="ltr">{item.expr}</p>
                      <BlockMath math={item.result} />
                      <span className="text-xs text-muted-foreground uppercase">{item.engine}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(item.result)}><Copy size={16}/></Button>
                  </div>
                ))}
                {history.length > 0 && (
                  <Button variant="outline" className="w-full mt-4" onClick={() => { setHistory([]); calculusHistoryStorage.clear(); }}><Trash2 size={16} className="me-2"/> {copy.clearHistory}</Button>
                )}
              </CardContent>
            </Card>
  );
}
