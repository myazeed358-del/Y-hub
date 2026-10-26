export interface ProfileNames {
  full_name?: string | null;
  full_name_ar?: string | null;
  full_name_en?: string | null;
}

/** Legacy names are retained verbatim in storage; presentation has a safe fallback. */
export function profileName(profile: ProfileNames | null | undefined, language: 'ar' | 'en', fallback = ''): string {
  return [profile?.[`full_name_${language}`], profile?.[language === 'ar' ? 'full_name_en' : 'full_name_ar'], profile?.full_name]
    .find(name => name?.trim())?.trim() || fallback;
}

/** Mirrors 0044. No inferred translations, HTML, controls, digits or bidi overrides. */
export function validProfileName(value: string, language: 'ar' | 'en'): boolean {
  const name = value.trim();
  if ([...name].length < 2 || [...name].length > 120) return false;
  return language === 'ar'
    ? /^[ء-يً-ٰٟ '.’\-]+$/u.test(name) && /[ء-غف-ي]/u.test(name)
    : /^[A-Za-zÀ-ÖØ-öø-ÿĀ-ſ\u0300-\u036f '.’\-]+$/u.test(name) && /[A-Za-zÀ-ÖØ-öø-ÿĀ-ſ]/u.test(name);
}
