import { supabase } from '@/utils/supabaseClient';

export const loginAuthService = {
  async requestPasswordRecovery(email: string): Promise<void> {
    const basePath =
      import.meta.env.BASE_URL.replace(/\/$/, '');

    const redirectTo =
      `${window.location.origin}${basePath}/reset-password`;

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo }
      );

    if (error) {
      throw error;
    }
  },
};
