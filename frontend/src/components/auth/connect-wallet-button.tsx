'use client';

import type { ReactElement } from 'react';
import { ConnectWallet } from '@thirdweb-dev/react';
import { cn } from '@/lib/utils';

interface ConnectWalletButtonProps {
  label?: string;
  className?: string;
}

export function ConnectWalletButton({ label = 'Connect Wallet', className }: ConnectWalletButtonProps): ReactElement {
  return (
    <div className={cn('inline-flex rounded-xl bg-cyan-500/90 p-[1px] shadow-lg shadow-cyan-500/30 transition hover:shadow-cyan-400/40', className)}>
      <ConnectWallet
        theme="dark"
        btnTitle={label}
        modalTitle="Sign in to Saiv"
        switchToActiveChain={false}
        modalSize="wide"
        className="!rounded-[11px] !bg-slate-950/95 !px-4 !py-2 !text-sm !font-semibold !text-cyan-100 hover:!bg-slate-900"
        style={{ borderRadius: 12 }}
      />
    </div>
  );
}
