'use client';

import type { ReactElement } from 'react';
import { ArrowDownLeft, ArrowUpRight, Users, Target, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ActivityItem {
  id: string;
  type: 'deposit' | 'withdrawal' | 'group_join' | 'group_create' | 'goal_complete' | 'goal_create';
  title: string;
  description: string;
  amount?: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  maxItems?: number;
}

const activityConfig = {
  deposit: {
    icon: ArrowDownLeft,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
  },
  withdrawal: {
    icon: ArrowUpRight,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
  },
  group_join: {
    icon: Users,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  group_create: {
    icon: Users,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
  },
  goal_complete: {
    icon: Target,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
  },
  goal_create: {
    icon: Target,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
  },
};

const statusConfig = {
  completed: { color: 'text-green-400', label: 'Completed' },
  pending: { color: 'text-yellow-400', label: 'Pending' },
  failed: { color: 'text-red-400', label: 'Failed' },
};

export function ActivityFeed({ activities, maxItems = 10 }: ActivityFeedProps): ReactElement {
  const displayActivities = activities.slice(0, maxItems);

  const formatTimeAgo = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <Card className="border-white/10 bg-slate-900/40">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-cyan-400" />
          Recent Activity
        </CardTitle>
        <CardDescription>
          Your latest transactions and platform interactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {displayActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-12 w-12 text-slate-600 mb-4" />
            <p className="text-sm text-slate-400">No recent activity</p>
            <p className="text-xs text-slate-500 mt-1">
              Your transactions and interactions will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayActivities.map((activity) => {
              const config = activityConfig[activity.type];
              const status = statusConfig[activity.status];
              const Icon = config.icon;

              return (
                <div
                  key={activity.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors hover:bg-slate-800/30 ${config.bgColor} ${config.borderColor}`}
                >
                  <div className={`flex items-center justify-center rounded-full p-2 ${config.bgColor}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-200">
                          {activity.title}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {activity.description}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {activity.amount && (
                          <p className="text-sm font-mono text-slate-300">
                            {activity.amount}
                          </p>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-xs ${status.color} border-current`}
                        >
                          {status.label}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-slate-500">
                        {formatTimeAgo(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Sample data generator for testing
export function generateSampleActivities(): ActivityItem[] {
  const now = new Date();
  return [
    {
      id: '1',
      type: 'deposit',
      title: 'Deposit to Savings',
      description: 'Added funds to your savings wallet',
      amount: '+500 USDC',
      timestamp: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
      status: 'completed',
    },
    {
      id: '2',
      type: 'group_join',
      title: 'Joined Savings Group',
      description: 'Joined "Family Emergency Fund" group',
      timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      status: 'completed',
    },
    {
      id: '3',
      type: 'goal_create',
      title: 'Created New Goal',
      description: 'Set up "Vacation Fund" savings goal',
      amount: 'Target: 2,000 USDC',
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
    },
    {
      id: '4',
      type: 'withdrawal',
      title: 'Withdrawal Request',
      description: 'Requested withdrawal from emergency fund',
      amount: '-150 USDC',
      timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
    },
  ];
}
