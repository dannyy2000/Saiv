'use client';

import type { ReactElement } from 'react';
import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Coins, ShieldCheck, Users, TrendingUp, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AnalyticsChart } from '@/components/dashboard/analytics-chart';
import { ActivityFeed, generateSampleActivities } from '@/components/dashboard/activity-feed';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { useAuth } from '@/providers/auth-context';
import { fetchWalletBalance } from '@/services/api/wallet';
import { fetchGroups } from '@/services/api/groups';
import { fetchSavings } from '@/services/api/savings';
import type { Group, SavingsGoal, WalletBalance } from '@/types/api';
import { formatTokenAmount, truncateAddress } from '@/lib/utils';

export default function DashboardPage(): ReactElement {
  const TOKEN_SYMBOL = 'USDC';
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  const { data: walletBalance } = useQuery<WalletBalance>({
    queryKey: ['wallet', 'balance'],
    queryFn: fetchWalletBalance,
    enabled: isAuthenticated,
  });

  const { data: groups } = useQuery<Group[]>({
    queryKey: ['groups', 'list'],
    queryFn: fetchGroups,
    enabled: isAuthenticated,
  });

  const { data: savings } = useQuery<SavingsGoal[]>({
    queryKey: ['savings', 'all'],
    queryFn: () => fetchSavings('all'),
    enabled: isAuthenticated,
  });

  const mainBalanceValue = Number(
    walletBalance?.mainWallet?.usdcEquivalent ?? 0
  ) || 0;
  const savingsBalanceValue = Number(
    walletBalance?.savingsWallet?.usdcEquivalent ?? 0
  ) || 0;

  const mainBalance = formatTokenAmount(mainBalanceValue, 2);
  const savingsBalance = formatTokenAmount(savingsBalanceValue, 2);

  // Sample data for analytics (replace with real data from API)
  const activityFeed = useMemo(() => {
    const items = [] as ReturnType<typeof generateSampleActivities>;

    (savings ?? []).forEach((goal) => {
      const timestamp = goal.updatedAt ?? goal.createdAt ?? new Date().toISOString();
      items.push({
        id: `savings-${goal._id ?? goal.id ?? goal.name}`,
        type: 'goal_create',
        title: goal.name,
        description: `Target ${goal.targetAmount ?? '-'} ${goal.currency ?? TOKEN_SYMBOL} · Current ${goal.currentAmount ?? '0'}`,
        amount: goal.currentAmount ? `${formatTokenAmount(Number(goal.currentAmount ?? 0), 2)} ${goal.currency ?? TOKEN_SYMBOL}` : undefined,
        timestamp,
        status: goal.status === 'completed' ? 'completed' : 'pending',
      });
    });

    (groups ?? []).forEach((group) => {
      const timestamp = group.updatedAt ?? group.createdAt ?? new Date().toISOString();
      items.push({
        id: `group-${group._id ?? group.id ?? group.name}`,
        type: 'group_create',
        title: group.name,
        description: group.description ?? 'Savings coordination pod',
        timestamp,
        status: 'completed',
      });
    });

    return items
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }, [groups, savings]);

  const portfolioHistory = useMemo(() => [
    ...(savings ?? []).map((goal) => {
      const value = Number(goal.currentAmount ?? 0);
      const date = goal.updatedAt ?? goal.createdAt ?? new Date().toISOString();
      return {
        label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value,
        date,
      };
    }),
    {
      label: 'Current total',
      value: mainBalanceValue + savingsBalanceValue,
      date: new Date().toISOString(),
    },
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [savings, mainBalanceValue, savingsBalanceValue]);

  const savingsDistribution = useMemo(() => {
    if (!savings || savings.length === 0) {
      return [];
    }

    return savings
      .map((goal) => {
        const value = Number(goal.currentAmount ?? 0);
        const date = goal.updatedAt ?? goal.createdAt ?? new Date().toISOString();
        return {
          label: goal.name,
          value,
          date,
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [savings]);

  const totalBalance = mainBalanceValue + savingsBalanceValue;
  const totalGroups = groups?.length ?? 0;
  const totalSavingsGoals = savings?.length ?? 0;
  const completedGoals = (savings ?? []).filter((goal) => goal.status === 'completed').length;
  const highlightedGoals = (savings ?? []).slice(0, 3);
  const highlightedGroups = (groups ?? []).slice(0, 3);

  const scrollToAnalytics = useCallback(() => {
    const section = document.getElementById('analytics-section');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-50">Welcome back!</h1>
          <p className="text-slate-400 mt-1">
            {user?.profile?.name || user?.email || 'User'} • {user?.registrationType?.toUpperCase() || 'EMAIL'} Account
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-cyan-400" />
          <Badge variant="outline" className="border-cyan-400/40 text-cyan-200">
            All systems operational
          </Badge>
        </div>
      </div>

      {/* Portfolio Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-white/10 bg-slate-900/40">
          <CardHeader className="pb-2">
            <CardDescription>Total balance</CardDescription>
            <CardTitle className="text-3xl font-semibold text-slate-50">
              {formatTokenAmount(totalBalance, 2)} {TOKEN_SYMBOL}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-slate-400">
            Combined value across main and savings wallets
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-900/40">
          <CardHeader className="pb-2">
            <CardDescription>Main wallet</CardDescription>
            <CardTitle className="text-2xl font-semibold text-slate-50">
              {formatTokenAmount(mainBalanceValue, 2)} {TOKEN_SYMBOL}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-slate-400">
            Primary smart account for contributions
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-900/40">
          <CardHeader className="pb-2">
            <CardDescription>Savings wallet</CardDescription>
            <CardTitle className="text-2xl font-semibold text-slate-50">
              {formatTokenAmount(savingsBalanceValue, 2)} {TOKEN_SYMBOL}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-slate-400">
            Dedicated, gasless savings balance
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-900/40">
          <CardHeader className="pb-2">
            <CardDescription>Savings goals</CardDescription>
            <CardTitle className="text-2xl font-semibold text-slate-50">
              {totalSavingsGoals}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-slate-400">
            {completedGoals} completed · {totalGroups} active groups
          </CardContent>
        </Card>
      </div>

      {/* Analytics and Quick Actions */}
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-3">
          <QuickActions
            onAddFunds={() => router.push('/wallet?view=transfer')}
            onWithdraw={() => router.push('/wallet?view=withdraw')}
            onCreateGroup={() => router.push('/groups?intent=create')}
            onCreateGoal={() => router.push('/wallet?view=savings')}
            onViewAnalytics={scrollToAnalytics}
            onQuickSave={() => router.push('/wallet?view=transfer')}
          />

          {/* Analytics Charts */}
          <div id="analytics-section" className="grid gap-4 md:grid-cols-2">
            <AnalyticsChart
              title="Portfolio Growth"
              description="Total balance across main and savings wallets"
              data={portfolioHistory}
              valueSuffix={` ${TOKEN_SYMBOL}`}
            />
            <AnalyticsChart
              title="Savings Balances"
              description="Tracked USDC across your active goals"
              data={savingsDistribution}
              valueSuffix={` ${TOKEN_SYMBOL}`}
            />
          </div>

          {/* Activity Feed */}
          <ActivityFeed activities={activityFeed} />
        </div>

        {/* Insights */}
        <div className="space-y-6 xl:col-span-2">
          {/* Account Info Card */}
          <Card className="border-white/10 bg-slate-900/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-400" />
                Account Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Registration</span>
                  <span className="text-slate-200 font-medium">
                    {user?.registrationType?.toUpperCase() || 'EMAIL'}
                  </span>
                </div>
                <div className="flex justify-between text-sm gap-3">
                  <span className="text-slate-400 flex-shrink-0">Main Wallet</span>
                  <span className="text-right">
                    <span className="block font-semibold text-slate-200">
                      {mainBalance} {TOKEN_SYMBOL}
                    </span>
                    <span className="block font-mono text-xs text-slate-400 break-all">
                      {walletBalance?.mainWallet?.address || '-'}
                    </span>
                  </span>
                </div>
                <div className="flex justify-between text-sm gap-3">
                  <span className="text-slate-400 flex-shrink-0">Savings Wallet</span>
                  <span className="text-right">
                    <span className="block font-semibold text-slate-200">
                      {savingsBalance} {TOKEN_SYMBOL}
                    </span>
                    <span className="block font-mono text-xs text-slate-400 break-all">
                      {walletBalance?.savingsWallet?.address || '-'}
                    </span>
                  </span>
                </div>
              </div>
              <div className="pt-3 border-t border-white/10">
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
                  <span>Gasless transactions active</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Goals */}
          <Card className="border-white/10 bg-slate-900/40">
            <CardHeader>
              <CardTitle className="text-lg">Latest savings goals</CardTitle>
              <CardDescription>Most recent objectives you&apos;re tracking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {highlightedGoals.length === 0 ? (
                <p className="text-sm text-slate-400">Create your first goal to start building momentum.</p>
              ) : (
                highlightedGoals.map((goal) => {
                  const current = Number(goal.currentAmount ?? 0);
                  const target = Number(goal.targetAmount ?? 0) || 1;
                  const progress = Math.min(100, (current / target) * 100);
                  return (
                    <div key={goal._id ?? goal.id ?? goal.name} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{goal.name}</p>
                          <p className="text-xs text-slate-400">
                            {formatTokenAmount(current, 2)} / {formatTokenAmount(target, 2)} {goal.currency ?? TOKEN_SYMBOL}
                          </p>
                        </div>
                        <Badge variant={goal.status === 'completed' ? 'default' : 'outline'} className="text-xs">
                          {goal.status === 'completed' ? 'Complete' : `${progress.toFixed(0)}%`}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Recent Groups */}
          <Card className="border-white/10 bg-slate-900/40">
            <CardHeader>
              <CardTitle className="text-lg">Active groups</CardTitle>
              <CardDescription>Your latest coordination pods</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {highlightedGroups.length === 0 ? (
                <p className="text-sm text-slate-400">Join or create a group to coordinate with your circle.</p>
              ) : (
                highlightedGroups.map((group) => (
                  <div key={group._id ?? group.id ?? group.name} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                    <p className="text-sm font-semibold text-slate-100">{group.name}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {group.description || 'Collaborative savings pod'}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>{group.members?.length ?? 0} members</span>
                      <span>Min {group.poolSettings?.minContribution ?? '—'} {group.poolSettings?.currency ?? TOKEN_SYMBOL}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Information Cards */}
      <Card className="border-white/10 bg-slate-900/40">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-cyan-400" />
            Platform Advantages
          </CardTitle>
          <CardDescription className="text-sm">
            Why Saiv delivers the best gasless savings experience
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-200">Zero Friction Onboarding</h3>
              <p className="text-sm text-slate-400 mt-1">
                Email registration creates instant wallets without seed phrases or gas fees
              </p>
            </div>
          </div>
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Coins className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-200">Backend Gas Sponsorship</h3>
              <p className="text-sm text-slate-400 mt-1">
                Every transaction is sponsored by Saiv, eliminating all user gas costs
              </p>
            </div>
          </div>
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-200">Smart Group Coordination</h3>
              <p className="text-sm text-slate-400 mt-1">
                Transparent, automated savings groups with built-in contribution tracking
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
