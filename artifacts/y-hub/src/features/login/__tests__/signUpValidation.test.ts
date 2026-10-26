import { describe, expect, it } from 'vitest';
import { validateSignUpForm } from '../domain/validateSignUpForm';

describe('validateSignUpForm', () => {
  const valid = {
    full_name_ar: 'أحمد عبد الله',
    full_name_en: 'Ahmad Abdullah',
    major: 'mathematics',
    study_year: '1',
  };

  it('accepts a valid name and selected major', () => {
    expect(() =>
      validateSignUpForm(valid, 'name', 'required')
    ).not.toThrow();
  });

  it('accepts Arabic letters', () => {
    expect(() =>
      validateSignUpForm(
        { ...valid, full_name_ar: 'أحمد عبدالله' },
        'name',
        'required'
      )
    ).not.toThrow();
  });

  it('rejects digits in the name', () => {
    expect(() =>
      validateSignUpForm(
        { ...valid, full_name_en: 'Ahmad123' },
        'name',
        'required'
      )
    ).toThrow('name');
  });

  it('rejects missing major', () => {
    expect(() =>
      validateSignUpForm(
        { ...valid, major: '' },
        'name',
        'required'
      )
    ).toThrow('required');
  });

  it('rejects missing study year', () => {
    expect(() =>
      validateSignUpForm(
        { ...valid, study_year: '' },
        'name',
        'required'
      )
    ).toThrow('required');
  });
});
