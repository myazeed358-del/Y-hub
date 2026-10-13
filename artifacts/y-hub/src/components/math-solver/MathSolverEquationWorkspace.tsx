import { Calculator } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/y-hub-ds/components/ui/card';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@workspace/y-hub-ds/components/ui/tabs';
import type { getMathSolverCopy } from '@/i18n/mathSolverCopy';

interface MathSolverEquationWorkspaceProps {
  copy: ReturnType<typeof getMathSolverCopy>;
  expr: string;
  setExpr: (value: string) => void;
  variable: string;
  setVariable: (value: string) => void;
  limitPoint: string;
  setLimitPoint: (value: string) => void;
  loading: boolean;
  solveDerivative: () => void | Promise<void>;
  solveGradient: () => void | Promise<void>;
  solveIntegral: () => void | Promise<void>;
  solveDoubleIntegral: () => void | Promise<void>;
  solveLimit: () => void | Promise<void>;
}

export function MathSolverEquationWorkspace({
  copy,
  expr,
  setExpr,
  variable,
  setVariable,
  limitPoint,
  setLimitPoint,
  loading,
  solveDerivative,
  solveGradient,
  solveIntegral,
  solveDoubleIntegral,
  solveLimit,
}: MathSolverEquationWorkspaceProps) {
  return (
          <Card className="shadow-lg border-2 border-primary/10">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
              <CardTitle className="text-xl flex items-center gap-2">
                <Calculator size={20} /> {copy.equationInput}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="math-expr" className="text-sm font-bold mb-2 block">{copy.mathFunction}</label>
                  <Input
                    id="math-expr"
                    value={expr}
                    onChange={e => setExpr(e.target.value)}
                    dir="ltr"
                    className="font-mono text-lg h-14"
                    placeholder={copy.expressionPlaceholder}
                  />
                </div>
              </div>

              <Tabs defaultValue="derivatives" className="w-full">
                <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto md:h-12 mb-6 gap-2 bg-transparent">
                  <TabsTrigger value="derivatives" className="bg-muted h-10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{copy.derivatives}</TabsTrigger>
                  <TabsTrigger value="integrals" className="bg-muted h-10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{copy.integrals}</TabsTrigger>
                  <TabsTrigger value="limits" className="bg-muted h-10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{copy.limits}</TabsTrigger>
                  <TabsTrigger value="vectors" className="bg-muted h-10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{copy.vectors}</TabsTrigger>
                </TabsList>

                <TabsContent value="derivatives" className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-bold mb-2 block">{copy.variable}</label>
                      <select
                        value={variable}
                        onChange={e => setVariable(e.target.value)}
                        className="w-full rounded-md border p-3 bg-background"
                      >
                        <option value="x">x</option>
                        <option value="y">y</option>
                        <option value="z">z</option>
                      </select>
                    </div>
                    <div className="flex-[2] flex items-end gap-2">
                      <Button onClick={solveDerivative} disabled={loading} className="w-full h-12">{copy.partialDerivative}</Button>
                      <Button onClick={solveGradient} variant="secondary" disabled={loading} className="w-full h-12">{copy.gradient}</Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="integrals" className="space-y-4">
                   <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-bold mb-2 block">{copy.variable}</label>
                      <select
                        value={variable}
                        onChange={e => setVariable(e.target.value)}
                        className="w-full rounded-md border p-3 bg-background"
                      >
                        <option value="x">x</option>
                        <option value="y">y</option>
                        <option value="z">z</option>
                      </select>
                    </div>
                    <div className="flex-[2] flex items-end gap-2">
                      <Button onClick={solveIntegral} disabled={loading} className="w-full h-12">{copy.indefiniteIntegral}</Button>
                      <Button onClick={solveDoubleIntegral} variant="secondary" disabled={loading} className="w-full h-12">{copy.doubleIntegral}</Button>
                    </div>
                   </div>
                </TabsContent>

                <TabsContent value="limits" className="space-y-4 p-4 border rounded-xl bg-background/50">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-bold mb-2 block">{copy.approaches} ({variable})</label>
                      <Input
                        value={limitPoint}
                        onChange={e => setLimitPoint(e.target.value)}
                        placeholder="0, inf, -inf, 5..."
                        className="h-12 text-lg"
                      />
                    </div>
                    <div className="flex-1 flex items-end">
                      <Button onClick={solveLimit} disabled={loading} className="w-full h-12 text-lg font-bold">
                        {copy.calculateLimit}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    {copy.lhopitalNote}
                  </p>
                </TabsContent>

                <TabsContent value="vectors" className="space-y-4 text-center p-4">
                   <p className="text-muted-foreground text-sm">{copy.vectorsWorkspace}</p>
                </TabsContent>

              </Tabs>
            </CardContent>
          </Card>
  );
}
