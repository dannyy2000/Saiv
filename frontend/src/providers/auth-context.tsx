'use client';

import type { ReactElement } from 'react';
import type { BackendUser } from '@/types/api';
import { MagicAuthProvider, useMagicAuth } from '@/providers/magic-auth-provider';

export type AuthContextValue = {
  user: BackendUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<BackendUser | null>;
  signInWithEmail: (email: string) => Promise<boolean>;
};

export function AuthProvider({ children }: { children: React.ReactNode }): ReactElement {
  return <MagicAuthProvider>{children}</MagicAuthProvider>;
}

export function useAuth(): AuthContextValue {
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    signOut,
    refreshProfile,
    signInWithEmail,
  } = useMagicAuth();

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    signOut,
    refreshProfile,
    signInWithEmail,
  };
}
