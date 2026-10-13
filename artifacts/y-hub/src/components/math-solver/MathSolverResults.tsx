import { BlockMath } from 'react-katex';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/y-hub-ds/components/ui/card';
import type { getMathSolverCopy } from '@/i18n/mathSolverCopy';

interface MathSolverStep {
  desc: string;
  math?: string;
}

interface MathSolverResultsProps {
  copy: ReturnType<typeof getMathSolverCopy>;
  steps: MathSolverStep[];
  result: string | null;
}

export function MathSolverResults({
  copy,
  steps,
  result,
}: MathSolverResultsProps) {
  return (
            <Card className="shadow-lg border-2 border-primary/20">
              <CardHeader className="bg-primary/5 border-b border-primary/10">
                <CardTitle className="text-xl text-primary">{copy.solutionSteps}</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                  {steps.map((step, i) => (
                    <div key={i} className="p-4 rounded-xl bg-muted/30 border">
                      <p className="text-sm font-bold text-muted-foreground mb-2">{step.desc}</p>
                      {step.math && <div className="text-xl overflow-x-auto overflow-y-hidden" dir="ltr"><BlockMath math={step.math} /></div>}
                    </div>
                  ))}
                </div>

                {result && (
                  <div className="mt-8 p-6 rounded-2xl bg-primary/10 border-2 border-primary/30 text-center">
                    <h3 className="text-sm font-bold text-primary mb-4">{copy.finalResult}</h3>
                    <div className="text-2xl font-bold overflow-x-auto overflow-y-hidden text-primary" dir="ltr">
                      <BlockMath math={result} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
  );
}
