import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  buildAcademicIdentity,
  majorLabels,
  roleLabels,
} from '../domain/academicIdentity';

describe('academic identity', () => {
  it('preserves anonymous Arabic defaults', () => {
    const identity = buildAcademicIdentity({
      language: 'ar',
    });

    expect(identity.accountName).toBe('مستخدم Y HUB');
    expect(identity.roleLabel).toBe('حساب أكاديمي');
    expect(identity.academicMeta).toBe('حساب أكاديمي');
  });

  it('uses the email when no full name exists', () => {
    const identity = buildAcademicIdentity({
      language: 'en',
      email: 'student@example.edu',
    });

    expect(identity.accountName).toBe('student');
    expect(identity.firstName).toBe('student');
    expect(identity.avatarInitial).toBe('S');
  });

  it('preserves full name and first name', () => {
    const identity = buildAcademicIdentity({
      language: 'ar',
      email: 'fallback@example.edu',
      profile: {
        full_name: '  سارة محمد  ',
        role: 'student',
      },
    });

    expect(identity.accountName).toBe('سارة محمد');
    expect(identity.firstName).toBe('سارة');
    expect(identity.avatarInitial).toBe('س');
  });

  it('resolves a student major and study year', () => {
    const identity = buildAcademicIdentity({
      language: 'ar',
      profile: {
        role: 'student',
        major: 'mathematics',
        study_year: 2,
      },
    });

    expect(identity.majorLabel).toBe('الرياضيات');
    expect(identity.studyYearLabel).toBe('السنة 2');
    expect(identity.academicMeta)
      .toBe('الرياضيات · السنة 2');
  });

  it('preserves English academic labels', () => {
    const identity = buildAcademicIdentity({
      language: 'en',
      profile: {
        role: 'student',
        major: 'mathematics',
        study_year: 3,
      },
    });

    expect(identity.majorLabel).toBe('Mathematics');
    expect(identity.studyYearLabel).toBe('Year 3');
  });

  it('preserves instructor labels', () => {
    const identity = buildAcademicIdentity({
      language: 'ar',
      profile: {
        role: 'instructor',
      },
    });

    expect(identity.roleLabel).toBe('مدرّس');
    expect(identity.academicMeta).toBe('مدرّس');
  });

  it('preserves super admin labels', () => {
    const identity = buildAcademicIdentity({
      language: 'en',
      profile: {
        role: 'super_admin',
      },
    });

    expect(identity.roleLabel).toBe('Super Admin');
  });

  it('preserves unknown major fallback', () => {
    const identity = buildAcademicIdentity({
      language: 'en',
      profile: {
        role: 'student',
        major: 'data_science',
      },
    });

    expect(identity.majorLabel).toBe('data science');
  });

  it('preserves unknown role fallback', () => {
    const identity = buildAcademicIdentity({
      language: 'en',
      profile: {
        role: 'custom_role',
      },
    });

    expect(identity.roleLabel).toBe('custom_role');
    expect(identity.academicMeta).toBe('custom_role');
  });

  it('keeps all existing label mappings', () => {
    expect(majorLabels.mathematics.en).toBe('Mathematics');
    expect(majorLabels.law.ar).toBe('الحقوق');
    expect(roleLabels.admin.en).toBe('Admin');
  });
});
