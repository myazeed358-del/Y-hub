import { validProfileName } from '@/shared/identity/profileName';
import type { LoginFormData } from '../types';

type SignUpFields = Pick<
  LoginFormData,
  'full_name_ar' | 'full_name_en' | 'major' | 'study_year'
>;

export function validateSignUpForm(
  data: SignUpFields,
  nameError: string,
  requiredError: string
): void {
  if (!validProfileName(data.full_name_ar, 'ar') || !validProfileName(data.full_name_en, 'en')) {
    throw new Error(nameError);
  }

  if (!data.major || !data.study_year) {
    throw new Error(requiredError);
  }
}
