'use client';

import type { ReactElement } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Clipboard, ClipboardCheck, ChevronRight, LogOut, Menu, Sparkles } from 'lucide-react';
import { ConnectWalletButton } from '@/components/auth/connect-wallet-button';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/auth-context';
import { cn, truncateAddress } from '@/lib/utils';
import { toast } from 'sonner';

interface AppHeaderProps {
  onMobileMenuToggle?: () => void;
}

export function AppHeader({ onMobileMenuToggle }: AppHeaderProps = {}): ReactElement {
  const { user, isAuthenticated, isLoading, signOut } = useAuth();

  const name = useMemo(() => user?.profile?.name || user?.email || user?.eoaAddress || 'Guest', [user]);
  const address = useMemo(() => user?.address || user?.eoaAddress || user?.savingsAddress, [user]);
  const savingsAddress = useMemo(() => user?.savingsAddress, [user]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [isMenuOpen]);

  const copyToClipboard = async (value?: string | null) => {
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setHasCopied(true);
      toast.success('Address copied to clipboard');
      setTimeout(() => setHasCopied(false), 1500);
    } catch (error) {
      console.error('Failed to copy address', error);
      toast.error('Unable to copy address. Please try again.');
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 px-4 py-4 backdrop-blur-lg sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onMobileMenuToggle}
          className="h-9 w-9 p-0 xl:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="space-y-1 flex-1 xl:flex-initial">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Saiv Gasless</span>
          </div>
          <h2 className="text-lg font-semibold text-slate-100 sm:text-xl">Welcome back{isAuthenticated && name ? `, ${name.split(' ')[0]}` : ''}</h2>
          <p className="text-sm text-slate-400 hidden sm:block">
            {isAuthenticated
              ? 'Your wallets are synced and ready for gasless transactions.'
              : 'Connect via email or wallet to start orchestrating gasless savings.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isAuthenticated && address ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-slate-900/90 px-3 py-2 text-xs text-cyan-200 transition hover:border-cyan-400/60 hover:text-cyan-100',
                  isMenuOpen && 'border-cyan-400/60'
                )}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-sm font-semibold text-cyan-200">
                  {name ? name.charAt(0).toUpperCase() : 'S'}
                </span>
                <span className="flex flex-col text-left">
                  <span className="text-[0.7rem] uppercase tracking-wide text-slate-400">Main Wallet</span>
                  <span className="font-mono text-[0.7rem] text-cyan-200">{truncateAddress(address)}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-cyan-300/80 transition-transform" style={{ transform: isMenuOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
              </button>

              {isMenuOpen ? (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-white/10 bg-slate-950/95 p-4 text-xs text-slate-300 shadow-xl">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[0.65rem] uppercase tracking-wide text-slate-500">Main wallet</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(address)}
                        className="flex items-center gap-1 text-[0.65rem] uppercase tracking-wide text-cyan-300 transition hover:text-cyan-100"
                      >
                        {hasCopied ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                        {hasCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="font-mono text-[0.7rem] break-all text-slate-200">{address}</p>
                    {savingsAddress ? (
                      <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[0.65rem] uppercase tracking-wide text-slate-500">Savings wallet</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(savingsAddress)}
                            className="flex items-center gap-1 text-[0.65rem] uppercase tracking-wide text-cyan-300 transition hover:text-cyan-100"
                          >
                            <Clipboard className="h-3.5 w-3.5" /> Copy
                          </button>
                        </div>
                        <p className="mt-2 font-mono text-[0.7rem] break-all text-slate-200">{savingsAddress}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {isAuthenticated ? (
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                signOut();
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
