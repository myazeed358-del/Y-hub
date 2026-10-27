export interface LoginProps {
  language: 'ar' | 'en';
  onToggleLanguage: () => void;
}

export interface LoginFormData {
  email: string;
  password: string;
  full_name_ar: string;
  full_name_en: string;
  age: string;
  major: string;
  study_year: string;
  phone: string;
}

export interface LoginMessage {
  text: string;
  type: string;
}
