import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, retryOperation, checkSupabaseConnection } from './supabase';
import type { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'doctor' | 'lab_tech';
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileError: string | null;
  connectionError: boolean;
  retryConnection: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (() => {
        console.log('Auth state changed:', event, 'User:', session?.user?.email);
        setUser(session?.user ?? null);
        if (session?.user) {
          loadUserProfile(session.user.id);
        } else {
          setProfile(null);
          setProfileError(null);
          setConnectionError(false);
          setIsLoadingProfile(false);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserProfile(userId: string) {
    if (isLoadingProfile) {
      console.log('Already loading profile, skipping...');
      return;
    }

    console.log('Loading user profile for:', userId);
    setIsLoadingProfile(true);
    setProfileError(null);
    setConnectionError(false);

    try {
      const { data, error } = await retryOperation(
        async () => {
          const result = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          if (result.error) throw result.error;
          return result;
        },
        3,
        1000
      );

      if (error) {
        console.error('Error loading user profile:', error);
        const errorMsg = `Database error: ${error.message} (Code: ${error.code || ''})`;
        setProfileError(errorMsg);
        setProfile(null);
        return;
      }

      if (!data) {
        console.error('User profile not found for userId:', userId);
        const errorMsg = `No profile found in database for user ID: ${userId}`;
        setProfileError(errorMsg);
        setProfile(null);
        return;
      }

      console.log('User profile loaded successfully:', data);
      setProfile(data);
      setProfileError(null);
      setConnectionError(false);
    } catch (error) {
      console.error('Exception loading user profile:', error);

      const isNetworkError =
        error instanceof Error &&
        (error.message.includes('Failed to fetch') ||
         error.message.includes('Network') ||
         error.message.includes('timeout'));

      if (isNetworkError) {
        setConnectionError(true);
        const connectionCheck = await checkSupabaseConnection();

        if (connectionCheck.isPaused) {
          setProfileError('Database error: Supabase project appears to be paused or unavailable. Please check your Supabase dashboard. (Code: PAUSED)');
        } else {
          setProfileError(`Database error: ${connectionCheck.error || 'Cannot connect to database server'} (Code: NETWORK)`);
        }
      } else {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error loading profile';
        setProfileError(`Database error: ${errorMsg} (Code: )`);
      }

      setProfile(null);
    } finally {
      setIsLoadingProfile(false);
      setLoading(false);
      console.log('Finished loading profile, loading set to false');
    }
  }

  async function retryConnection() {
    if (!user) return;

    console.log('Retrying connection...');
    setLoading(true);
    setProfileError(null);
    setConnectionError(false);

    const connectionCheck = await checkSupabaseConnection();

    if (!connectionCheck.connected) {
      setLoading(false);
      setConnectionError(true);
      if (connectionCheck.isPaused) {
        setProfileError('Database error: Supabase project appears to be paused or unavailable. Please check your Supabase dashboard. (Code: PAUSED)');
      } else {
        setProfileError(`Database error: ${connectionCheck.error || 'Cannot connect to database'} (Code: NETWORK)`);
      }
      return;
    }

    await loadUserProfile(user.id);
  }

  async function signIn(email: string, password: string) {
    try {
      console.log('Signing in with:', email);
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        setLoading(false);
        throw error;
      }

      console.log('Sign in successful, waiting for auth state change...');
      return {};
    } catch (error: unknown) {
      setLoading(false);
      return { error: error instanceof Error ? error.message : 'Failed to sign in' };
    }
  }

  async function signOut() {
    console.log('Signing out...');
    setProfile(null);
    setProfileError(null);
    setConnectionError(false);
    setIsLoadingProfile(false);
    setLoading(false);
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileError, connectionError, retryConnection, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
