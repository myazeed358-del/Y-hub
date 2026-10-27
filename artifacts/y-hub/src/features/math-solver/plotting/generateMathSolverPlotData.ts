import { mathEngine } from '@/utils/mathEngine';

export function generateMathSolverPlotData(
  plotMode: 'surface' | 'parametric' | 'vector',
  plotExpr: string,
) {
        let newData: any[] = [];
        if (plotMode === 'surface') {
          const size = 30;
          const x = [];
          const y = [];
          const z = [];
          for(let i = -5; i <= 5; i += 10/size) {
            x.push(i);
            y.push(i);
          }
          for(let i = 0; i < y.length; i++) {
            const zRow = [];
            for(let j = 0; j < x.length; j++) {
              const val = mathEngine.evaluateNumerically(plotExpr, { x: x[j], y: y[i] });
              // Leave gaps instead of drawing invalid surface values.
              zRow.push(isNaN(val) ? null : val);
            }
            z.push(zRow);
          }
          newData = [{ x, y, z, type: 'surface', colorscale: 'Viridis' }];
        }

        else if (plotMode === 'parametric') {
          const t = [];
          const x = [];
          const y = [];
          const z = [];
          const parts = plotExpr.split(',').map(s => s.trim());
          if(parts.length === 3) {
            for(let i = -10; i <= 10; i += 0.2) {
              x.push(mathEngine.evaluateNumerically(parts[0], { t: i }));
              y.push(mathEngine.evaluateNumerically(parts[1], { t: i }));
              z.push(mathEngine.evaluateNumerically(parts[2], { t: i }));
            }
            newData = [{ x, y, z, type: 'scatter3d', mode: 'lines', line: { width: 6, color: x, colorscale: 'Viridis' } }];
          }
        }

        else if (plotMode === 'vector') {
          const x = [], y = [], z = [], u = [], v = [], w = [];
          const parts = plotExpr.split(',').map(s => s.trim());
          if(parts.length === 3) {
            const size = 5;
            for (let i = -5; i <= 5; i += 10/size) {
              for (let j = -5; j <= 5; j += 10/size) {
                for (let k = -5; k <= 5; k += 10/size) {
                  const scope = { x: i, y: j, z: k };
                  x.push(i); y.push(j); z.push(k);
                  u.push(mathEngine.evaluateNumerically(parts[0], scope) || 0);
                  v.push(mathEngine.evaluateNumerically(parts[1], scope) || 0);
                  w.push(mathEngine.evaluateNumerically(parts[2], scope) || 0);
                }
              }
            }
            newData = [{ type: 'cone', x, y, z, u, v, w, colorscale: 'Viridis', sizemode: 'absolute', sizeref: 2 }];
          }
        }
        return newData;
}
