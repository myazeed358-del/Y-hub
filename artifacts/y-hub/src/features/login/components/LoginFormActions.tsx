import type { LoginMessage } from '../types';
import type {
  Dispatch,
  SetStateAction,
} from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import type { loginCopy } from '@/i18n/loginCopy';

interface LoginFormActionsProps {
  copy: (typeof loginCopy)[keyof typeof loginCopy];
  isSignUp: boolean;
  isRecoveryRequest: boolean;
  loading: boolean;
  message: LoginMessage;
  setMessage: Dispatch<SetStateAction<LoginMessage>>;
  setIsRecoveryRequest: Dispatch<SetStateAction<boolean>>;
  switchMode: () => void;
}

export function LoginFormActions({
  copy,
  isSignUp,
  isRecoveryRequest,
  loading,
  message,
  setMessage,
  setIsRecoveryRequest,
  switchMode,
}: LoginFormActionsProps) {
  return (
    <>
                {!isSignUp && !isRecoveryRequest && (
                  <div className="text-end">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRecoveryRequest(true);
                        setMessage({ text: '', type: '' });
                      }}
                      className="text-sm font-semibold text-primary transition hover:opacity-80 dark:text-cyan-400 dark:hover:text-cyan-300"
                    >
                      {copy.forgotLink}
                    </button>
                  </div>
                )}

                {message.text && (
                  <div
                    className={`rounded-xl border px-4 py-3 text-sm leading-6 ${
                      message.type === 'error'
                        ? 'border-red-500/20 bg-red-500/10 text-red-700 dark:border-red-400/20 dark:text-red-300'
                        : 'border-primary/20 bg-primary/10 text-primary dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200'
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full bg-gradient-to-l from-violet-600 via-blue-500 to-cyan-400 text-base font-black text-white shadow-[0_10px_35px_rgba(34,211,238,0.12)] transition hover:opacity-90"
                >
                  {loading
                    ? copy.loading
                    : isRecoveryRequest
                      ? copy.forgotAction
                      : isSignUp
                        ? copy.createAction
                        : copy.loginAction}
                </Button>

                {!isRecoveryRequest ? (
                  <>
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border dark:border-white/[0.07]" />
                  </div>

                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-4 text-muted-foreground dark:bg-[#07111f] dark:text-slate-600">
                      {copy.or}
                    </span>
                  </div>
                </div>

                <div className="text-center text-sm text-muted-foreground dark:text-slate-400">
                  {isSignUp
                    ? copy.haveAccount
                    : copy.noAccount}{' '}

                  <button
                    type="button"
                    onClick={switchMode}
                    className="font-bold text-primary transition hover:opacity-80 dark:text-cyan-400 dark:hover:text-cyan-300"
                  >
                    {isSignUp ? copy.goLogin : copy.goCreate}
                  </button>
                </div>
                  </>
                ) : (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRecoveryRequest(false);
                        setMessage({ text: '', type: '' });
                      }}
                      className="text-sm font-bold text-primary transition hover:opacity-80 dark:text-cyan-400 dark:hover:text-cyan-300"
                    >
                      {copy.backToLogin}
                    </button>
                  </div>
                )}

                {isSignUp && (
                  <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4 text-xs leading-6 text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-500">
                    <Mail className="mt-1 h-4 w-4 shrink-0" />

                    <p>
                      {copy.emailNotice}
                    </p>
                  </div>
                )}
    </>
  );
}
