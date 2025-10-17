'use client';

import type { ReactElement } from 'react';
import { ConnectButton } from 'thirdweb/react';
import { inAppWallet, createWallet } from 'thirdweb/wallets';
import { createThirdwebClient } from "thirdweb";
import { defineChain } from 'thirdweb/chains';
import { cn } from '@/lib/utils';

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

if (!clientId) {
  // eslint-disable-next-line no-console
  console.warn('NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set. Thirdweb features will not work correctly.');
}

const client = createThirdwebClient({
  clientId: clientId ?? '',
});

// Define Lisk Sepolia chain
const liskSepolia = defineChain({
  id: 4202,
  name: 'Lisk Sepolia',
  nativeCurrency: {
    name: 'Lisk',
    symbol: 'LSK',
    decimals: 18,
  },
  rpc: 'https://rpc.sepolia-api.lisk.com',
  blockExplorers: [
    {
      name: 'Lisk Sepolia Explorer',
      url: 'https://sepolia-blockscout.lisk.com',
    },
  ],
});

const wallets = [
  inAppWallet({
    auth: {
      options: ['google', 'email'],
    },
  }),
  createWallet('io.metamask'),
  createWallet('com.coinbase.wallet'),
  createWallet('me.rainbow'),
  createWallet('io.rabby'),
  createWallet('io.zerion.wallet'),
];

interface ConnectWalletButtonProps {
  label?: string;
  className?: string;
}

export function ConnectWalletButton({ label = 'Sign In / Connect', className }: ConnectWalletButtonProps): ReactElement {
  return (
    <div className={cn('inline-flex rounded-xl bg-cyan-500/90 p-[1px] shadow-lg shadow-cyan-500/30 transition hover:shadow-cyan-400/40', className)}>
      <ConnectButton
        client={client}
        accountAbstraction={{
          chain: liskSepolia,
          sponsorGas: true,
        }}
        connectButton={{ label }}
        connectModal={{ size: 'compact' }}
        wallets={wallets}
      />
    </div>
  );
}
