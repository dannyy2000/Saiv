'use client';

import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowDownToLine, ArrowUpRight, PiggyBank, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/providers/auth-context';
import {
  createGroupSavings,
  createPersonalSavings,
  depositToSavings,
  fetchSavings,
  fetchSavingsTransactions,
  withdrawFromSavings,
} from '@/services/api/savings';
import { fetchGroups } from '@/services/api/groups';
import type { Group, SavingsGoal, SavingsTransaction } from '@/types/api';
import { formatTokenAmount } from '@/lib/utils';
import { toast } from 'sonner';

const personalSchema = z.object({
  name: z.string().min(3, 'Name is required'),
  description: z.string().optional(),
  targetAmount: z.string().min(1, 'Enter a target amount'),
  currency: z.string().default('ETH'),
  tokenAddress: z.string().optional(),
  interest: z.number({ invalid_type_error: 'Provide an interest rate' }).optional(),
  minContribution: z.string().optional(),
  lockUntilDate: z.string().optional(),
});

const groupSchema = z.object({
  groupId: z.string().min(1, 'Select a group'),
  name: z.string().min(3, 'Name is required'),
  targetAmount: z.string().min(1, 'Enter a target amount'),
  currency: z.string().default('ETH'),
  tokenAddress: z.string().optional(),
  interest: z.number({ invalid_type_error: 'Provide an interest rate' }).optional(),
});

type PersonalFormValues = z.infer<typeof personalSchema>;
type GroupFormValues = z.infer<typeof groupSchema>;

type SavingsActionPayload = {
  savingsId: string;
  amount: string;
  description?: string;
};

