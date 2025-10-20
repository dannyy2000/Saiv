'use client';

import type { ReactElement } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  apiClient,
  clearAuthToken,
  extractData,
  getAuthToken,
  getErrorMessage,
  setAuthToken,
  type ApiEnvelope,
} from '@/lib/apiClient';
import type { BackendUser } from '@/types/api';

type AuthContextValue = {
  user: BackendUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function SimpleAuthProvider({ children }: { children: React.ReactNode }): ReactElement {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUserState] = useState<BackendUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistToken = useCallback((value: string | null) => {
    setAuthToken(value);
    setTokenState(value);
  }, []);

  const clearSession = useCallback(() => {
    persistToken(null);
    clearAuthToken();
    setUserState(null);
  }, [persistToken]);

  const signOut = useCallback(async () => {
    clearSession();
    setIsLoading(false);
    toast.success('Logged out successfully');
  }, [clearSession]);

  const fetchProfile = useCallback(
    async (overrideToken?: string | null) => {
      const authToken = overrideToken ?? token;
      if (!authToken) {
        setUserState(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await apiClient.get('/auth/profile', {
          headers: overrideToken ? { Authorization: `Bearer ${overrideToken}` } : undefined,
        });
        const payload = extractData(response) as BackendUser | { user?: BackendUser } | ApiEnvelope<BackendUser>;

        let profile: BackendUser | null = null;
        if (payload && typeof payload === 'object') {
          if ('user' in payload && payload.user) {
            profile = payload.user as BackendUser;
          } else if ('data' in payload && payload.data) {
            profile = payload.data as BackendUser;
          } else {
            profile = payload as BackendUser;
          }
        }

        setUserState(profile);
        console.log('Profile loaded successfully:', profile?.email);
      } catch (error) {
        console.error('Failed to fetch profile', error);
        toast.error(getErrorMessage(error, 'Unable to load your profile. Please sign in again.'));
        await signOut();
      } finally {
        setIsLoading(false);
      }
    },
    [signOut, token]
  );

  const refreshProfile = useCallback(() => fetchProfile(), [fetchProfile]);

  // Initialize auth state
  useEffect(() => {
    const stored = getAuthToken();
    console.log('Simple auth initializing, stored token:', stored ? 'present' : 'none');
    if (stored) {
      setTokenState(stored);
    } else {
      setIsLoading(false);
    }
  }, []);

  // Fetch profile when token changes
  useEffect(() => {
    if (!token) {
      setUserState(null);
      setIsLoading(false);
      return;
    }

    void fetchProfile();
  }, [token, fetchProfile]);

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isLoading,
    signOut,
    refreshProfile,
  };

  console.log('Simple auth state:', {
    hasToken: !!token,
    hasUser: !!user,
    isLoading,
    isAuthenticated: Boolean(token && user)
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSimpleAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useSimpleAuth must be used within a SimpleAuthProvider');
  }
  return context;
}