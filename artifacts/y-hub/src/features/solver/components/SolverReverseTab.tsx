import type { Dispatch, SetStateAction } from 'react';
import type {
  TNormType,
  generateReverseTNormChallenge,
} from '@/utils/reverseEngine';
import type { getSolverCopy } from '@/i18n/solverCopy';
import { Card } from '@workspace/y-hub-ds/components/ui/card';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import { TabsContent } from '@workspace/y-hub-ds/components/ui/tabs';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import {
  BrainCircuit, RefreshCw, CheckCircle2, XCircle, Download,
} from 'lucide-react';

interface Props {
  copy: ReturnType<typeof getSolverCopy>;
  revOperation: TNormType;
  revA: number;
  revResult: number;
  userAnswerB: string;
  setUserAnswerB: Dispatch<SetStateAction<string>>;
  challenge: ReturnType<typeof generateReverseTNormChallenge>;
  validation: { isCorrect: boolean; proof: string } | null;
  generateNewChallenge: () => void;
  handleValidate: () => void;
  handleReverseExport: () => void;
}

export function SolverReverseTab({
  copy, revOperation, revA, revResult,
  userAnswerB, setUserAnswerB, challenge,
  validation, generateNewChallenge,
  handleValidate, handleReverseExport,
}: Props) {
  return (
        <TabsContent value="reverse">
          <div className="grid gap-8 md:grid-cols-2">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">{copy.findMissing}</h2>
                <Button variant="outline" size="sm" onClick={generateNewChallenge} className="gap-2">
                  <RefreshCw size={14} /> {copy.newChallenge}
                </Button>
              </div>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[hsl(var(--muted)/.5)] space-y-2 border border-[hsl(var(--border))]">
                  <div className="flex justify-between">
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">{copy.operation}</span>
                    <span className="font-mono font-bold capitalize text-[hsl(var(--primary))]">{revOperation} T-norm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">{copy.givenA}</span>
                    <span className="font-mono font-bold text-[hsl(var(--foreground))]">{revA}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">{copy.targetResult}</span>
                    <span className="font-mono font-bold text-[hsl(var(--foreground))]">{revResult}</span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">{copy.whatB}</label>
                  <div className="flex gap-3">
                    <Input
                      type="number" step="0.01" min="0" max="1"
                      placeholder={copy.enterB}
                      value={userAnswerB}
                      onChange={(e) => setUserAnswerB(e.target.value)}
                    />
                    <Button onClick={handleValidate} disabled={userAnswerB === ''}>{copy.check}</Button>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                    {challenge.solutionType === 'none' && copy.noSolution}
                    {challenge.solutionType === 'range' && copy.rangeSolution}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] relative">
              <div className="mb-8 flex items-center justify-between">
                <h2 className="text-xl font-extrabold">{copy.validationProof}</h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleReverseExport} disabled={!validation} className="gap-2 bg-[hsl(var(--card))]">
                    <Download size={14} /> {copy.downloadProof}
                  </Button>
                  <div className="rounded-xl bg-[hsl(var(--sidebar-accent))] p-2.5 text-[hsl(var(--accent))]">
                    <BrainCircuit size={18} />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {!validation ? (
                  <div className="text-sm text-[hsl(var(--sidebar-foreground)/.6)] text-center py-10">
                    {copy.enterAndCheck}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      {validation.isCorrect ? (
                         <CheckCircle2 size={32} className="text-[hsl(var(--primary))]" />
                      ) : (
                         <XCircle size={32} className="text-[hsl(var(--destructive))]" />
                      )}
                      <div>
                        <div className={`font-bold ${validation.isCorrect ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--destructive))]'}`}>
                          {validation.isCorrect ? copy.correct : copy.incorrect}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm text-[hsl(var(--sidebar-foreground)/.6)] mb-2">{copy.algebraicSteps}</h3>
                      <div className="bg-[hsl(var(--background))] text-[hsl(var(--foreground))] p-4 rounded-xl border border-[hsl(var(--border))] font-mono overflow-x-auto whitespace-pre">
                        {`$$ ${validation.proof} $$`}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>
  );
}
