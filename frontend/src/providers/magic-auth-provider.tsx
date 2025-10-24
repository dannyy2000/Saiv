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
import { authService } from '@/services/authService';
import type { BackendUser } from '@/types/api';

interface EmailAuthContextType {
  user: BackendUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  requiresVerification: boolean;
  verificationEmail: string | null;
  signInWithEmail: (email: string) => Promise<boolean>;
  refreshProfile: () => Promise<BackendUser | null>;
  resendVerification: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const EmailAuthContext = createContext<EmailAuthContextType | undefined>(undefined);

export function MagicAuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [user, setUser] = useState<BackendUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);

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
    try {
      const response = await apiClient.get('/auth/profile');
      const result = extractData(response);
      const profile = mapUser(result);
      setUser(profile);
      setRequiresVerification(false);
      setVerificationEmail(null);
      return profile;
    } catch (error: unknown) {
      const errorObj = error as { response?: { status?: number; data?: { requiresVerification?: boolean } } };
      if (errorObj.response?.status === 403 && errorObj.response?.data?.requiresVerification) {
        setRequiresVerification(true);
        setUser(null);
        throw error;
      }
      throw error;
    }
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
      const response = await authService.registerWithEmail(email);

      if (response.success) {
        if (response.data?.requiresVerification) {
          setRequiresVerification(true);
          setVerificationEmail(response.data.email || email);
          toast.success('Please check your email to verify your account');
          return false; // Don't redirect to dashboard
        }

        if (response.data?.token) {
          persistToken(response.data.token);
        }

        if (response.data?.user) {
          setUser(response.data.user as BackendUser);
          setRequiresVerification(false);
          setVerificationEmail(null);
        } else {
          await fetchProfile().catch((error) => {
            console.error('Profile refresh after email sign-in failed:', error);
          });
        }

        toast.success('Signed in successfully');
        return true;
      } else {
        toast.error(response.message || 'Unable to sign in. Please try again.');
        return false;
      }
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

  const resendVerification = useCallback(async (email: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await authService.resendVerification(email);

      if (response.success) {
        toast.success('Verification email sent successfully');
        return true;
      } else {
        toast.error(response.message || 'Failed to resend verification email');
        return false;
      }
    } catch (error) {
      console.error('Resend verification failed:', error);
      toast.error(getErrorMessage(error, 'Failed to resend verification email'));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      persistToken(null);
      clearAuthToken();
      setUser(null);
      setRequiresVerification(false);
      setVerificationEmail(null);
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
    requiresVerification,
    verificationEmail,
    signInWithEmail,
    refreshProfile,
    resendVerification,
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
