'use client';

import type { ReactElement } from 'react';
import { useState, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'sonner';
import { ThirdwebProvider, useActiveAccount } from 'thirdweb/react';
// Chains are centrally configured in src/lib/thirdweb.ts via `supportedChains`
import { useRouter } from 'next/navigation';
import { client, supportedChains } from '@/lib/thirdweb';
import { AuthProvider } from '@/providers/auth-context';
import { cleanupBrowserExtensionAttributes, suppressBrowserExtensionWarnings } from '@/lib/browser-extensions';

export function Providers({ children }: { children: React.ReactNode }): ReactElement {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 0,
        staleTime: 60_000,
        gcTime: 300_000,
      },
      mutations: {
        retry: 0,
      },
    },
  }));

  useEffect(() => {
    // Handle browser extension compatibility on mount
    cleanupBrowserExtensionAttributes();
    suppressBrowserExtensionWarnings();

    // Clean up extension attributes periodically
    const interval = setInterval(cleanupBrowserExtensionAttributes, 1000);

    return () => clearInterval(interval);
  }, []);

  // Component that redirects to dashboard when a wallet becomes active.
  // This renders only when a Thirdweb client is configured.
  function RedirectOnConnect(): ReactElement {
    const account = useActiveAccount();
    const router = useRouter();
    const hasRedirected = useRef(false);

    useEffect(() => {
      // Auto-route to dashboard after successful sign-in / wallet connect.
      // Limits redirect to the landing page ('/') to avoid disrupting in-app pages.
      const onLanding = typeof window !== 'undefined' && window.location?.pathname === '/';
      if (onLanding && account?.address && !hasRedirected.current) {
        hasRedirected.current = true;
        router.push('/dashboard');
      }
    }, [account?.address, router]);

    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      {client ? (
        <ThirdwebProvider client={client} chains={supportedChains}>
          {/* Networks: Lisk & Lisk Sepolia are defined in src/lib/thirdweb.ts: `export const supportedChains`. Update there to change networks. */}
          <AuthProvider>
            <RedirectOnConnect />
            {children}
            <Toaster position="top-right" richColors />
          </AuthProvider>
        </ThirdwebProvider>
      ) : (
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors />
        </AuthProvider>
      )}
      {process.env.NODE_ENV === 'development' ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}