function SavingsCard({
  goal,
  onDeposit,
  onWithdraw,
  transactions,
  isLoadingTransactions,
}: {
  goal: SavingsGoal;
  onDeposit: (payload: SavingsActionPayload) => void;
  onWithdraw: (payload: SavingsActionPayload) => void;
  transactions: SavingsTransaction[];
  isLoadingTransactions: boolean;
}): ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);
  const depositForm = useForm<{ amount: string; description?: string }>({
    defaultValues: { amount: '', description: '' },
  });
  const withdrawForm = useForm<{ amount: string; description?: string }>({
    defaultValues: { amount: '', description: '' },
  });

  const target = Number(goal.targetAmount ?? 0);
  const current = Number(goal.currentAmount ?? 0);
  const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  return (
    <Card className="border-white/10">
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle className="text-lg text-slate-100">{goal.name}</CardTitle>
          <CardDescription>
            {goal.type === 'personal' ? 'Personal goal' : 'Group goal'} · Target {goal.targetAmount ?? '0'} {goal.currency ?? 'ETH'}
          </CardDescription>
        </div>
        <Badge variant={goal.status === 'completed' ? 'success' : 'outline'}>{goal.status ?? 'active'}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>Progress</span>
            <span className="font-mono text-xs text-cyan-200">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800/70">
            <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
          <div>
            <p className="uppercase tracking-wide text-slate-500">Current balance</p>
            <p className="text-sm font-semibold text-cyan-200">{formatTokenAmount(goal.currentAmount ?? '0')} {goal.currency ?? 'ETH'}</p>
          </div>
          <div>
            <p className="uppercase tracking-wide text-slate-500">Target</p>
            <p className="text-sm font-semibold text-slate-200">{goal.targetAmount ?? '-'} {goal.currency ?? 'ETH'}</p>
          </div>
          <div>
            <p className="uppercase tracking-wide text-slate-500">Interest</p>
            <p className="text-sm font-semibold text-slate-200">{goal.interest ? `${goal.interest}%` : 'Gasless boost'}</p>
          </div>
        </div>

        <div className="space-y-3">
          <form
            className="grid gap-2 rounded-xl border border-white/10 bg-slate-900/60 p-4"
            onSubmit={depositForm.handleSubmit((values) => {
              onDeposit({ savingsId: goal._id ?? goal.id ?? '', amount: values.amount, description: values.description });
              depositForm.reset();
            })}
          >
            <Label htmlFor={`deposit-${goal._id}`}>Deposit amount</Label>
            <Input id={`deposit-${goal._id}`} placeholder="0.25" {...depositForm.register('amount', { required: true })} />
            <Textarea placeholder="Optional note" rows={2} {...depositForm.register('description')} />
            <Button type="submit" size="sm" leftIcon={<ArrowUpRight className="h-4 w-4" />}>
              Deposit
            </Button>
          </form>

          <form
            className="grid gap-2 rounded-xl border border-white/10 bg-slate-900/60 p-4"
            onSubmit={withdrawForm.handleSubmit((values) => {
              onWithdraw({ savingsId: goal._id ?? goal.id ?? '', amount: values.amount, description: values.description });
              withdrawForm.reset();
            })}
          >
            <Label htmlFor={`withdraw-${goal._id}`}>Withdraw amount</Label>
            <Input id={`withdraw-${goal._id}`} placeholder="0.10" {...withdrawForm.register('amount', { required: true })} />
            <Textarea placeholder="Optional note" rows={2} {...withdrawForm.register('description')} />
            <Button type="submit" size="sm" variant="secondary" leftIcon={<ArrowDownToLine className="h-4 w-4" />}>
              Withdraw
            </Button>
          </form>
        </div>

        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded((prev) => !prev)}>
            {isExpanded ? 'Hide activity' : 'Show latest transactions'}
          </Button>

          {isExpanded ? (
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
              {isLoadingTransactions ? (
                <Skeleton className="h-20 w-full" />
              ) : transactions.length ? (
                <ul className="space-y-3">
                  {transactions.slice(0, 4).map((tx) => (
                    <li key={tx._id ?? tx.id} className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-medium text-slate-200">{tx.type}</span>
                      <span className="font-mono text-cyan-200">{formatTokenAmount(tx.amount)} {goal.currency ?? 'ETH'}</span>
                      <span>{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : '-'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No transactions yet. Start contributing to populate history.</p>
              )}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SavingsPage(): ReactElement {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'personal' | 'group'>('all');
  const [activeSavingsForHistory, setActiveSavingsForHistory] = useState<string | null>(null);

  const {
    data: savings,
    isLoading: isSavingsLoading,
  } = useQuery<SavingsGoal[]>({
    queryKey: ['savings', filter],
    queryFn: () => fetchSavings(filter),
    enabled: isAuthenticated,
  });

  const { data: groups } = useQuery<Group[]>({
    queryKey: ['groups', 'list-for-savings'],
    queryFn: fetchGroups,
    enabled: isAuthenticated,
  });

  const { data: transactions = [], isLoading: isTransactionsLoading } = useQuery<SavingsTransaction[]>({
    queryKey: ['savings', 'transactions', activeSavingsForHistory],
    queryFn: async () => {
      if (!activeSavingsForHistory) {
        return [];
      }
      const result = await fetchSavingsTransactions(activeSavingsForHistory, { limit: 10 });
      return result.items;
    },
    enabled: isAuthenticated && Boolean(activeSavingsForHistory),
  });

  const personalForm = useForm<PersonalFormValues>({
    resolver: zodResolver(personalSchema),
    defaultValues: {
      name: '',
      description: '',
      targetAmount: '100',
      currency: 'ETH',
      tokenAddress: '',
      interest: 0,
      minContribution: '0.1',
      lockUntilDate: '',
    },
  });

  const groupForm = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      groupId: '',
      name: '',
      targetAmount: '500',
      currency: 'ETH',
      tokenAddress: '',
      interest: 0,
    },
  });

  const depositMutation = useMutation({
    mutationFn: ({ savingsId, amount, description }: SavingsActionPayload) =>
      depositToSavings(savingsId, { amount, description }),
    onSuccess: async (_, variables) => {
      toast.success('Deposit queued through Saiv.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['savings', filter] }),
        queryClient.invalidateQueries({ queryKey: ['savings', 'transactions', variables.savingsId] }),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to deposit.');
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: ({ savingsId, amount, description }: SavingsActionPayload) =>
      withdrawFromSavings(savingsId, { amount, description }),
    onSuccess: async (_, variables) => {
      toast.success('Withdrawal submitted. Saiv handles gas.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['savings', filter] }),
        queryClient.invalidateQueries({ queryKey: ['savings', 'transactions', variables.savingsId] }),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to withdraw.');
    },
  });

  const personalMutation = useMutation({
    mutationFn: createPersonalSavings,
    onSuccess: async (goal) => {
      toast.success(`Created ${goal.name}.`);
      await queryClient.invalidateQueries({ queryKey: ['savings', 'all'] });
      personalForm.reset();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to create personal savings.');
    },
  });

  const groupMutation = useMutation({
    mutationFn: createGroupSavings,
    onSuccess: async (goal) => {
      toast.success(`Created ${goal.name}.`);
      await queryClient.invalidateQueries({ queryKey: ['savings', 'all'] });
      groupForm.reset();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to create group savings.');
    },
  });

  const filteredSavings = useMemo(() => {
    if (!savings) {
      return [];
    }
    if (filter === 'all') {
      return savings;
    }
    return savings.filter((goal) => goal.type === filter);
  }, [filter, savings]);

  const handleDeposit = (payload: SavingsActionPayload) => {
    setActiveSavingsForHistory(payload.savingsId);
    depositMutation.mutate(payload);
  };

  const handleWithdraw = (payload: SavingsActionPayload) => {
    setActiveSavingsForHistory(payload.savingsId);
    withdrawMutation.mutate(payload);
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-5 lg:grid-cols-[1.1fr,0.9fr]">
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PiggyBank className="h-5 w-5 text-cyan-300" /> Active savings plans
            </CardTitle>
            <CardDescription>Track gasless deposits across personal vaults and group pools.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(['all', 'personal', 'group'] as const).map((item) => (
                <Button
                  key={item}
                  variant={filter === item ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(item)}
                >
                  {item === 'all' ? 'All' : item === 'personal' ? 'Personal' : 'Group'}
                </Button>
              ))}
            </div>

            {isSavingsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : filteredSavings.length ? (
              filteredSavings.map((goal) => (
                <SavingsCard
                  key={goal._id ?? goal.id}
                  goal={goal}
                  onDeposit={handleDeposit}
                  onWithdraw={handleWithdraw}
                  transactions={activeSavingsForHistory === (goal._id ?? goal.id ?? '') ? transactions : []}
                  isLoadingTransactions={
                    isTransactionsLoading && activeSavingsForHistory === (goal._id ?? goal.id ?? '')
                  }
                />
              ))
            ) : (
              <p className="text-sm text-slate-400">Create a new savings plan to get started.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-cyan-300" /> Launch a new goal
            </CardTitle>
            <CardDescription>Personal vaulted savings or group-based autosave—with zero gas fees.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <h3 className="text-sm font-semibold text-slate-100">Personal goal</h3>
              <form className="space-y-3" onSubmit={personalForm.handleSubmit((values) => personalMutation.mutate(values))}>
                <Label htmlFor="personal-name">Name</Label>
                <Input id="personal-name" placeholder="Emergency runway" {...personalForm.register('name')} />
                {personalForm.formState.errors.name ? (
                  <p className="text-xs text-rose-400">{personalForm.formState.errors.name.message}</p>
                ) : null}

                <Label htmlFor="personal-target">Target amount</Label>
                <Input id="personal-target" placeholder="500" {...personalForm.register('targetAmount')} />

                <Label htmlFor="personal-currency">Currency</Label>
                <Input id="personal-currency" placeholder="ETH" {...personalForm.register('currency')} />

                <Label htmlFor="personal-token">Token address (optional)</Label>
                <Input id="personal-token" placeholder="0x..." {...personalForm.register('tokenAddress')} />

                <Label htmlFor="personal-min">Minimum contribution</Label>
                <Input id="personal-min" placeholder="0.1" {...personalForm.register('minContribution')} />

                <Button type="submit" leftIcon={<Plus className="h-4 w-4" />} isLoading={personalMutation.isLoading}>
                  Create personal goal
                </Button>
              </form>
            </div>

            <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <h3 className="text-sm font-semibold text-slate-100">Group vault</h3>
              <form className="space-y-3" onSubmit={groupForm.handleSubmit((values) => groupMutation.mutate(values))}>
                <Label htmlFor="group-select">Select group</Label>
                <Controller
                  control={groupForm.control}
                  name="groupId"
                  render={({ field }) => (
                    <select
                      id="group-select"
                      {...field}
                      className="h-11 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="">Select a group</option>
                      {(groups ?? []).map((group) => (
                        <option key={group._id ?? group.id} value={group._id ?? group.id ?? ''}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {groupForm.formState.errors.groupId ? (
                  <p className="text-xs text-rose-400">{groupForm.formState.errors.groupId.message}</p>
                ) : null}

                <Label htmlFor="group-name">Vault name</Label>
                <Input id="group-name" placeholder="Retreat fund" {...groupForm.register('name')} />

                <Label htmlFor="group-target">Target amount</Label>
                <Input id="group-target" placeholder="1000" {...groupForm.register('targetAmount')} />

                <Label htmlFor="group-currency">Currency</Label>
                <Input id="group-currency" placeholder="ETH" {...groupForm.register('currency')} />

                <Button type="submit" leftIcon={<Plus className="h-4 w-4" />} isLoading={groupMutation.isLoading}>
                  Create group goal
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
