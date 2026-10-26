import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProfileNamesForm } from '../ProfileNamesForm';
const state = vi.hoisted(() => ({ profile: { full_name_ar: null, full_name_en: null } as { full_name_ar: string | null; full_name_en: string | null }, rpc: vi.fn(), refresh: vi.fn(), language: 'en' }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ profile: state.profile, refreshProfile: state.refresh }) }));
vi.mock('@/i18n/LanguageContext', () => ({ useLanguage: () => ({ language: state.language }) }));
vi.mock('@/utils/supabaseClient', () => ({ supabase: { rpc: state.rpc } }));
beforeEach(() => { state.profile = { full_name_ar: null, full_name_en: null }; state.language = 'en'; state.rpc.mockReset().mockResolvedValue({ error: null }); state.refresh.mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);
function fill() {
  fireEvent.change(screen.getByLabelText('Full name in Arabic'), { target: { value: 'أحمد' } });
  fireEvent.change(screen.getByLabelText('Full name in English'), { target: { value: 'Ahmad' } });
}
describe('profile name completion', () => {
  it('sends only names to the own-profile RPC and refreshes after success', async () => {
    render(<ProfileNamesForm />); fill(); fireEvent.click(screen.getByText('Complete names'));
    await waitFor(() => expect(state.refresh).toHaveBeenCalledOnce());
    expect(state.rpc).toHaveBeenCalledWith('complete_own_profile_names', { p_ar: 'أحمد', p_en: 'Ahmad' });
  });
  it('retains inputs after connection failure and permits retry', async () => {
    state.rpc.mockRejectedValueOnce(new Error('network'));
    render(<ProfileNamesForm />); fill(); fireEvent.click(screen.getByText('Complete names'));
    await screen.findByRole('alert');
    expect((screen.getByLabelText('Full name in English') as HTMLInputElement).value).toBe('Ahmad');
    expect(state.refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Complete names'));
    await waitFor(() => expect(state.refresh).toHaveBeenCalledOnce());
  });
  it('handles server conflict without replacing local input or claiming success', async () => {
    state.rpc.mockResolvedValue({ error: { code: 'PT409' } });
    render(<ProfileNamesForm />); fill(); fireEvent.click(screen.getByText('Complete names'));
    expect((await screen.findByRole('alert')).textContent).toContain('another device');
    expect(state.refresh).not.toHaveBeenCalled();
  });
  it('keeps complete profiles read-only', () => {
    state.profile = { full_name_ar: 'أحمد', full_name_en: 'Ahmad' };
    render(<ProfileNamesForm />);
    expect(screen.queryByRole('button')).toBeNull();
    expect((screen.getByLabelText('Full name in English') as HTMLInputElement).readOnly).toBe(true);
  });
  it('rejects invalid names before submitting', () => {
    render(<ProfileNamesForm />); fill();
    fireEvent.change(screen.getByLabelText('Full name in Arabic'), { target: { value: 'Ahmad' } });
    fireEvent.click(screen.getByText('Complete names'));
    expect(screen.getByRole('alert')).toBeTruthy();expect(state.rpc).not.toHaveBeenCalled();
  });
  it('uses explicit Arabic and English field directions', () => {
    state.language = 'ar';render(<ProfileNamesForm />);
    expect(screen.getByLabelText('الاسم الكامل بالعربية').getAttribute('dir')).toBe('rtl');
    expect(screen.getByLabelText('الاسم الكامل بالإنجليزية').getAttribute('dir')).toBe('ltr');
  });
});
