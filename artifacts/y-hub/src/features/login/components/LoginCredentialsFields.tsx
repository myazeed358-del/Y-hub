import type { LoginFormData } from '../types';
import type { ChangeEvent } from 'react';
import { LockKeyhole, Mail } from 'lucide-react';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import type { loginCopy } from '@/i18n/loginCopy';

interface LoginCredentialsFieldsProps {
  copy: (typeof loginCopy)[keyof typeof loginCopy];
  formData: LoginFormData;
  isRecoveryRequest: boolean;
  handleChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function LoginCredentialsFields({
  copy,
  formData,
  isRecoveryRequest,
  handleChange,
}: LoginCredentialsFieldsProps) {
  return (
    <>
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="text-sm font-bold text-foreground dark:text-slate-300"
                  >
                    {copy.email}
                  </label>

                  <div className="relative">
                    <Mail className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-slate-500" />

                    <Input
                      id="email"
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="name@example.com"
                      dir="ltr"
                      className="h-12 border-input bg-background px-11 text-left text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/40 dark:border-white/[0.08] dark:bg-white/[0.025] dark:text-white dark:placeholder:text-slate-600 dark:focus-visible:ring-cyan-400/40"
                    />
                  </div>
                </div>

                {!isRecoveryRequest && (
                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="text-sm font-bold text-foreground dark:text-slate-300"
                  >
                    {copy.password}
                  </label>

                  <div className="relative">
                    <LockKeyhole className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-slate-500" />

                    <Input
                      id="password"
                      type="password"
                      name="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      minLength={6}
                      dir="ltr"
                      className="h-12 border-input bg-background px-11 text-left text-foreground focus-visible:ring-primary/40 dark:border-white/[0.08] dark:bg-white/[0.025] dark:text-white dark:focus-visible:ring-cyan-400/40"
                    />
                  </div>
                </div>
                )}
    </>
  );
}
