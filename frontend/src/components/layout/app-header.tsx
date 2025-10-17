'use client';

import { useMemo } from 'react';
import { ChevronRight, LogOut, Sparkles } from 'lucide-react';
import { ConnectWalletButton } from '@/components/auth/connect-wallet-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/providers/auth-context';
import { cn, truncateAddress } from '@/lib/utils';

export function AppHeader(): JSX.Element {
  const { user, isAuthenticated, isLoading, signOut } = useAuth();

  const name = useMemo(() => user?.profile?.name || user?.email || user?.eoaAddress || 'Guest', [user]);
  const address = useMemo(() => user?.address || user?.eoaAddress || user?.savingsAddress, [user]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 px-6 py-4 backdrop-blur-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Saiv Gasless</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-100">Welcome back{isAuthenticated && name ? `, ${name.split(' ')[0]}` : ''}</h2>
          <p className="text-sm text-slate-400">
            {isAuthenticated
              ? 'Your wallets are synced and ready for gasless transactions.'
              : 'Connect via email or wallet to start orchestrating gasless savings.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isAuthenticated && address ? (
            <Badge variant="outline" className="flex items-center gap-2 rounded-xl border-cyan-400/30 bg-slate-900/90 px-3 py-2 text-xs text-cyan-200">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-sm font-semibold text-cyan-200">
                {name ? name.charAt(0).toUpperCase() : 'S'}
              </span>
              <span className="flex flex-col text-left">
                <span className="text-[0.7rem] uppercase tracking-wide text-slate-400">Main Wallet</span>
                <span className="font-mono text-[0.7rem] text-cyan-200">{truncateAddress(address)}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-cyan-300/80" />
            </Badge>
          ) : null}

          {isAuthenticated ? (
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                void signOut();
              }}
              leftIcon={<LogOut className="h-4 w-4" />}
              className={cn('border border-transparent text-slate-300 hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-200', isLoading && 'pointer-events-none opacity-60')}
              isLoading={isLoading}
            >
              Sign out
            </Button>
          ) : (
            <ConnectWalletButton />
          )}
        </div>
      </div>
    </header>
  );
}
