export type RecoveryStatus =
  | 'checking'
  | 'ready'
  | 'invalid'
  | 'saved';

export interface ResetPasswordProps {
  language: 'ar' | 'en';
  onToggleLanguage: () => void;
}
