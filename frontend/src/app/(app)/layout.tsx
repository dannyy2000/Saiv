'use client';

import type { ReactElement, ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';

export default function ProtectedLayout({ children }: { children: ReactNode }): ReactElement {
  return <AppShell>{children}</AppShell>;
}
