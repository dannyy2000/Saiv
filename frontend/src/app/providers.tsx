'use client';

import type { ReactElement } from 'react';
import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/providers/auth-context';
import { cleanupBrowserExtensionAttributes, suppressBrowserExtensionWarnings } from '@/lib/browser-extensions';

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
    // Handle browser extension compatibility on mount
    cleanupBrowserExtensionAttributes();
    suppressBrowserExtensionWarnings();

    // Clean up extension attributes periodically
    const interval = setInterval(cleanupBrowserExtensionAttributes, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster position="top-right" richColors />
      </AuthProvider>
      {process.env.NODE_ENV === 'development' ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}
