'use client';

import type { ReactElement, ReactNode } from 'react';
import { ConnectButton, darkTheme } from 'thirdweb/react';
import { client, wallets } from '@/lib/thirdweb';
import { Button, type ButtonProps } from '@/components/ui/button';

interface ConnectWalletButtonProps {
  label?: string;
  className?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  icon?: ReactNode;
}

export function ConnectWalletButton({
  label = 'Sign In / Connect',
  className,
  variant = 'primary',
  size = 'md',
}: ConnectWalletButtonProps): ReactElement {
  // Graceful fallback when NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set
  if (!client) {
    return (
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled
        title="Set NEXT_PUBLIC_THIRDWEB_CLIENT_ID in your .env.local to enable wallet connect"
      >
        {label}
      </Button>
    );
  }

  return (
    <ConnectButton
      client={client}
      connectButton={{ label }}
      connectModal={{ size: 'compact' }}
      theme={darkTheme({
        colors: {
          modalBg: 'hsl(253, 53%, 5%)',
          accentText: 'hsl(206, 75%, 53%)',
        },
      })}
      wallets={wallets}
    />
  );
}
