import type { Dispatch, SetStateAction } from 'react';
import type { TNormType } from '@/utils/reverseEngine';
import type { UiKey } from '@/i18n/uiCopy';
import type { getSolverCopy } from '@/i18n/solverCopy';
import { Card } from '@workspace/y-hub-ds/components/ui/card';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@workspace/y-hub-ds/components/ui/select';
import { TabsContent } from '@workspace/y-hub-ds/components/ui/tabs';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { BrainCircuit, Download } from 'lucide-react';

interface Props {
  t: (key: UiKey) => string;
  copy: ReturnType<typeof getSolverCopy>;
  a: string;
  setA: Dispatch<SetStateAction<string>>;
  b: string;
  setB: Dispatch<SetStateAction<string>>;
  tnorm: TNormType;
  setTnorm: Dispatch<SetStateAction<TNormType>>;
  result: number;
  proof: string;
  handleForwardExport: () => void;
}

export function SolverForwardTab({
  t, copy, a, setA, b, setB, tnorm, setTnorm,
  result, proof, handleForwardExport,
}: Props) {
  return (
        <TabsContent value="forward">
          <div className="grid gap-8 md:grid-cols-2">
            <Card className="p-6">
              <h2 className="text-lg font-bold mb-4">{t('inputParams')}</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-1 block">{t('membershipValueA')}</label>
                  <Input type="number" step="0.1" min="0" max="1" value={a} onChange={(e) => setA(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">{t('membershipValueB')}</label>
                  <Input type="number" step="0.1" min="0" max="1" value={b} onChange={(e) => setB(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">{t('tnormOp')}</label>
                  <Select value={tnorm} onValueChange={(val) => setTnorm(val as TNormType)}>
                    <SelectTrigger>
                      <SelectValue placeholder={copy.selectOperation} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">{copy.standard}</SelectItem>
                      <SelectItem value="algebraic">{copy.algebraic}</SelectItem>
                      <SelectItem value="bounded">{copy.bounded}</SelectItem>
                      <SelectItem value="drastic">{copy.drastic}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] relative">
              <div className="mb-8 flex items-center justify-between">
                <h2 className="text-xl font-extrabold">{t('proofEngine')}</h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleForwardExport} className="gap-2 bg-[hsl(var(--card))]">
                    <Download size={14} /> {t('exportPdf')}
                  </Button>
                  <div className="rounded-xl bg-[hsl(var(--sidebar-accent))] p-2.5 text-[hsl(var(--accent))]">
                    <BrainCircuit size={18} />
                  </div>
                </div>
              </div>
              <div className="mb-8">
                <div className="mb-2 text-sm font-semibold opacity-60 uppercase tracking-widest">{t('finalResult')}</div>
                <div className="text-5xl font-mono text-[hsl(var(--accent))] tracking-tighter">{result}</div>
              </div>
              <div>
                <div className="mb-3 text-sm font-semibold opacity-60">{t('algebraicStep')}</div>
                <div className="rounded-xl bg-[hsl(var(--background))] p-4 font-mono text-sm leading-relaxed overflow-x-auto border border-[hsl(var(--border))]">
                  $$ {proof} $$
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
  );
}
