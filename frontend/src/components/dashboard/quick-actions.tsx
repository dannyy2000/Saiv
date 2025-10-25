'use client';

import type { ReactElement } from 'react';
import { Plus, ArrowUpRight, Users, Target, TrendingUp, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  action: () => void;
  disabled?: boolean;
}

interface QuickActionsProps {
  onCreateGroup?: () => void;
  onAddFunds?: () => void;
  onWithdraw?: () => void;
  onCreateGoal?: () => void;
  onViewAnalytics?: () => void;
  onQuickSave?: () => void;
}

export function QuickActions({
  onCreateGroup,
  onAddFunds,
  onWithdraw,
  onCreateGoal,
  onViewAnalytics,
  onQuickSave,
}: QuickActionsProps): ReactElement {
  const actions: QuickAction[] = [
    {
      id: 'add-funds',
      title: 'Add Funds',
      description: 'Deposit to your savings wallet',
      icon: Plus,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10 hover:bg-green-500/20',
      action: onAddFunds || (() => console.log('Add funds')),
    },
    {
      id: 'withdraw',
      title: 'Withdraw',
      description: 'Transfer funds to main wallet',
      icon: ArrowUpRight,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10 hover:bg-orange-500/20',
      action: onWithdraw || (() => console.log('Withdraw')),
    },
    {
      id: 'create-group',
      title: 'Create Group',
      description: 'Start a new savings group',
      icon: Users,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10 hover:bg-blue-500/20',
      action: onCreateGroup || (() => console.log('Create group')),
    },
    {
      id: 'create-goal',
      title: 'New Goal',
      description: 'Set a savings target',
      icon: Target,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10 hover:bg-purple-500/20',
      action: onCreateGoal || (() => console.log('Create goal')),
    },
    {
      id: 'analytics',
      title: 'Analytics',
      description: 'View detailed insights',
      icon: TrendingUp,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10 hover:bg-cyan-500/20',
      action: onViewAnalytics || (() => console.log('View analytics')),
    },
    {
      id: 'quick-save',
      title: 'Quick Save',
      description: 'Auto-save from main wallet',
      icon: Zap,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10 hover:bg-yellow-500/20',
      action: onQuickSave || (() => console.log('Quick save')),
    },
  ];

  return (
    <Card className="border-white/10 bg-slate-900/40">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5 text-cyan-400" />
          Quick Actions
        </CardTitle>
        <CardDescription>
          Common tasks you can perform right now
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.id}
                variant="ghost"
                className={`h-auto p-4 flex flex-col items-start gap-2 border border-white/10 transition-all duration-200 ${action.bgColor}`}
                onClick={action.action}
                disabled={action.disabled}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className={`flex items-center justify-center rounded-lg p-2 ${action.bgColor}`}>
                    <Icon className={`h-4 w-4 ${action.color}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-slate-200 text-sm">
                      {action.title}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-400 text-left w-full">
                  {action.description}
                </p>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}