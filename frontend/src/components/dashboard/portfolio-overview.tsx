'use client';

import type { ReactElement } from 'react';
import { Wallet, PiggyBank, TrendingUp, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface PortfolioData {
  totalBalance: number;
  mainWalletBalance: number;
  savingsBalance: number;
  monthlyGrowth?: number;
  savingsGoals: Array<{
    name: string;
    current: number;
    target: number;
    deadline?: string;
  }>;
  recentGrowth?: number;
}

interface PortfolioOverviewProps {
  data: PortfolioData;
}

export function PortfolioOverview({ data }: PortfolioOverviewProps): ReactElement {
  const TOKEN_SYMBOL = 'USDC';
  const savingsPercentage = data.totalBalance > 0
    ? (data.savingsBalance / data.totalBalance) * 100
    : 0;

  const formatCurrency = (amount: number): string => {
    return `${new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)} ${TOKEN_SYMBOL}`;
  };

  const formatPercentage = (value?: number): string => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return '0.00%';
    }
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Portfolio Value */}
      <Card className="border-white/10 bg-slate-900/40 md:col-span-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-400">
              Total Portfolio Value
            </CardTitle>
            <DollarSign className="h-4 w-4 text-cyan-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-3xl font-bold text-slate-50">
              {formatCurrency(data.totalBalance)}
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={(data.monthlyGrowth ?? 0) >= 0 ? "default" : "danger"}
                className="text-xs"
              >
                <TrendingUp className="h-3 w-3 mr-1" />
                {formatPercentage(data.monthlyGrowth)} this month
              </Badge>
            </div>

            {/* Balance Distribution */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-blue-400" />
                  <span className="text-xs text-slate-400">Main Wallet</span>
                </div>
                <div className="text-lg font-semibold text-slate-200">
                  {formatCurrency(data.mainWalletBalance)}
                </div>
                <div className="text-xs text-slate-500">
                  {((data.mainWalletBalance / data.totalBalance) * 100).toFixed(1)}% of total
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-green-400" />
                  <span className="text-xs text-slate-400">Savings</span>
                </div>
                <div className="text-lg font-semibold text-slate-200">
                  {formatCurrency(data.savingsBalance)}
                </div>
                <div className="text-xs text-slate-500">
                  {savingsPercentage.toFixed(1)}% of total
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Savings Allocation */}
      <Card className="border-white/10 bg-slate-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">
            Savings Allocation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-2xl font-bold text-slate-50">
              {savingsPercentage.toFixed(1)}%
            </div>
            <Progress
              value={savingsPercentage}
              className="h-2"
            />
            <div className="text-xs text-slate-500">
              {savingsPercentage >= 50 ? 'Great savings habit!' : 'Consider saving more'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Growth */}
      <Card className="border-white/10 bg-slate-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">
            Monthly Growth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className={`text-2xl font-bold ${(data.recentGrowth ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatPercentage(data.recentGrowth)}
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className={`h-4 w-4 ${(data.recentGrowth ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`} />
              <span className="text-xs text-slate-500">
                vs last month
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Goals Overview */}
      <Card className="border-white/10 bg-slate-900/40 md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-lg">Active Savings Goals</CardTitle>
          <CardDescription>
            Track progress towards your financial targets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.savingsGoals.length === 0 ? (
            <div className="text-center py-8">
              <PiggyBank className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-sm text-slate-400">No active savings goals</p>
              <p className="text-xs text-slate-500 mt-1">
                Create your first goal to start tracking progress
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.savingsGoals.map((goal, index) => {
                const target = goal.target > 0 ? goal.target : 1;
                const progress = (goal.current / target) * 100;
                const isComplete = progress >= 100;

                return (
                  <div
                    key={index}
                    className="p-4 rounded-lg border border-white/10 bg-slate-800/50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-slate-200 text-sm">
                        {goal.name}
                      </h4>
                      {isComplete && (
                        <Badge variant="default" className="text-xs">
                          Complete
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">
                          {formatCurrency(goal.current)}
                        </span>
                        <span className="text-slate-400">
                          {formatCurrency(goal.target)}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(progress, 100)}
                        className="h-2"
                      />
                      <div className="text-xs text-slate-500">
                        {progress.toFixed(1)}% complete
                        {goal.deadline && (
                          <span className="ml-2">• Due {goal.deadline}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
