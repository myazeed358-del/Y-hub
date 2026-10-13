import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/utils/supabaseClient';
import { ResetPasswordView } from '@/components/reset-password/ResetPasswordView';
import { resetPasswordCopy } from '@/i18n/resetPasswordCopy';

type Props = {
  language: 'ar' | 'en';
  onToggleLanguage: () => void;
};

type RecoveryStatus = 'checking' | 'ready' | 'invalid' | 'saved';



export default function ResetPassword({ language, onToggleLanguage }: Props) {
  const copy = resetPasswordCopy[language];
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
    <ResetPasswordView
      language={language}
      onToggleLanguage={onToggleLanguage}
      copy={copy}
      status={status}
      password={password}
      setPassword={setPassword}
      confirmation={confirmation}
      setConfirmation={setConfirmation}
      message={message}
      saving={saving}
      handleSubmit={handleSubmit}
      setLocation={setLocation}
    />
  );
}
