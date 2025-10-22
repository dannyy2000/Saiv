'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  apiClient,
  extractData,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  getErrorMessage,
} from '@/lib/apiClient';
import type { BackendUser } from '@/types/api';

interface AuthResponse {
  token?: string;
  user?: BackendUser;
}

interface EmailAuthContextType {
  user: BackendUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithEmail: (email: string) => Promise<boolean>;
  refreshProfile: () => Promise<BackendUser | null>;
  signOut: () => Promise<void>;
}

const EmailAuthContext = createContext<EmailAuthContextType | undefined>(undefined);

export function MagicAuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [user, setUser] = useState<BackendUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistToken = useCallback((value: string | null) => {
    setAuthToken(value ?? null);
    setToken(value ?? null);
  }, []);

  const mapUser = useCallback((payload: unknown): BackendUser | null => {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    if ('user' in payload && payload.user && typeof payload.user === 'object') {
      return payload.user as BackendUser;
    }

    if ('data' in payload && payload.data && typeof payload.data === 'object') {
      return payload.data as BackendUser;
    }

    return payload as BackendUser;
  }, []);

  const fetchProfile = useCallback(async (): Promise<BackendUser | null> => {
    const response = await apiClient.get('/auth/profile');
    const result = extractData(response);
    const profile = mapUser(result);
    setUser(profile);
    return profile;
  }, [mapUser]);

  useEffect(() => {
    let isActive = true;

    const bootstrap = async () => {
      const storedToken = getAuthToken();
      if (!storedToken) {
        if (isActive) {
          setIsLoading(false);
        }
        return;
      }

      persistToken(storedToken);
      setIsLoading(true);

      try {
        await fetchProfile();
      } catch (error) {
        console.error('Failed to restore session:', error);
        persistToken(null);
        setUser(null);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void bootstrap();

    return () => {
      isActive = false;
    };
  }, [fetchProfile, persistToken]);

  const signInWithEmail = useCallback(async (email: string): Promise<boolean> => {
    if (!email) {
      toast.error('Email is required');
      return false;
    }

    try {
      setIsLoading(true);
      const endpoint = process.env.NODE_ENV === 'development'
        ? '/auth/dev/register/email'
        : '/auth/register/email';

      const response = await apiClient.post(endpoint, { email });
      const result = extractData(response) as AuthResponse;

      if (result.token) {
        persistToken(result.token);
      }

      if (result.user) {
        setUser(result.user);
      } else {
        await fetchProfile().catch((error) => {
          console.error('Profile refresh after email sign-in failed:', error);
        });
      }

      toast.success('Signed in successfully');
      return true;
    } catch (error) {
      console.error('Email sign-in failed:', error);
      toast.error(getErrorMessage(error, 'Unable to sign in. Please try again.'));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile, persistToken]);

  const refreshProfile = useCallback(async (): Promise<BackendUser | null> => {
    try {
      setIsLoading(true);
      return await fetchProfile();
    } catch (error) {
      console.error('Failed to refresh profile:', error);
      toast.error(getErrorMessage(error, 'Unable to load your profile. Please sign in again.'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      persistToken(null);
      clearAuthToken();
      setUser(null);
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error(getErrorMessage(error, 'Logout failed. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  }, [persistToken]);

  const value: EmailAuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: Boolean(token && user),
    signInWithEmail,
    refreshProfile,
    signOut,
  };

  return (
    <EmailAuthContext.Provider value={value}>
      {children}
    </EmailAuthContext.Provider>
  );
}

export function useMagicAuth(): EmailAuthContextType {
  const context = useContext(EmailAuthContext);
  if (context === undefined) {
    throw new Error('useMagicAuth must be used within a MagicAuthProvider');
  }
  return context;
}
