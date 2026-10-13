import * as React from 'react';

import {
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';

import type {
  MembershipFunctionType as FunctionType,
} from '@/utils/fuzzyLogic';

import {
  MiniCurve,
} from '@/components/legacy/LegacyLearningWidgets';

import { LabSlider } from './LabSlider';

import type {
  LegacyLabController,
} from '../hooks/useLegacyLab';

type Props = Pick<
  LegacyLabController,
  | 'copy'
  | 'functionNames'
  | 'functionType'
  | 'setFunctionType'
  | 'params'
  | 'update'
  | 'resetParams'
>;

export function LabControls({
  copy,
  functionNames,
  functionType,
  setFunctionType,
  params,
  update,
  resetParams,
}: Props) {
  return (
<div className="order-1 space-y-4 lg:order-2">
          <div className="rounded-[1.75rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
             <div className="mb-4 flex items-center gap-2"><SlidersHorizontal size={17} className="text-[hsl(var(--primary))]" /><h2 className="font-extrabold">{copy.functionType}</h2></div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(functionNames) as FunctionType[]).map((type) => <button key={type} onClick={() => setFunctionType(type)} data-testid={`button-function-${type}`} className={`rounded-xl border px-2 py-3 text-xs font-bold transition-all ${functionType === type ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/.3)]'}`}><div className="mb-2 h-8"><MiniCurve tone={type === 'gaussian' ? 'coral' : type === 'trapezoid' ? 'amber' : 'teal'} type={type} /></div>{functionNames[type]}</button>)}
            </div>
          </div>
           <div className="rounded-[1.75rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
             <div className="mb-5 flex items-center justify-between"><h2 className="font-extrabold">{copy.parameters}</h2><button onClick={() => resetParams()} data-testid="button-reset-lab" className="inline-flex items-center gap-1.5 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"><RotateCcw size={13} /> {copy.reset}</button></div>
             {functionType === 'gaussian' ? <><LabSlider label={copy.center} value={params.center} onChange={(value) => update('center', value)} /><LabSlider label={copy.spread} value={params.spread} min={5} max={30} onChange={(value) => update('spread', value)} /></> : <><LabSlider label={copy.start} value={params.a} max={Math.max(25, params.b - 5)} onChange={(value) => update('a', value)} /><LabSlider label={copy.peak} value={params.b} min={params.a + 5} max={Math.min(85, params.c - 5)} onChange={(value) => update('b', value)} /><LabSlider label={copy.end} value={params.c} min={params.b + 5} max={functionType === 'trapezoid' ? params.d - 5 : 98} onChange={(value) => update('c', value)} />{functionType === 'trapezoid' && <LabSlider label={copy.final} value={params.d} min={params.c + 5} max={100} onChange={(value) => update('d', value)} />}</>}
             <div className="mt-4 border-t border-[hsl(var(--border))] pt-4"><LabSlider label={copy.testValue} value={params.x} onChange={(value) => update('x', value)} /></div>
          </div>
        </div>
  );
}
