import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProfileAccountInfo } from '../ProfileAccountInfo';
import { getProfileCopy } from '@/i18n/profileCopy';

const common = {
  accountEmail: 'student@example.test',
  roleLabel: 'Student',
  majorLabel: 'Mathematics',
};

describe('ProfileAccountInfo user number', () => {
  it('shows the nine-digit assigned number without changing its leading zeros', () => {
    const html = renderToStaticMarkup(
      <ProfileAccountInfo
        {...common}
        copy={getProfileCopy(true)}
        profile={{ full_name: 'Test Student', user_number: '270100001' }}
      />,
    );

    expect(html).toContain('رقم المستخدم');
    expect(html).toContain('270100001');
    expect(html).toContain('dir="ltr"');
  });

  it('does not fabricate a number when the profile has none', () => {
    const html = renderToStaticMarkup(
      <ProfileAccountInfo
        {...common}
        copy={getProfileCopy(false)}
        profile={{ full_name: 'Test Student' }}
      />,
    );

    expect(html).toContain('Account number');
    expect(html).toContain('Not available');
    expect(html).not.toContain('000000000');
  });
});
