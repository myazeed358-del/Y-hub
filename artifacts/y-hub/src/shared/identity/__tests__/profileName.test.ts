import { describe, expect, it } from 'vitest';
import { profileName, validProfileName } from '../profileName';
describe('localized identity', () => {
  it('selects the interface language without changing the original data', () => {
    const user = { full_name: 'Legacy', full_name_ar: 'أحمد', full_name_en: 'Ahmad' };
    expect(profileName(user, 'ar')).toBe('أحمد'); expect(profileName(user, 'en')).toBe('Ahmad');
    expect(user.full_name).toBe('Legacy');
  });
  it('falls back to the other name, then the unchanged legacy name, then a supplied label', () => {
    expect(profileName({ full_name_ar: 'أحمد' }, 'en')).toBe('أحمد');
    expect(profileName({ full_name_en: 'Ahmad' }, 'ar')).toBe('Ahmad');
    expect(profileName({ full_name_ar: ' ', full_name: 'Legacy' }, 'ar')).toBe('Legacy');
    expect(profileName(null, 'en', 'Unknown')).toBe('Unknown');
  });
  it.each([['أحمد عبد الله','ar'], ['مُحَمَّد','ar'], ["Jean-Luc O’Neil",'en'], ['José André','en']] as const)('accepts %s', (name, language) => {
    expect(validProfileName(name, language)).toBe(true);
  });
  it.each(['', ' ', '<img src=x>', 'John123', 'A\u202eB', '\u0000Ahmad', 'a'.repeat(121), '---', 'أحمد'])('rejects invalid English %j', name => {
    expect(validProfileName(name, 'en')).toBe(false);
  });
  it('does not accept a Latin name in the Arabic field', () => {
    expect(validProfileName('Ahmad', 'ar')).toBe(false);
  });
});
