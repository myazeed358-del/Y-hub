import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { LockKeyhole } from 'lucide-react';
import YHubLogo from '@/components/YHubLogo';
import ScientificBackdrop from '@/components/ScientificBackdrop';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import type { resetPasswordCopy } from '@/i18n/resetPasswordCopy';

type RecoveryStatus = 'checking' | 'ready' | 'invalid' | 'saved';

interface Props {
  language: 'ar' | 'en';
  onToggleLanguage: () => void;
  copy: (typeof resetPasswordCopy)['ar' | 'en'];
  status: RecoveryStatus;
  password: string;
  setPassword: Dispatch<SetStateAction<string>>;
  confirmation: string;
  setConfirmation: Dispatch<SetStateAction<string>>;
  message: string;
  saving: boolean;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setLocation: (path: string) => void;
}

export function ResetPasswordView({
  language, onToggleLanguage, copy, status,
  password, setPassword, confirmation, setConfirmation,
  message, saving, handleSubmit, setLocation,
}: Props) {
  return (
    <div
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="relative min-h-[100dvh] overflow-hidden bg-[#020817] text-white"
    >
      <ScientificBackdrop />

      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 py-8">
        <div className="w-full max-w-[520px] rounded-[30px] border border-cyan-400/15 bg-[#06101f]/90 p-6 shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="mb-8 flex items-center justify-between gap-4">
            <YHubLogo size="sm" />
            <button
              type="button"
              onClick={onToggleLanguage}
              className="rounded-xl border border-cyan-400/20 px-3 py-2 text-xs font-bold text-cyan-300"
            >
              {language === 'ar' ? 'EN' : 'AR'}
            </button>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-black">{copy.title}</h1>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              {copy.description}
            </p>
          </div>

          {status === 'checking' && (
            <p className="text-sm text-slate-300">{copy.checking}</p>
          )}

          {status === 'invalid' && (
            <p className="text-sm leading-7 text-red-300">{copy.invalid}</p>
          )}

          {status === 'saved' && (
            <p className="text-sm leading-7 text-cyan-200">{copy.saved}</p>
          )}

          {status === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="new-password" className="text-sm font-bold text-slate-300">
                  {copy.password}
                </label>
                <div className="relative">
                  <LockKeyhole className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    dir="ltr"
                    className="h-12 border-white/[0.08] bg-white/[0.025] px-11 text-left text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-bold text-slate-300">
                  {copy.confirm}
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  dir="ltr"
                  className="h-12 border-white/[0.08] bg-white/[0.025] text-left text-white"
                />
              </div>

              {message && (
                <p role="alert" className="text-sm text-red-300">{message}</p>
              )}

              <Button
                type="submit"
                disabled={saving}
                className="h-12 w-full bg-gradient-to-l from-violet-600 via-blue-500 to-cyan-400 font-black text-white"
              >
                {saving ? copy.saving : copy.submit}
              </Button>
            </form>
          )}

          {status !== 'checking' && (
            <button
              type="button"
              onClick={() => setLocation('/login')}
              className="mt-6 text-sm font-bold text-cyan-400 hover:text-cyan-300"
            >
              {copy.back}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
