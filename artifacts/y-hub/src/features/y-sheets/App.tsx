import React, { useState } from 'react';
import { YSheetsHostAdapter } from './integration/YSheetsHostAdapter';
import { InMemoryHostStorageAdapter } from './integration/dummyHostStorage';
import { HostUser } from './integration/hostContract';
import { Layers } from 'lucide-react';

export const App: React.FC = () => {
  const [isHostSimulation, setIsHostSimulation] = useState(false);
  const [hostStorage] = useState(() => new InMemoryHostStorageAdapter());

  const mockUser: HostUser = {
    id: 'user-univ-449',
    name: 'Sarah Connor',
    email: 'sconnor@univ.edu',
    role: 'CS Undergrad',
  };

  return (
    <div className="y-sheets-root flex flex-col h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 font-sans">
      {/* Top Banner indicating Independent Standalone vs Simulated Y-Hub Host */}
      <div className="flex items-center justify-between px-3 py-1 bg-zinc-800 text-zinc-300 text-xs border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-emerald-400">Y-Sheets</span>
          <span className="text-zinc-500">•</span>
          <span className="text-[11px] text-zinc-400">
            {isHostSimulation
              ? 'Y-Hub Embedded Plug-and-Play Simulation'
              : 'Independent Standalone Application'}
          </span>
        </div>

        <button
          onClick={() => setIsHostSimulation(!isHostSimulation)}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-[11px] transition"
        >
          <Layers className="w-3 h-3 text-emerald-400" />
          <span>Toggle Y-Hub Host Mode ({isHostSimulation ? 'ON' : 'OFF'})</span>
        </button>
      </div>

      {/* Main Spreadsheet Application Container */}
      <div className="flex-1 overflow-hidden">
        {isHostSimulation ? (
          <YSheetsHostAdapter
            user={mockUser}
            storageAdapter={hostStorage}
            theme="light"
            onTelemetry={(e) => console.log('[Y-Hub Telemetry Event]', e)}
          />
        ) : (
          <YSheetsHostAdapter theme="light" />
        )}
      </div>
    </div>
  );
};

export default App;
