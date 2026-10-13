import { useState } from 'react';

import type {
  EngineInfoTooltipState,
} from '../components/EngineInfoTooltip';

/**
 * Owns the selection and screen position of
 * the engine information tooltip.
 */
export function useEngineInfoTooltip() {
  const [
    engineInfoTooltip,
    setEngineInfoTooltip,
  ] = useState<EngineInfoTooltipState | null>(null);

  return {
    engineInfoTooltip,
    setEngineInfoTooltip,
  };
}

export type EngineInfoTooltipController =
  ReturnType<typeof useEngineInfoTooltip>;
