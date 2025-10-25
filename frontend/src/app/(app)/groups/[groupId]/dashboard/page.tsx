'use client';

import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Copy,
  Users,
  Calendar,
  TrendingUp,
  Wallet,
  Send,
  Clock,
  CheckCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/providers/auth-context';
import {
  fetchGroup,
  fetchGroupMembers,
  fetchPaymentWindows,
  fetchUserContributions,
  contributeToGroup,
  updateGroup
} from '@/services/api/groups';
import type { Group, GroupMember, PaymentWindow, Contribution } from '@/types/api';
import { formatTokenAmount, truncateAddress } from '@/lib/utils';
import { toast } from 'sonner';

const contributeSchema = z.object({
  amount: z.string().min(1, 'Amount is required').refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    'Amount must be a valid positive number'
  )
});

const updateGroupSchema = z.object({
  description: z.string().max(500, 'Description must be less than 500 characters')
});

type ContributeFormValues = z.infer<typeof contributeSchema>;
type UpdateGroupFormValues = z.infer<typeof updateGroupSchema>;

export default function GroupDashboard(): ReactElement {
  const { isAuthenticated, user } = useAuth();
  const currentUserId = user?._id ?? user?.id ?? '';
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  // Queries
  const { data: group, isLoading: isGroupLoading } = useQuery<Group | null>({
    queryKey: ['groups', 'detail', groupId],
    queryFn: () => fetchGroup(groupId),
    enabled: isAuthenticated && Boolean(groupId),
  });

  const { data: members, isLoading: isMembersLoading } = useQuery<GroupMember[]>({
    queryKey: ['groups', 'members', groupId],
    queryFn: () => fetchGroupMembers(groupId),
    enabled: isAuthenticated && Boolean(groupId),
  });

  const { data: paymentWindows, isLoading: isWindowsLoading } = useQuery<PaymentWindow[]>({
    queryKey: ['groups', 'windows', groupId],
    queryFn: () => fetchPaymentWindows(groupId),
    enabled: isAuthenticated && Boolean(groupId),
  });

  const { data: userContributions } = useQuery<Contribution[]>({
    queryKey: ['groups', 'contributions', groupId, currentUserId],
    queryFn: () => fetchUserContributions(groupId, currentUserId),
    enabled: isAuthenticated && Boolean(groupId) && Boolean(currentUserId),
  });

  // Forms
  const contributeForm = useForm<ContributeFormValues>({
    resolver: zodResolver(contributeSchema),
    defaultValues: { amount: '' }
  });

  const updateForm = useForm<UpdateGroupFormValues>({
    resolver: zodResolver(updateGroupSchema),
    defaultValues: { description: group?.description || '' }
  });

  // Mutations
  const contributeMutation = useMutation({
    mutationFn: (values: ContributeFormValues) => contributeToGroup(groupId, values),
    onSuccess: async () => {
      toast.success('Contribution submitted successfully!');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['groups', 'detail', groupId] }),
        queryClient.invalidateQueries({ queryKey: ['groups', 'windows', groupId] }),
        queryClient.invalidateQueries({ queryKey: ['groups', 'contributions', groupId, currentUserId] })
      ]);
      contributeForm.reset();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to submit contribution');
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: (values: UpdateGroupFormValues) => updateGroup(groupId, values),
    onSuccess: async () => {
      toast.success('Group description updated!');
      await queryClient.invalidateQueries({ queryKey: ['groups', 'detail', groupId] });
      setIsEditingDescription(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update group');
    },
  });

  // Computed values
  const currentWindow = useMemo(() => {
    if (!paymentWindows?.length) return null;
    return paymentWindows.find(w => w.status === 'active') || paymentWindows[paymentWindows.length - 1];
  }, [paymentWindows]);

  const totalUserContributions = useMemo(() => {
    return userContributions?.reduce((sum, contribution) =>
      sum + parseFloat(contribution.amount || '0'), 0
    ) || 0;
  }, [userContributions]);

  const copyGroupAddress = async () => {
    if (group?.address) {
      await navigator.clipboard.writeText(group.address);
      toast.success('Group address copied to clipboard');
    }
  };

  const handleContribute = (values: ContributeFormValues) => {
    contributeMutation.mutate(values);
  };

  const handleUpdateDescription = (values: UpdateGroupFormValues) => {
    updateGroupMutation.mutate(values);
  };

  const formatPaymentWindowDates = (window: PaymentWindow) => {
    if (!window.startDate) return 'Dates TBD';
    const start = new Date(window.startDate);
    const end = window.endDate ? new Date(window.endDate) : null;

    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end ? end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD';

    return `${startStr} - ${endStr}`;
  };

  if (isGroupLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Group not found</p>
        <Button
          variant="outline"
          onClick={() => router.push('/groups')}
          className="mt-4"
        >
          Back to Groups
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/groups')}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          Back to Groups
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-50">{group.name}</h1>
          <div className="flex items-center gap-4 mt-2">
            {!isEditingDescription ? (
              <p className="text-slate-400">
                {group.description || 'No description'}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditingDescription(true);
                    updateForm.setValue('description', group.description || '');
                  }}
                  className="ml-2 text-xs"
                >
                  Edit
                </Button>
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  {...updateForm.register('description')}
                  placeholder="Group description"
                  className="w-64"
                />
                <Button
                  size="sm"
                  onClick={updateForm.handleSubmit(handleUpdateDescription)}
                  isLoading={updateGroupMutation.isPending}
                >
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingDescription(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4 text-cyan-300" />
              Group Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-50">
              {formatTokenAmount((group && 'totalPoolValue' in group ? group.totalPoolValue as string : '0') || '0', 4)} ETH
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Total accumulated funds
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-green-300" />
              Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-50">
              {members?.length || 0}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              of {group.poolSettings?.maxMembers || 'unlimited'} max
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-purple-300" />
              Current Window
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentWindow ? (
              <>
                <p className="text-lg font-semibold text-slate-50">
                  Window #{currentWindow.windowNumber}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {formatPaymentWindowDates(currentWindow)}
                </p>
                <Badge
                  variant={currentWindow.status === 'active' ? 'success' : 'outline'}
                  className="mt-2"
                >
                  {currentWindow.status}
                </Badge>
              </>
            ) : (
              <p className="text-sm text-slate-400">No active window</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-orange-300" />
              Your Contributions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-50">
              {formatTokenAmount(totalUserContributions.toString(), 4)} ETH
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Total contributed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contribution Form */}
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-cyan-300" />
              Make Contribution
            </CardTitle>
            <CardDescription>
              Contribute to the group pool for the current payment window
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-200">Group Address</p>
                  <p className="text-xs text-blue-300 font-mono mt-1">
                    {group.address ? truncateAddress(group.address) : 'Not available'}
                  </p>
                </div>
                {group.address && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyGroupAddress}
                    leftIcon={<Copy className="h-3 w-3" />}
                  >
                    Copy
                  </Button>
                )}
              </div>
            </div>

            <form onSubmit={contributeForm.handleSubmit(handleContribute)} className="space-y-4">
              <div>
                <Label htmlFor="amount">Amount (ETH)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.0001"
                  placeholder="0.10"
                  {...contributeForm.register('amount')}
                />
                {contributeForm.formState.errors.amount && (
                  <p className="text-xs text-rose-400 mt-1">
                    {contributeForm.formState.errors.amount.message}
                  </p>
                )}
              </div>

              {group.poolSettings?.minContribution && (
                <p className="text-xs text-slate-400">
                  Minimum contribution: {group.poolSettings.minContribution} {group.poolSettings.currency || 'ETH'}
                </p>
              )}

              <Button
                type="submit"
                isLoading={contributeMutation.isPending}
                disabled={!currentWindow || currentWindow.status !== 'active'}
                className="w-full"
                leftIcon={<Send className="h-4 w-4" />}
              >
                {currentWindow?.status === 'active' ? 'Contribute Now' : 'No Active Payment Window'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Group Members */}
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-300" />
              Group Members ({members?.length || 0})
            </CardTitle>
            <CardDescription>
              All members have equal access and contribution rights
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isMembersLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : members?.length ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {members.map((member) => (
                  <div
                    key={member.userId || member.user?._id}
                    className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-slate-900/40"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        {member.user?.profile?.name || member.user?.email || 'Unknown Member'}
                      </p>
                      <p className="text-xs text-slate-400">
                        Joined {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {member.userId === group.owner || member.user?._id === group.owner ? 'Creator' : 'Member'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">
                No members found
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Windows History */}
      <Card className="border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-300" />
            Payment Windows History
          </CardTitle>
          <CardDescription>
            Track contribution periods and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isWindowsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : paymentWindows?.length ? (
            <div className="space-y-4">
              {paymentWindows.map((window) => (
                <div
                  key={window.windowNumber}
                  className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-slate-900/40"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${
                      window.status === 'completed'
                        ? 'bg-green-500/20 text-green-400'
                        : window.status === 'active'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {window.status === 'completed' ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        Payment Window #{window.windowNumber}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatPaymentWindowDates(window)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-200">
                      {formatTokenAmount(window.totalContributions || '0', 4)} ETH
                    </p>
                    <Badge variant={
                      window.status === 'completed' ? 'success' :
                      window.status === 'active' ? 'default' : 'outline'
                    }>
                      {window.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">
              No payment windows created yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}