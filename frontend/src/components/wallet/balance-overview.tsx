'use client';

import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, EyeOff, TrendingUp, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchWalletBalance } from '@/services/api/wallet';
import { formatTokenAmount, truncateAddress } from '@/lib/utils';
import type { WalletBalance } from '@/types/api';
import { useState } from 'react';

interface BalanceOverviewProps {
  className?: string;
}

export function BalanceOverview({ className }: BalanceOverviewProps): ReactElement {
  const [showBalances, setShowBalances] = useState(true);

  const { data: walletBalance, isLoading } = useQuery<WalletBalance>({
    queryKey: ['wallet', 'balance'],
    queryFn: fetchWalletBalance,
  });

  const totalBalance = useMemo(() => {
    if (!walletBalance) return '0';
    const mainBalance = parseFloat(walletBalance.mainWallet?.usdcEquivalent || '0');
    const savingsBalance = parseFloat(walletBalance.savingsWallet?.usdcEquivalent || '0');
    return (mainBalance + savingsBalance).toFixed(2);
  }, [walletBalance]);

  const totalUsdcBalance = useMemo(() => {
    if (!walletBalance) return '0';
    return walletBalance.totalUsdcEquivalent || '0';
  }, [walletBalance]);

  const mainBalanceFormatted = useMemo(
    () => formatTokenAmount(walletBalance?.mainWallet?.usdcEquivalent ?? '0', 2),
    [walletBalance?.mainWallet?.usdcEquivalent]
  );

  const savingsBalanceFormatted = useMemo(
    () => formatTokenAmount(walletBalance?.savingsWallet?.usdcEquivalent ?? '0', 2),
    [walletBalance?.savingsWallet?.usdcEquivalent]
  );

  const wallets = [
    {
      type: 'main',
      title: 'Main Wallet',
      description: 'For daily transactions and group payments',
      balance: mainBalanceFormatted,
      usdcEquivalent: walletBalance?.mainWallet?.usdcEquivalent || '0',
      address: walletBalance?.mainWallet?.address,
      badge: { text: 'Active', variant: 'success' as const },
      icon: <Wallet className="h-5 w-5 text-blue-400" />
    },
    {
      type: 'savings',
      title: 'Savings Wallet',
      description: 'Automated savings with yield opportunities',
      balance: savingsBalanceFormatted,
      usdcEquivalent: walletBalance?.savingsWallet?.usdcEquivalent || '0',
      address: walletBalance?.savingsWallet?.address,
      badge: { text: 'Yield Enabled', variant: 'outline' as const },
      icon: <TrendingUp className="h-5 w-5 text-green-400" />
    }
  ];

  return (
    <div className={className}>
      {/* Total Balance Card */}
      <Card className="border-white/10 mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Total Balance</CardTitle>
              <CardDescription>Combined across all wallets</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBalances(!showBalances)}
            >
              {showBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-12 w-48" />
          ) : (
            <div className="space-y-2">
              <p className="text-4xl font-bold text-slate-50">
                {showBalances ? `$${totalUsdcBalance} USDC` : '••••••'}
              </p>
              <p className="text-lg text-slate-400">
                {showBalances ? `$${formatTokenAmount(totalBalance, 2)} USD` : '••••••'}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-cyan-400">
                  Lisk Sepolia
                </Badge>
                <Badge variant="outline" className="text-green-400">
                  Gasless
                </Badge>
                <Badge variant="outline" className="text-purple-400">
                  Demo Rates
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Individual Wallet Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {wallets.map((wallet) => (
          <Card key={wallet.type} className="border-white/10">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800">
                  {wallet.icon}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">{wallet.title}</CardTitle>
                  <CardDescription>{wallet.description}</CardDescription>
                </div>
                <Badge variant={wallet.badge.variant}>{wallet.badge.text}</Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-3xl font-semibold text-slate-50">
                      {showBalances ? `$${wallet.usdcEquivalent} USDC` : '••••••'}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      {showBalances ? `$${wallet.usdcEquivalent} USD` : '••••••'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                      Wallet Address
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-sm text-cyan-200 break-all flex-1">
                        {wallet.address || '••••••••'}
                      </p>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs flex-shrink-0">
                        Copy
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}