'use client';

import type { ReactElement, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MagicAuthModal } from './magic-auth-modal';
import { useAuth } from '@/providers/auth-context';

interface ConnectWalletButtonProps {
  label?: string;
  className?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  icon?: ReactNode;
}

export function ConnectWalletButton({
  label = 'Sign In',
  className,
  variant = 'primary',
  size = 'md',
  icon,
}: ConnectWalletButtonProps): ReactElement {
  const { isLoading, isAuthenticated } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      setIsModalOpen(false);
    }
  }, [isAuthenticated]);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn('rounded-xl', className)}
        onClick={() => {
          if (!isLoading) {
            setIsModalOpen(true);
          }
        }}
        leftIcon={icon ?? <LogIn className="h-4 w-4" />}
        isLoading={isLoading}
      >
        {label}
      </Button>
      <MagicAuthModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
