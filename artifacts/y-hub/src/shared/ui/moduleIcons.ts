import { Activity, Box, Calculator, FlaskConical, FunctionSquare, Grid2X2, LineChart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ModuleIcon } from '@/modules/contracts';

/** Shared presentation adapter for sidebar and dashboard contributions. */
export const MODULE_ICON_COMPONENTS: Record<ModuleIcon, LucideIcon> = {
  activity: Activity,
  box: Box,
  calculator: Calculator,
  flaskConical: FlaskConical,
  functionSquare: FunctionSquare,
  grid2x2: Grid2X2,
  lineChart: LineChart,
};
