import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { LockKeyhole } from 'lucide-react';

import { supabase } from '@/utils/supabaseClient';
import YHubLogo from '@/components/YHubLogo';
import ScientificBackdrop from '@/components/ScientificBackdrop';

import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';

type Props = {
  language: 'ar' | 'en';
  onToggleLanguage: () => void;
};

type RecoveryStatus = 'checking' | 'ready' | 'invalid' | 'saved';

const translations = {
  ar: {
    title: 'تعيين كلمة مرور جديدة',
    description: 'أدخل كلمة المرور الجديدة لحسابك في Y HUB.',
    password: 'كلمة المرور الجديدة',
    confirm: 'تأكيد كلمة المرور',
    submit: 'حفظ كلمة المرور',
    saving: 'جاري الحفظ...',
    checking: 'جاري التحقق من رابط الاستعادة...',
    invalid: 'رابط استعادة كلمة المرور غير صالح أو انتهت صلاحيته.',
    saved: 'تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.',
    mismatch: 'كلمتا المرور غير متطابقتين.',
    tooShort: 'يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل.',
    failed: 'تعذّر تغيير كلمة المرور. حاول مرة أخرى أو اطلب رابطًا جديدًا.',
    back: 'العودة إلى تسجيل الدخول',
  },
  en: {
    title: 'Set a new password',
    description: 'Enter a new password for your Y HUB account.',
    password: 'New password',
    confirm: 'Confirm password',
    submit: 'Save password',
    saving: 'Saving...',
    checking: 'Verifying your recovery link...',
    invalid: 'This password recovery link is invalid or has expired.',
    saved: 'Your password has been changed. You can now sign in.',
    mismatch: 'Passwords do not match.',
    tooShort: 'Password must contain at least 8 characters.',
    failed: 'Could not update your password. Try again or request a new link.',
    back: 'Back to sign in',
  },
} as const;

export default function ResetPassword({ language, onToggleLanguage }: Props) {
  const copy = translations[language];
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<RecoveryStatus>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (active && event === 'PASSWORD_RECOVERY' && session) {
          sessionStorage.setItem('yhub_password_recovery', '1');
          setStatus('ready');
        }
      }
    );

    const verify = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!active) return;

        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
        const recoveryLinkSeen =
          sessionStorage.getItem('yhub_password_recovery') === '1' ||
          hash.get('type') === 'recovery' ||
          url.searchParams.has('code');

        setStatus((current) => {
          if (current === 'ready') return current;
          return !error && data.session && recoveryLinkSeen
            ? 'ready'
            : 'invalid';
        });
      } catch {
        if (active) {
          setStatus((current) => current === 'ready' ? current : 'invalid');
        }
      }
    };

    void verify();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');

    if (password !== confirmation) {
      setMessage(copy.mismatch);
      return;
    }

    if (password.length < 8) {
      setMessage(copy.tooShort);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      sessionStorage.removeItem('yhub_password_recovery');
      setPassword('');
      setConfirmation('');
      setStatus('saved');

      // Prevent the temporary recovery session from remaining signed in.
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      setMessage(copy.failed);
    } finally {
      setSaving(false);
    }
  };

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
