'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ThirdwebProvider,
  embeddedWallet,
  metamaskWallet,
  walletConnect,
} from '@thirdweb-dev/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/providers/auth-context';

export function Providers({ children }: { children: React.ReactNode }): JSX.Element {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
      },
      mutations: {
        retry: 1,
      },
    },
  }));

  const walletConnectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  const supportedWallets = useMemo(() => {
    const wallets = [
      embeddedWallet({
        auth: {
          options: ['email'],
        },
      }),
      metamaskWallet(),
    ];

    if (walletConnectId) {
      wallets.push(
        walletConnect({
          projectId: walletConnectId,
        })
      );
    }

    return wallets;
  }, [walletConnectId]);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID) {
      // eslint-disable-next-line no-console
      console.warn('NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set. Thirdweb features will not work correctly.');
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('thirdweb:lastConnectedWalletId');
    }
  }, []);

  return (
    <ThirdwebProvider
      autoConnect={false}
      clientId={process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID}
      activeChain="polygon"
      supportedWallets={supportedWallets}
      dAppMeta={{
        name: 'Saiv Command Center',
        description: 'Gasless Web3 savings and coordination for pods and personal vaults.',
        url: 'https://saiv.app',
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors />
        </AuthProvider>
        {process.env.NODE_ENV === 'development' ? <ReactQueryDevtools initialIsOpen={false} /> : null}
      </QueryClientProvider>
    </ThirdwebProvider>
  );
}
