'use client';

import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Resolver } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ChevronDown, ChevronUp, PlusCircle, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/providers/auth-context';
import {
  completePaymentWindow,
  createGroup,
  createPaymentWindow,
  fetchGroup,
  fetchGroupMembers,
  fetchGroups,
  fetchPaymentWindows,
  joinGroup,
  leaveGroup,
} from '@/services/api/groups';
import type { Group, GroupMember, PaymentWindow } from '@/types/api';
import { formatTokenAmount } from '@/lib/utils';
import { toast } from 'sonner';

const createGroupSchema = z.object({
  name: z.string().min(3, 'Group name must be at least 3 characters'),
  description: z.string().optional(),
  paymentWindowDuration: z.number().min(1, 'Payment window must be at least 1 day'),
  minContribution: z.string().optional(),
  maxMembers: z.number().min(2, 'Need at least 2 members').max(100, 'Keep pods manageable'),
  currency: z.string().default('ETH'),
});

type CreateGroupFormValues = z.infer<typeof createGroupSchema>;

export default function GroupsPage(): ReactElement {
  const { isAuthenticated, user } = useAuth();
  const currentUserId = user?._id ?? user?.id ?? '';
  const queryClient = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const groupForm = useForm<CreateGroupFormValues>({
  // zodResolver types may conflict with the zod version bundled with the
  // resolver package. Cast the resolver function through `unknown` to avoid
  // overload incompatibilities (avoid `any` to satisfy linting), then assert
  // the overall Resolver type for useForm.
  resolver: (zodResolver as unknown as (...args: unknown[]) => unknown)(createGroupSchema) as Resolver<CreateGroupFormValues>,
    defaultValues: {
      name: '',
      description: '',
      paymentWindowDuration: 30,
      minContribution: '0.1',
      maxMembers: 12,
      currency: 'ETH',
    },
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
    data: groupDetails,
    isLoading: isGroupDetailsLoading,
  } = useQuery<Group | null>({
    queryKey: ['groups', 'detail', selectedGroupId],
    queryFn: () => (selectedGroupId ? fetchGroup(selectedGroupId) : Promise.resolve(null)),
    enabled: isAuthenticated && Boolean(selectedGroupId),
  });

  const { data: members } = useQuery<GroupMember[]>({
    queryKey: ['groups', 'members', selectedGroupId],
    queryFn: () => (selectedGroupId ? fetchGroupMembers(selectedGroupId) : Promise.resolve([])),
    enabled: isAuthenticated && Boolean(selectedGroupId),
  });

  const { data: paymentWindows } = useQuery<PaymentWindow[]>({
    queryKey: ['groups', 'windows', selectedGroupId],
    queryFn: () => (selectedGroupId ? fetchPaymentWindows(selectedGroupId) : Promise.resolve([])),
    enabled: isAuthenticated && Boolean(selectedGroupId),
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateGroupFormValues) => {
      const payload = {
        name: values.name,
        description: values.description,
        paymentWindowDuration: values.paymentWindowDuration * 24 * 60 * 60,
        poolSettings: {
          minContribution: values.minContribution,
          maxMembers: values.maxMembers,
          currency: values.currency,
        },
      };
      return createGroup(payload);
    },
    onSuccess: async (group) => {
      toast.success(`Created ${group.name}.`);
      await queryClient.invalidateQueries({ queryKey: ['groups', 'list'] });
      groupForm.reset();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to create group.');
    },
  });

  const joinMutation = useMutation({
    mutationFn: joinGroup,
    onSuccess: async () => {
      toast.success('Joined group successfully.');
      await queryClient.invalidateQueries({ queryKey: ['groups', 'list'] });
      if (selectedGroupId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['groups', 'detail', selectedGroupId] }),
          queryClient.invalidateQueries({ queryKey: ['groups', 'members', selectedGroupId] }),
        ]);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to join group.');
    },
  });

  const leaveMutation = useMutation({
    mutationFn: leaveGroup,
    onSuccess: async () => {
      toast.success('You left the group.');
      await queryClient.invalidateQueries({ queryKey: ['groups', 'list'] });
      if (selectedGroupId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['groups', 'detail', selectedGroupId] }),
          queryClient.invalidateQueries({ queryKey: ['groups', 'members', selectedGroupId] }),
        ]);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to leave group.');
    },
  });

  const paymentWindowMutation = useMutation({
    mutationFn: (groupId: string) => createPaymentWindow(groupId),
    onSuccess: async (_, groupId) => {
      toast.success('Created payment window.');
      await queryClient.invalidateQueries({ queryKey: ['groups', 'windows', groupId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to create window.');
    },
  });

  const completeWindowMutation = useMutation({
    mutationFn: ({ groupId, windowNumber }: { groupId: string; windowNumber: number }) =>
      completePaymentWindow(groupId, windowNumber),
    onSuccess: async (_, variables) => {
      toast.success('Payment window marked complete.');
      await queryClient.invalidateQueries({ queryKey: ['groups', 'windows', variables.groupId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to complete window.');
    },
  });

  const selectedGroup = selectedGroupId ? groupDetails : null;
  const isAdmin = selectedGroup?.members?.some((member) => {
    const memberId = member.user?._id ?? member.userId ?? (member.user as { id?: string })?.id;
    return memberId === currentUserId && member.role === 'admin';
  });

  const onCreateGroup = (values: CreateGroupFormValues) => {
    createMutation.mutate(values);
  };

  const onJoinOrLeave = (groupId: string, alreadyMember: boolean) => {
    if (alreadyMember) {
      leaveMutation.mutate(groupId);
    } else {
      joinMutation.mutate(groupId);
    }
    setSelectedGroupId(groupId);
  };

  const paymentWindowSummary = useMemo(() => {
    return (paymentWindows ?? []).map((window) => ({
      windowNumber: window.windowNumber ?? 0,
      status: window.status ?? 'pending',
      totalContributions: formatTokenAmount(window.totalContributions ?? '0'),
      timeRange: window.startDate
        ? `${new Date(window.startDate).toLocaleDateString()} → ${window.endDate ? new Date(window.endDate).toLocaleDateString() : 'TBD'}`
        : 'Flexible schedule',
    }));
  }, [paymentWindows]);

  return (
    <div className="space-y-8">
      <section className="grid gap-5 md:grid-cols-[1fr,0.8fr]">
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-cyan-300" /> Active pods
            </CardTitle>
            <CardDescription>Groups you can join or manage—gasless deployments handled by Saiv.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isGroupsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : groups?.length ? (
              groups.map((group) => {
                const memberCount = group.members?.length ?? 0;
                const minContribution = group.poolSettings?.minContribution ?? '0';
                const alreadyMember = Boolean(
                  group.members?.some((member) => {
                    const memberId = member.user?._id ?? member.userId ?? (member.user as { id?: string })?.id;
                    return memberId === currentUserId;
                  }),
                );
                const active = selectedGroupId === (group._id ?? group.id ?? '');

                return (
                  <div
                    key={group._id ?? group.id}
                    className={`rounded-2xl border border-white/10 bg-slate-900/50 p-5 transition ${
                      active ? 'border-cyan-400/50 shadow-cyan-500/20' : 'hover:border-cyan-400/30'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-100">{group.name}</h3>
                        <p className="text-sm text-slate-400">{group.description ?? 'Coordinated savings pod.'}</p>
                      </div>
                      <Badge variant={alreadyMember ? 'success' : 'outline'}>
                        {memberCount} members · min {minContribution} {group.poolSettings?.currency ?? 'ETH'}
                      </Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onJoinOrLeave(group._id ?? group.id ?? '', alreadyMember)}
                        isLoading={joinMutation.isPending || leaveMutation.isPending}
                      >
                        {alreadyMember ? 'Leave group' : 'Join group'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setSelectedGroupId((prev) => (prev === (group._id ?? group.id ?? '') ? null : group._id ?? group.id ?? ''))
                        }
                        leftIcon={selectedGroupId === (group._id ?? group.id ?? '') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      >
                        {active ? 'Hide details' : 'View details'}
                      </Button>
                    </div>
                    {active ? (
                      <div className="mt-4 space-y-4 rounded-xl border border-white/10 bg-slate-950/60 p-4">
                        {isGroupDetailsLoading ? (
                          <Skeleton className="h-16 w-full" />
                        ) : (
                          <>
                            <p className="text-sm text-slate-300">
                              Payment window every
                              <span className="mx-1 font-semibold text-cyan-200">
                                {(group.paymentWindowDuration ?? 0) / (24 * 60 * 60) || 0} days
                              </span>
                              with min contribution of
                              <span className="mx-1 font-semibold text-cyan-200">{minContribution}</span>
                              {group.poolSettings?.currency ?? 'ETH'}.
                            </p>
                            <div className="space-y-2 text-sm text-slate-300">
                              <p className="text-xs uppercase tracking-wide text-slate-500">Members</p>
                              <div className="flex flex-wrap gap-2">
                                {(members ?? []).map((member) => (
                                  <Badge key={member.userId ?? member.user?._id} variant={member.role === 'admin' ? 'success' : 'outline'}>
                                    {member.user?.profile?.name ?? member.user?.email ?? member.userId}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-3 text-sm text-slate-300">
                              <p className="text-xs uppercase tracking-wide text-slate-500">Payment windows</p>
                              {paymentWindowSummary.length ? (
                                paymentWindowSummary.map((window) => (
                                  <div
                                    key={window.windowNumber}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3"
                                  >
                                    <div>
                                      <p className="text-sm font-semibold text-slate-100">Window {window.windowNumber}</p>
                                      <p className="text-xs text-slate-400">{window.timeRange}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <Badge variant={window.status === 'completed' ? 'success' : 'outline'}>{window.status}</Badge>
                                      <span className="text-xs text-cyan-200">{window.totalContributions} ETH</span>
                                      {isAdmin && window.status !== 'completed' ? (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            completeWindowMutation.mutate({
                                              groupId: group._id ?? group.id ?? '',
                                              windowNumber: window.windowNumber,
                                            })
                                          }
                                          isLoading={completeWindowMutation.isPending}
                                        >
                                          Mark complete
                                        </Button>
                                      ) : null}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-slate-500">No windows yet. Create one to start scheduling payouts.</p>
                              )}
                              {isAdmin ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => paymentWindowMutation.mutate(group._id ?? group.id ?? '')}
                                  isLoading={paymentWindowMutation.isPending}
                                >
                                  Create payment window
                                </Button>
                              ) : null}
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-400">Create the first group to start coordinating contributions.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PlusCircle className="h-5 w-5 text-cyan-300" /> Spin up a new pod
            </CardTitle>
            <CardDescription>Deploy a new savings group in a single action—gasless for every member.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={groupForm.handleSubmit(onCreateGroup)}>
              <div className="space-y-2">
                <Label htmlFor="group-name">Group name</Label>
                <Input id="group-name" placeholder="Pathfinder Collective" {...groupForm.register('name')} />
                {groupForm.formState.errors.name ? <p className="text-xs text-rose-400">{groupForm.formState.errors.name.message}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="group-description">Mission</Label>
                <Input id="group-description" placeholder="Weekly contributions for shared goals" {...groupForm.register('description')} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="payment-window">Payment window duration (days)</Label>
                  <Input id="payment-window" type="number" min={1} {...groupForm.register('paymentWindowDuration', { valueAsNumber: true })} />
                  {groupForm.formState.errors.paymentWindowDuration ? (
                    <p className="text-xs text-rose-400">{groupForm.formState.errors.paymentWindowDuration.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-members">Max members</Label>
                  <Input id="max-members" type="number" min={2} {...groupForm.register('maxMembers', { valueAsNumber: true })} />
                  {groupForm.formState.errors.maxMembers ? (
                    <p className="text-xs text-rose-400">{groupForm.formState.errors.maxMembers.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="min-contribution">Minimum contribution</Label>
                  <Input id="min-contribution" placeholder="0.05" {...groupForm.register('minContribution')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input id="currency" placeholder="ETH" {...groupForm.register('currency')} />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                leftIcon={<PlusCircle className="h-4 w-4" />}
                isLoading={createMutation.isPending}
              >
                Launch group
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
