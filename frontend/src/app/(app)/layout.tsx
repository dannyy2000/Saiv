'use client';

import type { ReactElement, ReactNode } from 'react';
import { useEffect } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/providers/auth-context';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ProtectedLayout({ children }: { children: ReactNode }): ReactElement {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center gap-2">
        <p className="text-2xl font-bold">Loading</p>
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
