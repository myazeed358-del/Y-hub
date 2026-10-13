import type {
  AuthChangeEvent,
  Session,
} from '@supabase/supabase-js';

import { supabase } from '@/utils/supabaseClient';

type RecoveryAuthCallback = (
  event: AuthChangeEvent,
  session: Session | null
) => void;

export const recoveryAuthService = {
  onAuthStateChange(callback: RecoveryAuthCallback) {
    return supabase.auth.onAuthStateChange(
      async (event, session) => {
        callback(event, session);
      }
    );
  },

  getSession() {
    return supabase.auth.getSession();
  },

  updatePassword(password: string) {
    return supabase.auth.updateUser({ password });
  },

  signOutLocal() {
    return supabase.auth.signOut({ scope: 'local' });
  },
};
