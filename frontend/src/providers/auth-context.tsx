
'use client';

import type { ReactElement } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useActiveAccount, useActiveWallet, useActiveWalletConnectionStatus, useDisconnect } from 'thirdweb/react';
import { toast } from 'sonner';
import {
  apiClient,
  clearAuthToken,
  extractData,
  getAuthToken,
  getErrorMessage,
  onUnauthorized,
  setAuthToken,
  type ApiEnvelope,
} from '@/lib/apiClient';
import type { BackendUser } from '@/types/api';

interface RegisterResponse {
  token?: string;
  jwt?: string;
  accessToken?: string;
  user?: BackendUser;
  profile?: BackendUser;
  [key: string]: unknown;
}

type AuthContextValue = {
  user: BackendUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRegistering: boolean;
  connectionStatus: ReturnType<typeof useActiveWalletConnectionStatus>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (profile: BackendUser | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function deriveToken(data: RegisterResponse | BackendUser | null | undefined): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  if ('token' in data && typeof data.token === 'string') {
    return data.token;
  }
  if ('jwt' in data && typeof data.jwt === 'string') {
    return data.jwt;
  }
  if ('accessToken' in data && typeof data.accessToken === 'string') {
    return data.accessToken;
  }

  return null;
}

function deriveUser(data: RegisterResponse | ApiEnvelope<BackendUser> | BackendUser | null | undefined): BackendUser | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  if ('user' in data && data.user && typeof data.user === 'object') {
    return data.user as BackendUser;
  }

  if ('profile' in data && data.profile && typeof data.profile === 'object') {
    return data.profile as BackendUser;
  }

  if ('data' in data && data.data && typeof data.data === 'object') {
    return deriveUser(data.data as BackendUser);
  }

  return data as BackendUser;
}

export function AuthProvider({ children }: { children: React.ReactNode }): ReactElement {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUserState] = useState<BackendUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const connectionStatus = useActiveWalletConnectionStatus();
  const activeAccount = useActiveAccount();
  const address = activeAccount?.address ?? null;
  const activeWallet = useActiveWallet();
  const disconnect = useDisconnect();

  const registeringRef = useRef(false);

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
    try {
      if (activeWallet) {
        await disconnect.disconnect(activeWallet);
      }
    } catch (error) {
      console.error('Failed to disconnect wallet', error);
    } finally {
      clearSession();
      setIsBootstrapping(false);
    }
  }, [clearSession, disconnect, activeWallet]);

  const fetchProfile = useCallback(
    async (overrideToken?: string | null) => {
      const authToken = overrideToken ?? token;
      if (!authToken) {
        setUserState(null);
        setIsBootstrapping(false);
        return;
      }

      try {
        setIsProfileLoading(true);
        const response = await apiClient.get('/auth/profile', {
          headers: overrideToken ? { Authorization: `Bearer ${overrideToken}` } : undefined,
        });
  const payload = extractData(response) as BackendUser | { user?: BackendUser } | ApiEnvelope<BackendUser>;
        const profile = deriveUser(payload);
        setUserState(profile);
      } catch (error) {
        console.error('Failed to fetch profile', error);
        toast.error(getErrorMessage(error, 'Unable to load your profile. Please sign in again.'));
        await signOut();
      } finally {
        setIsProfileLoading(false);
        setIsBootstrapping(false);
      }
    },
    [signOut, token]
  );

  const refreshProfile = useCallback(() => fetchProfile(), [fetchProfile]);

  useEffect(() => {
    onUnauthorized(() => {
      toast.error('Session expired. Please sign in again.');
      void signOut();
    });

    return () => onUnauthorized(null);
  }, [signOut]);

  useEffect(() => {
    const stored = getAuthToken();
    if (stored) {
      setTokenState(stored);
    } else {
      setIsBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setUserState(null);
      setIsBootstrapping(false);
      return;
    }

    void fetchProfile();
  }, [token, fetchProfile]);

  // Sync token set by ConnectButton auth flow into context state
  useEffect(() => {
    if (connectionStatus === 'connected') {
      const stored = getAuthToken();
      if (stored && stored !== token) {
        setTokenState(stored);
      }
    }
  }, [connectionStatus, token]);

  useEffect(() => {
    if (connectionStatus === 'disconnected' && token) {
      void signOut();
    }
  }, [connectionStatus, signOut, token]);

  useEffect(() => {
    if (token || registeringRef.current || connectionStatus !== 'connected') {
      return;
    }

    // If a token already exists (e.g., set by ConnectButton auth), sync it and skip re-registering
    const stored = getAuthToken();
    if (stored) {
      setTokenState(stored);
      return;
    }

  const eoaAddress = address;

    if (!eoaAddress) {
      return;
    }

    let isActive = true;
    registeringRef.current = true;
    setIsRegistering(true);

    const register = async () => {
      try {
        const endpoint = '/auth/register/wallet';
        const payload = { eoaAddress };
        const response = await apiClient.post(endpoint, payload);
        const result = extractData(response) as RegisterResponse;
        const nextToken = deriveToken(result);
        const nextUser = deriveUser(result);

        if (!isActive) {
          return;
        }

        if (nextToken) {
          persistToken(nextToken);
        }

        if (nextUser) {
          setUserState(nextUser);
        }

        if (nextToken) {
          await fetchProfile(nextToken);
        } else {
          await fetchProfile();
        }

        toast.success('You are signed in.');
      } catch (error) {
        console.error('Failed to register user', error);
        toast.error(getErrorMessage(error, 'Unable to complete sign-in. Please try again.'));
        await signOut();
      } finally {
        if (isActive) {
          setIsRegistering(false);
          registeringRef.current = false;
          setIsBootstrapping(false);
        }
      }
    };

    void register();

    return () => {
      isActive = false;
    };
  }, [address, connectionStatus, fetchProfile, persistToken, signOut, token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      isLoading: isBootstrapping || isProfileLoading || isRegistering,
      isRegistering,
      connectionStatus,
      refreshProfile,
      signOut,
      setUser: setUserState,
    }),
    [connectionStatus, isBootstrapping, isProfileLoading, isRegistering, refreshProfile, signOut, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
