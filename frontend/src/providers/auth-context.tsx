'use client';

import type { ReactElement } from 'react';
import type { BackendUser } from '@/types/api';
import { MagicAuthProvider, useMagicAuth } from '@/providers/magic-auth-provider';

export type AuthContextValue = {
  user: BackendUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requiresVerification: boolean;
  verificationEmail: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<BackendUser | null>;
  signInWithEmail: (email: string) => Promise<boolean>;
  resendVerification: (email: string) => Promise<boolean>;
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
    requiresVerification,
    verificationEmail,
    signOut,
    refreshProfile,
    signInWithEmail,
    resendVerification,
  } = useMagicAuth();

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    requiresVerification,
    verificationEmail,
    signOut,
    refreshProfile,
    signInWithEmail,
    resendVerification,
  };
}
