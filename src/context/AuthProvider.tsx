import * as Linking from 'expo-linking';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  isReady: boolean;
  isConfigured: boolean;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getAuthRedirectUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return new URL('/auth/callback', window.location.origin).toString();
  }
  return Linking.createURL('auth/callback');
}

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setIsReady(true);
    });

    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) console.warn('Could not restore the Supabase session:', error.message);
      setSession(data.session);
      setIsReady(true);
    });

    const handleAppState = (state: string) => {
      if (state === 'active') void client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    const appStateSubscription = Platform.OS === 'web'
      ? null
      : AppState.addEventListener('change', handleAppState);
    if (Platform.OS !== 'web') handleAppState(AppState.currentState);

    return () => {
      active = false;
      subscription.unsubscribe();
      appStateSubscription?.remove();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    isReady,
    isConfigured: isSupabaseConfigured,
    signInWithEmail: async email => {
      if (!supabase) throw new Error('Supabase 尚未設定。');
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
          shouldCreateUser: true,
          data: { display_name: email.split('@')[0] },
        },
      });
      if (error) throw error;
    },
    signOut: async () => {
      if (!supabase) return;
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    },
  }), [isReady, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be rendered inside AuthProvider.');
  return context;
}