'use client';

import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { ThirdwebProvider } from 'thirdweb/react';
import { ethereum } from 'thirdweb/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/providers/auth-context';

export function Providers({ children }: { children: React.ReactNode }): ReactElement {
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

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID) {
      // eslint-disable-next-line no-console
      console.warn('NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set. Thirdweb features will not work correctly.');
    }
  }, []);

  return (
    <ThirdwebProvider
      clientId={process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID}
      activeChain={ethereum}
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
