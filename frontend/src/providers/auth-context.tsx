'use client';

import type { ReactElement } from 'react';
import type { BackendUser } from '@/types/api';
import { useCallback } from 'react';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { client } from '@/lib/thirdweb';

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
  // Thirdweb connection handles auth; no extra provider needed
  return <>{children}</>;
}

export function useAuth(): AuthContextValue {
  // If Thirdweb client is not configured, avoid calling thirdweb hooks
  if (!client) {
    return {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      requiresVerification: false,
      verificationEmail: null,
      signOut: async () => {},
      refreshProfile: async () => null,
      signInWithEmail: async (_email: string) => false,
      resendVerification: async (_email: string) => false,
    };
  }

  const account = useActiveAccount();
  const wallet = useActiveWallet();

  const address = account?.address ?? null;

  const user: BackendUser | null = address
    ? {
        id: address,
        address,
        eoaAddress: address,
        registrationType: 'wallet',
        profile: {},
      }
    : null;

  const isAuthenticated = Boolean(address);

  const signOut = useCallback(async () => {
    try {
      await wallet?.disconnect?.();
    } catch {
      // ignore
    }
  }, [wallet]);

  const refreshProfile = useCallback(async (): Promise<BackendUser | null> => {
    return user;
  }, [user]);

  const signInWithEmail = useCallback(async (_email: string): Promise<boolean> => {
    return false;
  }, []);

  const resendVerification = useCallback(async (_email: string): Promise<boolean> => {
    return false;
  }, []);

  return {
    user,
    token: null,
    isAuthenticated,
    isLoading: false,
    requiresVerification: false,
    verificationEmail: null,
    signOut,
    refreshProfile,
    signInWithEmail,
    resendVerification,
  };
}
