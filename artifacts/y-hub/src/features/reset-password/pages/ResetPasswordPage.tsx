import { ResetPasswordView } from '../components/ResetPasswordView';
import { useResetPassword } from '../hooks/useResetPassword';
import type { ResetPasswordProps } from '../types';

export default function ResetPasswordPage({
  language,
  onToggleLanguage,
}: ResetPasswordProps) {
  const controller = useResetPassword(language);

  return (
    <ResetPasswordView
      language={language}
      onToggleLanguage={onToggleLanguage}
      {...controller}
    />
  );
}
