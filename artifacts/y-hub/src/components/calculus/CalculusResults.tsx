import {
  CheckCircle2,
  Copy,
  LineChart as ChartIcon,
} from 'lucide-react';
import { BlockMath } from 'react-katex';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import type { getCalculusCopy } from '@/i18n/calculusCopy';

interface Step {
  desc: string;
  math?: string;
  isError?: boolean;
}

interface CalculusResultsProps {
  copy: ReturnType<typeof getCalculusCopy>;
  steps: Step[];
  finalResult: string;
  activeEngine: string;
  graphData: any[];
  copyToClipboard: (text: string) => void;
}

export function CalculusResults({
  copy,
  steps,
  finalResult,
  activeEngine,
  graphData,
  copyToClipboard,
}: CalculusResultsProps) {
  return (
                <div className="border-t bg-muted/10 p-6 space-y-8">
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg flex items-center gap-2 border-b pb-2"><CheckCircle2 className="text-primary"/> {copy.intelligentSolution}</h3>
                    {steps.map((step, idx) => (
                      <div key={idx} className={`p-4 rounded-xl border shadow-sm ${step.isError ? 'bg-destructive/10 border-destructive/20 text-destructive' : 'bg-card border-border'}`}>
                        <p className="text-sm font-semibold mb-2">{step.desc}</p>
                        {step.math && (
                           <div className="bg-muted/50 p-3 rounded-lg overflow-x-auto text-center" dir="ltr">
                             <BlockMath math={step.math} />
                           </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="p-6 bg-primary/10 border border-primary/20 rounded-2xl relative">
                    <h3 className="text-sm font-bold text-primary mb-3">{activeEngine === 'limits' ? copy.limitConclusion : copy.finalAnswer}</h3>
                    <div className="overflow-x-auto text-center" dir="ltr">
                      <BlockMath math={finalResult} />
                    </div>
                    <Button variant="outline" size="sm" className="absolute top-4 right-4" onClick={() => copyToClipboard(finalResult)}>
                      <Copy size={16} className="me-2"/> {copy.copy}
                    </Button>
                  </div>

                  {/* Interactive Graphing (Show only for 1D real functions if data exists) */}
                  {graphData.length > 0 && activeEngine !== 'series' && (
                     <div className="space-y-4 mt-8 pt-8 border-t">
                       <h3 className="font-bold text-lg flex items-center gap-2"><ChartIcon className="text-primary"/> {copy.graph}</h3>
                       <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
                         <ResponsiveContainer width="100%" height="100%">
                           <LineChart data={graphData}>
                             <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                             <XAxis dataKey="x" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                             <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                             <Tooltip contentStyle={{ borderRadius: '12px', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                             <Line type="monotone" dataKey="y" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} />
                           </LineChart>
                         </ResponsiveContainer>
                       </div>
                     </div>
                  )}
                </div>
  );
}
