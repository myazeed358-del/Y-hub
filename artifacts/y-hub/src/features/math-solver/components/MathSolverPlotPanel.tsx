import { getDefaultPlotExpression } from '../domain/plotModeDefaults';
import Plot from 'react-plotly.js';
import { Activity } from 'lucide-react';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/y-hub-ds/components/ui/card';
import type { getMathSolverCopy } from '@/i18n/mathSolverCopy';

import type { PlotMode } from '../types';

interface MathSolverPlotPanelProps {
  copy: ReturnType<typeof getMathSolverCopy>;
  plotMode: PlotMode;
  setPlotMode: (value: PlotMode) => void;
  plotExpr: string;
  setPlotExpr: (value: string) => void;
  plotData: any[];
}

export function MathSolverPlotPanel({
  copy,
  plotMode,
  setPlotMode,
  plotExpr,
  setPlotExpr,
  plotData,
}: MathSolverPlotPanelProps) {
  return (
        <div>
          <Card className="shadow-lg border-2 bg-card h-full flex flex-col">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="text-xl flex items-center gap-2"><Activity size={20}/> {copy.visualPreview}</CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={plotMode === 'surface' ? 'default' : 'outline'}
                  onClick={() => { setPlotMode('surface'); setPlotExpr(getDefaultPlotExpression('surface')); }}
                  className="flex-1 min-w-[120px]"
                >
                  {copy.surface}
                </Button>
                <Button
                  variant={plotMode === 'parametric' ? 'default' : 'outline'}
                  onClick={() => { setPlotMode('parametric'); setPlotExpr(getDefaultPlotExpression('parametric')); }}
                  className="flex-1 min-w-[120px]"
                >
                  {copy.parametric}
                </Button>
                <Button
                  variant={plotMode === 'vector' ? 'default' : 'outline'}
                  onClick={() => { setPlotMode('vector'); setPlotExpr(getDefaultPlotExpression('vector')); }}
                  className="flex-1 min-w-[120px]"
                >
                  {copy.vectorField}
                </Button>
              </div>

              <div>
                <label className="text-sm font-bold mb-2 block">
                  {plotMode === 'surface' ? copy.surfaceFunction : plotMode === 'parametric' ? copy.parametricFunction : copy.vectorFieldFunction}
                </label>
                <Input
                  value={plotExpr}
                  onChange={e => setPlotExpr(e.target.value)}
                  dir="ltr"
                  className="font-mono"
                  placeholder={plotMode === 'surface' ? 'x^2 + y^2' : 'cos(t), sin(t), t'}
                />
              </div>

              <div className="flex-1 min-h-[400px] border rounded-xl overflow-hidden bg-card/50 dark:bg-white/5 relative">
                <Plot
                  data={plotData}
                  layout={{
                    autosize: true,
                    margin: { l: 0, r: 0, b: 0, t: 0 },
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    scene: {
                      xaxis: { title: { text: 'X' }, showgrid: true, zeroline: true },
                      yaxis: { title: { text: 'Y' }, showgrid: true, zeroline: true },
                      zaxis: { title: { text: 'Z' }, showgrid: true, zeroline: true },
                    }
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '100%' }}
                  config={{ responsive: true, displayModeBar: false }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
  );
}
