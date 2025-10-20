'use client';

import type { ReactElement, ReactNode } from 'react';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';

export function AppShell({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex min-h-screen flex-1 flex-col bg-slate-950/80">
        <AppHeader />
        <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-10 xl:px-12">
          <div className="mx-auto w-full max-w-7xl space-y-8 pb-16">{children}</div>
        </main>
      </div>
    </div>
  );
}
