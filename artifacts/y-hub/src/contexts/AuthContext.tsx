import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../utils/supabaseClient';
import { User } from '@supabase/supabase-js';

type Role = 'student' | 'instructor' | 'admin' | 'super_admin';

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'profile_missing' | 'profile_error';

export interface UserProfile {
  full_name?: string;
  age?: number;
  major?: string;
  study_year?: string;
  phone?: string;
  role?: Role;
}

export interface SignUpData {
  email: string;
  password: string;
  full_name?: string;
  age?: string | number;
  major?: string;
  study_year?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  role: Role | null;
  major: string | null;
  profile: UserProfile | null;
  status: AuthStatus;
  loading: boolean; // Retained for backwards compatibility, but status is preferred
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: SignUpData) => Promise<void>;
  signOut: () => Promise<void>;
  updateMajor: (newMajor: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  major: null,
  profile: null,
  status: 'loading',
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  updateMajor: async () => {}
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [major, setMajor] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setStatus('unauthenticated');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setStatus('loading');
        fetchUserProfile(session.user.id);
      } else {
        setRole(null);
        setMajor(null);
        setProfile(null);
        setStatus('unauthenticated');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();

      if (error) {
        console.error("Error fetching profile:", error);
        setStatus('profile_error');
        setRole(null);
        setProfile(null);
        return;
      }

      if (data) {
        setRole(data.role as Role);
        setMajor(data.major);
        setProfile({ ...data });
        setStatus('authenticated');
      } else {
        setStatus('profile_missing');
        setRole(null);
        setProfile(null);
      }
    } catch (err) {
      console.error("Unexpected error fetching profile:", err);
      setStatus('profile_error');
      setRole(null);
      setProfile(null);
    }
  };

  const updateMajor = async (newMajor: string) => {
    if (!user) return;
    try {
      // Use the secure RPC instead of direct table update
      const { error } = await supabase.rpc('update_own_profile', {
        p_updates: { major: newMajor }
      });
      
      if (!error) {
        setMajor(newMajor);
        setProfile(prev => prev ? { ...prev, major: newMajor } : null);
      } else {
        throw error;
      }
    } catch (err) {
      console.error("Failed to update major:", err);
      throw err;
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user && !data.session) {
      throw new Error('البريد الإلكتروني غير مفعل.');
    }
  };

  const signUp = async (formData: SignUpData) => {
    // The database trigger will handle inserting into `users` table safely.
    const { error: signUpError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.full_name,
          age: formData.age ? parseInt(formData.age as string, 10) : null,
          major: formData.major,
          study_year: formData.study_year,
          phone: formData.phone
        }
      }
    });
    
    if (signUpError) throw signUpError;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const loading = status === 'loading';

  return (
    <AuthContext.Provider value={{ user, role, major, profile, status, loading, signIn, signUp, signOut, updateMajor }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
