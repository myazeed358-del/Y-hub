import type { LoginFormData } from '../types';

type SignUpFields = Pick<
  LoginFormData,
  'full_name' | 'major' | 'study_year'
>;

export function validateSignUpForm(
  data: SignUpFields,
  nameError: string,
  requiredError: string
): void {
  const nameRegex = /^[\p{L}\s]+$/u;

  if (!nameRegex.test(data.full_name)) {
    throw new Error(nameError);
  }

  if (!data.major || !data.study_year) {
    throw new Error(requiredError);
  }
}
