import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  Users,
} from 'lucide-react';
import YHubLogo from '@/components/YHubLogo';
import type { loginCopy } from '@/i18n/loginCopy';

interface LoginBrandPanelProps {
  copy: (typeof loginCopy)[keyof typeof loginCopy];
}

export function LoginBrandPanel({
  copy,
}: LoginBrandPanelProps) {
  return (
          <section className="relative hidden min-h-[760px] overflow-hidden border-l border-white/5 lg:flex lg:flex-col lg:justify-between">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.05] via-transparent to-violet-500/[0.08]" />

            <div className="relative z-10 px-12 pt-12">
              <div className="flex flex-col items-center text-center">
                <YHubLogo size="hero" showText={false} />

                <div className="mt-5 text-4xl font-black tracking-[0.14em] text-white">
                  Y HUB
                </div>

                <div className="mt-2 text-[11px] font-semibold tracking-[0.34em] text-slate-500">
                  ACADEMIC PLATFORM
                </div>
              </div>

              <div className="mt-12 text-center">
                <h2 className="text-3xl font-black leading-tight">
                  {copy.brandHeading}
                </h2>

                <p className="mx-auto mt-4 max-w-md text-base leading-8 text-slate-400">
                  {copy.brandDescription}
                </p>
              </div>

              <div className="mx-auto mt-10 grid max-w-md gap-3">
                <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold">{copy.organizedTitle}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {copy.organizedDescription}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-400/10 text-violet-300">
                    <BrainCircuit className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold">{copy.toolsTitle}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {copy.toolsDescription}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-400/10 text-blue-300">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold">{copy.progressTitle}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {copy.progressDescription}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold">{copy.integratedTitle}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {copy.integratedDescription}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-12 h-28 overflow-hidden">
              <div className="absolute inset-x-[-15%] bottom-[-85px] h-44 rounded-[50%] border border-cyan-400/20 shadow-[0_-20px_60px_rgba(14,165,233,0.10)]" />
              <div className="absolute inset-x-[-5%] bottom-[-105px] h-44 rounded-[50%] border border-violet-400/20" />
            </div>
          </section>
  );
}
