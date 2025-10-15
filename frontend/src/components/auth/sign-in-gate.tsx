'use client';

import type { ReactElement } from 'react';
import { ConnectWalletButton } from '@/components/auth/connect-wallet-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SignInGateProps {
  heading?: string;
  description?: string;
}

export function SignInGate({
  heading = 'Connect to continue',
  description = 'Sign in with email or wallet to unlock Saiv\'s gasless savings, group coordination, and wallet automations.',
}: SignInGateProps): ReactElement {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <Card className="max-w-xl text-center">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-slate-100">{heading}</CardTitle>
          <CardDescription className="text-sm text-slate-400">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-slate-300">
              Saiv automatically spins up main and savings wallets, covers gas fees, and keeps your group contributions in perfect sync.
            </p>
            <p className="text-xs uppercase tracking-wide text-cyan-300">No seed phrases • No gas fees • Fast onboarding</p>
          </div>
          <ConnectWalletButton className="w-full sm:w-auto" />
        </CardContent>
      </Card>
    </div>
  );
}
