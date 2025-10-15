'use client';

import type { ReactElement, ReactNode } from 'react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Coins, ShieldCheck, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/providers/auth-context';
import { fetchGroups } from '@/services/api/groups';
import { fetchSavings } from '@/services/api/savings';
import { fetchWalletBalance } from '@/services/api/wallet';
import type { Group, SavingsGoal, WalletBalance } from '@/types/api';
import { formatTokenAmount, truncateAddress } from '@/lib/utils';

function StatCard({
  title,
  value,
  description,
  icon,
  loading,
}: {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
  loading?: boolean;
}): ReactElement {
  return (
    <Card className="overflow-hidden border-white/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardDescription>{title}</CardDescription>
          {loading ? <Skeleton className="h-6 w-24" /> : <CardTitle className="text-2xl font-semibold text-slate-50">{value}</CardTitle>}
        </div>
        <span className="rounded-xl border border-cyan-400/30 bg-cyan-500/15 p-3 text-cyan-200">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-slate-400">{description}</p>
      </CardContent>
    </Card>
  );
}

function highlightSavingsProgress(savings: SavingsGoal[]): Array<{ name: string; progress: number; target?: string }> {
  return savings.slice(0, 3).map((goal) => {
    const target = Number(goal.targetAmount ?? 0);
    const current = Number(goal.currentAmount ?? 0);
    const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    return {
      name: goal.name,
      progress,
      target: goal.targetAmount,
    };
  });
}

export default function DashboardPage(): ReactElement {
  const { isAuthenticated, user } = useAuth();

  const {
    data: walletBalance,
    isLoading: isWalletLoading,
  } = useQuery<WalletBalance>({
    queryKey: ['wallet', 'balance'],
    queryFn: fetchWalletBalance,
    enabled: isAuthenticated,
  });

  const {
    data: groups,
    isLoading: isGroupsLoading,
  } = useQuery<Group[]>({
    queryKey: ['groups', 'list'],
    queryFn: fetchGroups,
    enabled: isAuthenticated,
  });

  const {
    data: savings,
    isLoading: isSavingsLoading,
  } = useQuery<SavingsGoal[]>({
    queryKey: ['savings', 'list'],
    queryFn: () => fetchSavings('all'),
    enabled: isAuthenticated,
  });

  const savingsHighlights = useMemo(() => highlightSavingsProgress(savings ?? []), [savings]);
  const mainBalance = formatTokenAmount(walletBalance?.mainWallet?.balance ?? '0', 4);
  const savingsBalance = formatTokenAmount(walletBalance?.savingsWallet?.balance ?? '0', 4);

  return (
    <div className="space-y-8">
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Main wallet balance"
          value={`${mainBalance} ETH`}
          description={walletBalance?.mainWallet?.address ? `Address ${truncateAddress(walletBalance.mainWallet.address)}` : 'Generated during onboarding'}
          icon={<Coins className="h-5 w-5" />}
          loading={isWalletLoading}
        />
        <StatCard
          title="Savings wallet"
          value={`${savingsBalance} ETH`}
          description={walletBalance?.savingsWallet?.address ? `Address ${truncateAddress(walletBalance.savingsWallet.address)}` : 'Gasless auto-savings wallet'}
          icon={<ShieldCheck className="h-5 w-5" />}
          loading={isWalletLoading}
        />
        <StatCard
          title="Active groups"
          value={`${groups?.length ?? 0}`}
          description="Pods you have created or joined"
          icon={<Users className="h-5 w-5" />}
          loading={isGroupsLoading}
        />
        <StatCard
          title="Savings goals"
          value={`${savings?.length ?? 0}`}
          description="Personal and collaborative goals"
          icon={<Activity className="h-5 w-5" />}
          loading={isSavingsLoading}
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card className="border-white/10">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Gasless account snapshot</CardTitle>
              <CardDescription className="text-sm">Every transaction runs through Saiv&apos;s backend so you never worry about gas.</CardDescription>
            </div>
            <Badge variant="success">Live</Badge>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-slate-300">
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Registration type</p>
              <p className="text-base font-semibold text-slate-100">{user?.registrationType?.toUpperCase() ?? 'EMAIL'}</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              <li className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Main wallet</p>
                <p className="font-mono text-sm text-cyan-200">{truncateAddress(walletBalance?.mainWallet?.address)}</p>
              </li>
              <li className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Savings wallet</p>
                <p className="font-mono text-sm text-cyan-200">{truncateAddress(walletBalance?.savingsWallet?.address)}</p>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">Savings progress</CardTitle>
            <CardDescription className="text-sm">The first three goals with the greatest traction.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSavingsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-5 w-40" />
              </div>
            ) : savingsHighlights.length ? (
              savingsHighlights.map((goal) => (
                <div key={goal.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span className="font-medium text-slate-200">{goal.name}</span>
                    <span className="font-mono text-xs text-cyan-200">{goal.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800/70">
                    <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${goal.progress}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">Set a goal to start tracking your progress.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">Why gasless matters</CardTitle>
            <CardDescription className="text-sm">
              Users onboard with an email or wallet, and Saiv handles every blockchain interaction on their behalf.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-300">
              <p className="mb-2 text-sm font-semibold text-slate-100">No wallet anxiety</p>
              <p>New savers join with an email address and instantly receive main + savings wallets.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-300">
              <p className="mb-2 text-sm font-semibold text-slate-100">Backend covers gas</p>
              <p>Every contribution, withdrawal, and group deployment is paid for by the Saiv operator wallet.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-300">
              <p className="mb-2 text-sm font-semibold text-slate-100">Unified controls</p>
              <p>Trigger operations from this dashboard while the backend orchestrates secure smart contract calls.</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
