import type { LucideIcon } from 'lucide-react';

export type EngineType = 'limits' | 'derivatives' | 'integrals' | 'applications' | 'series' | 'history';

interface CalculusEngineNavigationProps {
  engines: readonly {
    readonly id: EngineType;
    readonly label: string;
    readonly icon: LucideIcon;
  }[];
  activeEngine: EngineType;
  onSelectEngine: (engineId: EngineType) => void;
}

export function CalculusEngineNavigation({
  engines,
  activeEngine,
  onSelectEngine,
}: CalculusEngineNavigationProps) {
  return (
        <div className="flex flex-col gap-2">
          {engines.map(engine => {
            const Icon = engine.icon;
            const isActive = activeEngine === engine.id;
            return (
              <button
                key={engine.id}
                onClick={() => onSelectEngine(engine.id)}
                className={`flex items-center gap-3 w-full text-start p-4 rounded-xl border transition-all ${isActive ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-md border-transparent font-bold' : 'bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'}`}
              >
                <Icon size={20} />
                <span>{engine.label}</span>
              </button>
            )
          })}
        </div>
  );
}
