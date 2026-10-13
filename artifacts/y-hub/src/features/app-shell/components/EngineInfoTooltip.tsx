import * as React from 'react';
import { createPortal } from 'react-dom';
import { ENGINE_CATALOG } from '@/config/majorEngineAccess';
import type { Language } from '@/i18n/uiCopy';

export interface EngineInfoTooltipState {
  engineId: string;
  top: number;
  anchorX: number;
}

interface EngineInfoTooltipProps {
  tooltip: EngineInfoTooltipState | null;
  language: Language;
}

export function EngineInfoTooltip({
  tooltip: engineInfoTooltip,
  language,
}: EngineInfoTooltipProps) {
  return (
    <>
{engineInfoTooltip &&
        typeof document !== 'undefined' &&
        (() => {
          const engine = ENGINE_CATALOG.find(
            (item) => item.id === engineInfoTooltip.engineId
          );

          if (!engine) return null;

          return createPortal(
            <div
              role="tooltip"
              dir={language === 'ar' ? 'rtl' : 'ltr'}
              className="pointer-events-none fixed z-[9999] w-72 -translate-y-1/2 rounded-2xl border border-slate-700/80 bg-[#0b1220]/98 p-4 text-start shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
              style={{
                top: engineInfoTooltip.top,
                ...(language === 'ar'
                  ? {
                      right:
                        window.innerWidth -
                        engineInfoTooltip.anchorX +
                        12,
                    }
                  : {
                      left: engineInfoTooltip.anchorX + 12,
                    }),
              }}
            >
              <div className="text-sm font-bold text-slate-100">
                {engine.title[language]}
              </div>

              <p className="mt-2 text-xs font-normal leading-6 text-slate-400">
                {engine.description[language]}
              </p>
            </div>,
            document.body
          );
        })()}
    </>
  );
}
