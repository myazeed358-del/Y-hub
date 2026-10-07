import React, { useState, useEffect } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import { Card, CardHeader, CardTitle, CardContent } from '@workspace/y-hub-ds/components/ui/card';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@workspace/y-hub-ds/components/ui/tabs';
import { mathEngine } from '@/utils/mathEngine';
import { Calculator, Compass, Box, Activity, TrendingUp, Infinity as LimitIcon } from 'lucide-react';
import { toast } from 'sonner';
import Plot from 'react-plotly.js';

interface Step {
  desc: string;
  math?: string;
}

export default function MathSolver() {
  const [expr, setExpr] = useState('x^2 + y^2 + z^2');
  const [variable, setVariable] = useState('x');
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [result, setResult] = useState<string | null>(null);
  
  // Plotting states
  const [plotMode, setPlotMode] = useState<'surface' | 'parametric' | 'vector'>('surface');
  const [plotExpr, setPlotExpr] = useState('x^2 - y^2');
  const [plotData, setPlotData] = useState<any[]>([]);

  useEffect(() => {
    const handler = setTimeout(() => {
      try {
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
        setPlotData(newData);
      } catch (e) {
        setPlotData([]);
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(handler);
  }, [plotExpr, plotMode]);

  // Handlers for limits
  const [limitPoint, setLimitPoint] = useState('0');

  const solveDerivative = async () => {
    setLoading(true); setSteps([]); setResult(null);
    try {
      const exprTex = await mathEngine.toTex(expr);
      const derived = await mathEngine.derivePartial(expr, variable as any);
      const derivedTex = await mathEngine.toTex(derived);
      
      setSteps([
        { desc: 'الدالة الأصلية:', math: `f(${variable}) = ${exprTex}` },
        { desc: `الاشتقاق الجزئي بالنسبة لـ ${variable}:`, math: `\\frac{\\partial}{\\partial ${variable}} (${exprTex})` }
      ]);
      setResult(derivedTex);
    } catch (e: any) {
      toast.error(e.message || 'فشل حساب الاشتقاق');
    }
    setLoading(false);
  };

  const solveGradient = async () => {
    setLoading(true); setSteps([]); setResult(null);
    try {
      setSteps([{ desc: 'حساب الانحدار (Gradient):', math: `\\nabla f = \\langle f_x, f_y, f_z \\rangle` }]);
      const fx = await mathEngine.derivePartial(expr, 'x');
      const fy = await mathEngine.derivePartial(expr, 'y');
      const fz = await mathEngine.derivePartial(expr, 'z');
      
      const fxTex = await mathEngine.toTex(fx);
      const fyTex = await mathEngine.toTex(fy);
      const fzTex = await mathEngine.toTex(fz);

      setSteps(prev => [
        ...prev,
        { desc: 'المشتقة بالنسبة لـ x:', math: `f_x = ${fxTex}` },
        { desc: 'المشتقة بالنسبة لـ y:', math: `f_y = ${fyTex}` },
        { desc: 'المشتقة بالنسبة لـ z:', math: `f_z = ${fzTex}` }
      ]);
      setResult(`\\langle ${fxTex}, \\quad ${fyTex}, \\quad ${fzTex} \\rangle`);
    } catch (e: any) {
      toast.error('فشل حساب الانحدار');
    }
    setLoading(false);
  };

  const solveIntegral = async () => {
    setLoading(true); setSteps([]); setResult(null);
    try {
      const exprTex = await mathEngine.toTex(expr);
      const integrated = await mathEngine.integratePartial(expr, variable as any);
      const intTex = await mathEngine.toTex(integrated);
      setSteps([{ desc: 'التكامل غير المحدد:', math: `\\int (${exprTex}) \\, d${variable}` }]);
      setResult(`${intTex} + C`);
    } catch (e: any) {
      toast.error('فشل حساب التكامل - تأكد من الصيغة.');
    }
    setLoading(false);
  };

  const solveDoubleIntegral = async () => {
    setLoading(true); setSteps([]); setResult(null);
    const inner = 'y'; // Just an example, UI could allow selecting order (dx dy or dy dx)
    const outer = 'x';
    try {
      const exprTex = await mathEngine.toTex(expr);
      setSteps(prev => [...prev, { desc: `التجهيز للتكامل المزدوج:`, math: `\\iint (${exprTex}) \\, d${inner} \\, d${outer}` }]);
      
      const innerInt = await mathEngine.integratePartial(expr, inner);
      const innerIntTex = await mathEngine.toTex(innerInt);
      setSteps(prev => [...prev, { desc: `التكامل الداخلي بالنسبة لـ ${inner}:`, math: `\\int (${innerIntTex}) \\, d${outer}` }]);

      const outerInt = await mathEngine.integratePartial(innerInt, outer);
      const outerIntTex = await mathEngine.toTex(outerInt);
      setSteps(prev => [...prev, { desc: `التكامل الخارجي بالنسبة لـ ${outer}:`, math: outerIntTex }]);

      setResult(`${outerIntTex} + C(x,y)`);
    } catch (e: any) {
      toast.error('فشل التكامل المزدوج (قد تكون الدالة معقدة جداً للمحرك الرمزي).');
    }
    setLoading(false);
  };

  const solveLimit = async () => {
    setLoading(true); setSteps([]); setResult(null);
    try {
      const parts = expr.split('/');
      const isFraction = parts.length === 2;
      
      if (!isFraction) {
        const pt = limitPoint === 'inf' ? 10000 : parseFloat(limitPoint);
        const val = mathEngine.evaluateNumerically(expr, { [variable]: pt });
        const exprTex = await mathEngine.toTex(expr);
        setSteps([{ desc: 'التعويض المباشر:', math: `\\lim_{${variable} \\to ${limitPoint}} (${exprTex}) = ${val}` }]);
        setResult(val.toString());
      } else {
        let num = parts[0];
        let den = parts[1];
        let currentNum = num;
        let currentDen = den;
        let limitResolved = false;
        
        const pt = limitPoint === 'inf' ? 10000 : parseFloat(limitPoint);

        setSteps([{ desc: 'النهاية الأصلية:', math: `\\lim_{${variable} \\to ${limitPoint}} \\frac{${await mathEngine.toTex(num)}}{${await mathEngine.toTex(den)}}` }]);

        for (let i = 1; i <= 3; i++) {
          const numVal = mathEngine.evaluateNumerically(currentNum, { [variable]: pt });
          const denVal = mathEngine.evaluateNumerically(currentDen, { [variable]: pt });

          if ((Math.abs(numVal) < 1e-5 && Math.abs(denVal) < 1e-5) || (Math.abs(numVal) > 1000 && Math.abs(denVal) > 1000)) {
            setSteps(prev => [...prev, { desc: `حالة عدم تعيين (${numVal < 1e-5 ? '0/0' : '∞/∞'})، تطبيق قاعدة لوبيتال (تفاضل البسط والمقام):` }]);
            currentNum = await mathEngine.derivePartial(currentNum, variable as any);
            currentDen = await mathEngine.derivePartial(currentDen, variable as any);
            const numTex = await mathEngine.toTex(currentNum);
            const denTex = await mathEngine.toTex(currentDen);
            setSteps(prev => [...prev, { desc: `بعد الاشتقاق (المحاولة ${i}):`, math: `\\lim_{${variable} \\to ${limitPoint}} \\frac{${numTex}}{${denTex}}` }]);
          } else {
            const finalVal = numVal / denVal;
            setSteps(prev => [...prev, { desc: 'التعويض المباشر ينجح:', math: `\\frac{${numVal.toFixed(4)}}{${denVal.toFixed(4)}} = ${finalVal.toFixed(4)}` }]);
            setResult(finalVal.toFixed(4));
            limitResolved = true;
            break;
          }
        }
        
        if (!limitResolved) {
          toast.warning('تم إيقاف تطبيق لوبيتال بعد 3 محاولات.');
          setResult('\\text{Indeterminate}');
        }
      }
    } catch (e: any) {
      toast.error('فشل حساب النهاية.');
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6" dir="rtl">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
          <Box size={24} />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">محرك الرياضيات المتقدم</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            (Calculus 3 Math Engine) - معالجة رياضية آمنة خالية من ثغرات eval.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Main Workspace */}
        <div className="space-y-6">
          <Card className="shadow-lg border-2 border-primary/10">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
              <CardTitle className="text-xl flex items-center gap-2">
                <Calculator size={20} /> إدخال المعادلات
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="math-expr" className="text-sm font-bold mb-2 block">الدالة الرياضية (f):</label>
                  <Input 
                    id="math-expr"
                    value={expr} 
                    onChange={e => setExpr(e.target.value)} 
                    dir="ltr" 
                    className="font-mono text-lg h-14"
                    placeholder="مثال: x^2 + sin(y)"
                  />
                </div>
              </div>

              <Tabs defaultValue="derivatives" className="w-full">
                <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto md:h-12 mb-6 gap-2 bg-transparent">
                  <TabsTrigger value="derivatives" className="bg-muted h-10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">الاشتقاق</TabsTrigger>
                  <TabsTrigger value="integrals" className="bg-muted h-10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">التكامل</TabsTrigger>
                  <TabsTrigger value="limits" className="bg-muted h-10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">النهايات</TabsTrigger>
                  <TabsTrigger value="vectors" className="bg-muted h-10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">المتجهات</TabsTrigger>
                </TabsList>

                <TabsContent value="derivatives" className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-bold mb-2 block">المتغير:</label>
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
                      <Button onClick={solveDerivative} disabled={loading} className="w-full h-12">مشتقة جزئية (Partial)</Button>
                      <Button onClick={solveGradient} variant="secondary" disabled={loading} className="w-full h-12">الانحدار (Gradient)</Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="integrals" className="space-y-4">
                   <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-bold mb-2 block">المتغير:</label>
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
                      <Button onClick={solveIntegral} disabled={loading} className="w-full h-12">تكامل غير محدد</Button>
                      <Button onClick={solveDoubleIntegral} variant="secondary" disabled={loading} className="w-full h-12">تكامل مزدوج (dy dx)</Button>
                    </div>
                   </div>
                </TabsContent>
                
                <TabsContent value="limits" className="space-y-4 p-4 border rounded-xl bg-background/50">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-bold mb-2 block">يقترب المتغير ({variable}) من:</label>
                      <Input 
                        value={limitPoint} 
                        onChange={e => setLimitPoint(e.target.value)}
                        placeholder="0, inf, -inf, 5..."
                        className="h-12 text-lg"
                      />
                    </div>
                    <div className="flex-1 flex items-end">
                      <Button onClick={solveLimit} disabled={loading} className="w-full h-12 text-lg font-bold">
                        تطبيق القاعدة وحساب النهاية
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    ملاحظة: لحساب نهايات الدوال الكسرية باستخدام L'Hôpital، افصل بين البسط والمقام بعلامة /.
                  </p>
                </TabsContent>
                
                <TabsContent value="vectors" className="space-y-4 text-center p-4">
                   <p className="text-muted-foreground text-sm">مساحة عمل المتجهات (Dot, Cross, Curl, Divergence) جاهزة للربط.</p>
                </TabsContent>

              </Tabs>
            </CardContent>
          </Card>

          {/* Results Area */}
          {(steps.length > 0 || result) && (
            <Card className="shadow-lg border-2 border-primary/20">
              <CardHeader className="bg-primary/5 border-b border-primary/10">
                <CardTitle className="text-xl text-primary">خطوات الحل والنتيجة</CardTitle>
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
                    <h3 className="text-sm font-bold text-primary mb-4">النتيجة النهائية:</h3>
                    <div className="text-2xl font-bold overflow-x-auto overflow-y-hidden text-primary" dir="ltr">
                      <BlockMath math={result} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Visuals Area */}
        <div>
          <Card className="shadow-lg border-2 bg-card h-full flex flex-col">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="text-xl flex items-center gap-2"><Activity size={20}/> المعاينة البصرية التفاعلية</CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Button 
                  variant={plotMode === 'surface' ? 'default' : 'outline'} 
                  onClick={() => { setPlotMode('surface'); setPlotExpr('x^2 - y^2'); }}
                  className="flex-1 min-w-[120px]"
                >
                  سطح (Surface)
                </Button>
                <Button 
                  variant={plotMode === 'parametric' ? 'default' : 'outline'} 
                  onClick={() => { setPlotMode('parametric'); setPlotExpr('cos(t), sin(t), t'); }}
                  className="flex-1 min-w-[120px]"
                >
                  منحنى بارامتري
                </Button>
                <Button 
                  variant={plotMode === 'vector' ? 'default' : 'outline'} 
                  onClick={() => { setPlotMode('vector'); setPlotExpr('-y, x, z'); }}
                  className="flex-1 min-w-[120px]"
                >
                  حقل متجه (Vector Field)
                </Button>
              </div>

              <div>
                <label className="text-sm font-bold mb-2 block">
                  {plotMode === 'surface' ? 'الدالة z = f(x,y):' : plotMode === 'parametric' ? 'الدالة البارامترية x(t), y(t), z(t):' : 'الحقل المتجه F = <P, Q, R>:'}
                </label>
                <Input 
                  value={plotExpr} 
                  onChange={e => setPlotExpr(e.target.value)} 
                  dir="ltr" 
                  className="font-mono"
                  placeholder={plotMode === 'surface' ? 'x^2 + y^2' : 'cos(t), sin(t), t'}
                />
              </div>

              <div className="flex-1 min-h-[400px] border rounded-xl overflow-hidden bg-white/5 relative">
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
      </div>
    </div>
  );
}
