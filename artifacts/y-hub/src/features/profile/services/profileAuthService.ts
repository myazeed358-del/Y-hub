import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabaseClient';

export const profileAuthService = {
  async verifyCurrentPassword(
    email: string,
    currentPassword: string,
    expectedUserId: string
  ): Promise<boolean> {
    const verificationClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    const { data, error } =
      await verificationClient.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

    return !error && data.user?.id === expectedUserId;
  },

  async updatePassword(password: string) {
    return supabase.auth.updateUser({ password });
  },
};
