'use client';

import type { ReactElement, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { SignInGate } from '@/components/auth/sign-in-gate';
import { useAuth } from '@/providers/auth-context';

export default function ProtectedLayout({ children }: { children: ReactNode }): ReactElement {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
          <span className="text-sm uppercase tracking-[0.2em]">Preparing your workspace...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <SignInGate />;
  }

  return <AppShell>{children}</AppShell>;
}
