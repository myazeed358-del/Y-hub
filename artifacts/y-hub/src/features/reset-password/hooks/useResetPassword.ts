import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation } from 'wouter';
import { resetPasswordCopy } from '@/i18n/resetPasswordCopy';
import { recoveryAuthService } from '../services/recoveryAuthService';
import { recoveryLinkStorage } from '../services/recoveryLinkStorage';
import { hasRecoveryIndicator } from '../domain/hasRecoveryIndicator';
import type { RecoveryStatus, ResetPasswordProps } from '../types';

export function useResetPassword(
  language: ResetPasswordProps['language']
) {
  const copy = resetPasswordCopy[language];
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<RecoveryStatus>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const { data: { subscription } } = recoveryAuthService.onAuthStateChange(
      (event, session) => {
        if (active && event === 'PASSWORD_RECOVERY' && session) {
          recoveryLinkStorage.remember();
          setStatus('ready');
        }
      }
    );

    const verify = async () => {
      try {
        const { data, error } = await recoveryAuthService.getSession();
        if (!active) return;

        // A regular signed-in session isn't enough for password recovery.
        const recoveryLinkSeen = hasRecoveryIndicator(
          window.location.href,
          recoveryLinkStorage.wasVisited()
        );

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
      const { error } = await recoveryAuthService.updatePassword(password);
      if (error) throw error;

      recoveryLinkStorage.clear();
      setPassword('');
      setConfirmation('');
      setStatus('saved');

      // Prevent the temporary recovery session from remaining signed in.
      await recoveryAuthService.signOutLocal();
    } catch {
      setMessage(copy.failed);
    } finally {
      setSaving(false);
    }
  };


  return {
    copy,
    setLocation,
    status,
    password,
    setPassword,
    confirmation,
    setConfirmation,
    message,
    saving,
    handleSubmit,
  };
}
