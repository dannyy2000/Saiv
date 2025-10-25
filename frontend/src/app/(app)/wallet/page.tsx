'use client';

import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowLeftRight, WalletMinimal, PiggyBank, Target, Plus } from 'lucide-react';
import { QuickActions } from '@/components/wallet/quick-actions';
import { TransactionHistory } from '@/components/wallet/transaction-history';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/providers/auth-context';
import {
  fetchSupportedTokens,
  fetchTokenBalance,
  fetchWalletBalance,
  transferBetweenWallets,
  withdrawEth,
  withdrawToken,
} from '@/services/api/wallet';
import { fetchSavings } from '@/services/api/savings';
import type { SupportedToken, TokenBalance, WalletBalance, SavingsGoal } from '@/types/api';
import { formatTokenAmount, truncateAddress } from '@/lib/utils';
import { toast } from 'sonner';

const sendSchema = z.object({
  toAddress: z.string().min(1, 'Recipient address is required'),
  amount: z.string().min(1, 'Amount is required'),
  walletType: z.enum(['main', 'savings']),
  tokenAddress: z
    .string()
    .optional()
    .refine((value) => !value || value.startsWith('0x'), 'Token address must be a valid contract'),
});

type SendFormValues = z.infer<typeof sendSchema>;

type TransferFormValues = {
  amount: string;
  fromWallet: 'main' | 'savings';
  toWallet: 'main' | 'savings';
  tokenAddress?: string;
};


export default function WalletPage(): ReactElement {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [selectedToken, setSelectedToken] = useState<SupportedToken | null>(null);

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  const {
    data: walletBalance,
    isLoading: isWalletLoading,
  } = useQuery<WalletBalance>({
    queryKey: ['wallet', 'balance'],
    queryFn: fetchWalletBalance,
    enabled: isAuthenticated,
  });

  const {
    data: supportedTokens,
    isLoading: isTokensLoading,
  } = useQuery<SupportedToken[]>({
    queryKey: ['wallet', 'supported-tokens'],
    queryFn: fetchSupportedTokens,
    enabled: isAuthenticated,
  });

  const { data: tokenBalance, isLoading: isTokenBalanceLoading } = useQuery<TokenBalance>({
    queryKey: ['wallet', 'token-balance', selectedToken?.address],
    queryFn: () => fetchTokenBalance(selectedToken?.address ?? ''),
    enabled: isAuthenticated && Boolean(selectedToken?.address),
  });

  const { data: personalSavings, isLoading: isSavingsLoading } = useQuery<SavingsGoal[]>({
    queryKey: ['savings', 'personal'],
    queryFn: () => fetchSavings('personal'),
    enabled: isAuthenticated,
  });

  const sendForm = useForm<SendFormValues>({
    resolver: zodResolver(sendSchema),
    defaultValues: { walletType: 'main', tokenAddress: '' },
  });

  const transferForm = useForm<TransferFormValues>({
    defaultValues: { amount: '', fromWallet: 'main', toWallet: 'savings' },
  });



  const withdrawEthMutation = useMutation({
    mutationFn: withdrawEth,
    onSuccess: async () => {
      toast.success('Withdrawal submitted. The backend will cover gas fees.');
      await queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to withdraw ETH.');
    },
  });

  const withdrawTokenMutation = useMutation({
    mutationFn: withdrawToken,
    onSuccess: async () => {
      toast.success('Token withdrawal submitted.');
      await queryClient.invalidateQueries({ queryKey: ['wallet', 'token-balance'] });
      await queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to withdraw token.');
    },
  });

  const transferMutation = useMutation({
    mutationFn: transferBetweenWallets,
    onSuccess: async () => {
      toast.success('Transfer scheduled between wallets.');
      await queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
      transferForm.reset({ amount: '', fromWallet: 'main', toWallet: 'savings', tokenAddress: '' });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to transfer right now.');
    },
  });



  const handleWithdrawEth = (values: SendFormValues) => {
    withdrawEthMutation.mutate(values);
  };

  const handleWithdrawToken = (values: SendFormValues) => {
    if (!values.tokenAddress) {
      toast.error('Provide the ERC-20 token contract address.');
      return;
    }
    withdrawTokenMutation.mutate({
      tokenAddress: values.tokenAddress,
      toAddress: values.toAddress,
      amount: values.amount,
      walletType: values.walletType,
    });
  };

  const handleTransfer = (values: TransferFormValues) => {
    // Always transfer from main to savings
    const transferData = {
      ...values,
      fromWallet: 'main' as const,
      toWallet: 'savings' as const,
    };
    transferMutation.mutate(transferData);
  };


  const mainBalanceFormatted = useMemo(
    () => formatTokenAmount(walletBalance?.mainWallet?.usdcEquivalent ?? '0', 2),
    [walletBalance?.mainWallet?.usdcEquivalent]
  );
  const savingsBalanceFormatted = useMemo(
    () => formatTokenAmount(walletBalance?.savingsWallet?.usdcEquivalent ?? '0', 2),
    [walletBalance?.savingsWallet?.usdcEquivalent]
  );

  return (
    <div className="space-y-8">
      {/* Quick Actions */}
      <QuickActions
        onTransfer={() => scrollToSection('transfer-section')}
        onWithdraw={() => scrollToSection('withdraw-section')}
      />

      <section className="grid gap-5 lg:grid-cols-3">
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle>Main wallet</CardTitle>
            <CardDescription>Gasless account for everyday transfers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isWalletLoading ? <Skeleton className="h-8 w-32" /> : <p className="text-3xl font-semibold text-slate-50">${mainBalanceFormatted} USDC</p>}
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-400">
              <p className="uppercase tracking-wide text-slate-500">Address</p>
              <p className="font-mono text-sm text-cyan-200">{truncateAddress(walletBalance?.mainWallet?.address)}</p>
            </div>
            <Badge variant="success" className="w-max">Managed by Saiv</Badge>
          </CardContent>
        </Card>

        <Card className="border-white/10">
          <CardHeader>
            <CardTitle>Savings wallet</CardTitle>
            <CardDescription>Automated wallet for long-term goals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isWalletLoading ? <Skeleton className="h-8 w-32" /> : <p className="text-3xl font-semibold text-slate-50">${savingsBalanceFormatted} USDC</p>}
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-400">
              <p className="uppercase tracking-wide text-slate-500">Address</p>
              <p className="font-mono text-sm text-cyan-200">{truncateAddress(walletBalance?.savingsWallet?.address)}</p>
            </div>
            <Badge variant="outline" className="w-max">Boosted yield compatible</Badge>
          </CardContent>
        </Card>

        <Card className="border-white/10">
          <CardHeader>
            <CardTitle>Supported tokens</CardTitle>
            <CardDescription>Select a token to check balances or initiate withdrawals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isTokensLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : supportedTokens?.length ? (
              <div className="space-y-2">
                {supportedTokens.map((token) => (
                  <button
                    key={token.address}
                    type="button"
                    onClick={() => setSelectedToken(token)}
                    className={`flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-left text-sm transition ${
                      selectedToken?.address === token.address ? 'border-cyan-400/50 bg-cyan-500/10 text-cyan-100' : 'hover:border-cyan-400/30 hover:text-cyan-100'
                    }`}
                  >
                    <span className="font-medium">{token.symbol}</span>
                    <span className="text-xs text-slate-400">{truncateAddress(token.address)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Add a token contract address to monitor balances.</p>
            )}

            {selectedToken ? (
              <div className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 p-4 text-sm text-cyan-100">
                <p className="text-xs uppercase tracking-wide text-cyan-200">{selectedToken.symbol} balance</p>
                {isTokenBalanceLoading ? (
                  <Skeleton className="mt-2 h-5 w-32" />
                ) : (
                  <p className="mt-2 text-xl font-semibold">
                    {formatTokenAmount(tokenBalance?.balance ?? '0', 4)} {selectedToken.symbol}
                  </p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card id="withdraw-section" className="border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <WalletMinimal className="h-5 w-5 text-cyan-300" /> Withdraw Funds
            </CardTitle>
            <CardDescription>Transfer funds from your Saiv wallet to an external address (gasless).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="grid gap-4" onSubmit={sendForm.handleSubmit(handleWithdrawEth)}>
              <Label htmlFor="toAddress">External wallet address</Label>
              <Input id="toAddress" placeholder="0x..." {...sendForm.register('toAddress')} />
              {sendForm.formState.errors.toAddress ? <p className="text-xs text-rose-400">{sendForm.formState.errors.toAddress.message}</p> : null}

              <Label htmlFor="amount">Amount (ETH)</Label>
              <Input id="amount" placeholder="0.10" type="number" step="0.0001" {...sendForm.register('amount')} />
              {sendForm.formState.errors.amount ? <p className="text-xs text-rose-400">{sendForm.formState.errors.amount.message}</p> : null}

              <Label htmlFor="tokenAddress">Token contract (for ERC-20 withdrawals)</Label>
              <Input id="tokenAddress" placeholder="0x... (optional for ETH)" {...sendForm.register('tokenAddress')} />
              {sendForm.formState.errors.tokenAddress ? (
                <p className="text-xs text-rose-400">{sendForm.formState.errors.tokenAddress.message}</p>
              ) : null}

              <Label>Source wallet</Label>
              <div className="flex gap-2">
                {(['main', 'savings'] as const).map((wallet) => (
                  <Button
                    key={wallet}
                    type="button"
                    variant={sendForm.watch('walletType') === wallet ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => sendForm.setValue('walletType', wallet)}
                  >
                    {wallet === 'main' ? 'Main Wallet' : 'Savings Wallet'}
                  </Button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  isLoading={withdrawEthMutation.isPending}
                  leftIcon={<WalletMinimal className="h-4 w-4" />}
                >
                  Withdraw ETH
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={sendForm.handleSubmit(handleWithdrawToken)}
                  isLoading={withdrawTokenMutation.isPending}
                >
                  Withdraw Token
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card id="transfer-section" className="border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ArrowLeftRight className="h-5 w-5 text-cyan-300" /> Transfer to Savings
            </CardTitle>
            <CardDescription>Move funds from your main wallet to savings wallet for automated yield.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="grid gap-4" onSubmit={transferForm.handleSubmit(handleTransfer)}>
              <Label htmlFor="transfer-amount">Amount (ETH)</Label>
              <Input id="transfer-amount" placeholder="0.25" type="number" step="0.0001" {...transferForm.register('amount', { required: true })} />

              <Label htmlFor="tokenAddress">Token contract (optional)</Label>
              <Input id="tokenAddress" placeholder="0x... (leave empty for ETH)" {...transferForm.register('tokenAddress')} />

              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
                <div className="flex items-center gap-2 text-blue-300 text-sm font-medium mb-2">
                  <ArrowLeftRight className="h-4 w-4" />
                  Transfer Direction
                </div>
                <p className="text-sm text-blue-200">
                  From: <span className="font-medium">Main Wallet</span> → To: <span className="font-medium">Savings Wallet</span>
                </p>
                <p className="text-xs text-blue-300 mt-1">
                  Savings wallet automatically earns yield on deposited funds
                </p>
              </div>

              <Button type="submit" isLoading={transferMutation.isPending} leftIcon={<ArrowLeftRight className="h-4 w-4" />}>
                Transfer to Savings
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Personal Savings Goals */}
      <section>
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PiggyBank className="h-5 w-5 text-cyan-300" /> Personal Savings
            </CardTitle>
            <CardDescription>Track your personal savings goals and progress.</CardDescription>
          </CardHeader>
          <CardContent>
            {isSavingsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : personalSavings?.length ? (
              <div className="space-y-4">
                {personalSavings.map((goal) => {
                  const current = Number(goal.currentAmount ?? 0);
                  const target = Number(goal.targetAmount ?? 0) || 1;
                  const progress = Math.min(100, (current / target) * 100);

                  return (
                    <div key={goal._id ?? goal.id ?? goal.name} className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-cyan-500/20">
                            <Target className="h-4 w-4 text-cyan-400" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-slate-100">{goal.name}</h3>
                            <p className="text-xs text-slate-400">
                              {formatTokenAmount(current, 2)} / {formatTokenAmount(target, 2)} {goal.currency || 'ETH'}
                            </p>
                          </div>
                        </div>
                        <Badge variant={goal.status === 'completed' ? 'success' : 'outline'}>
                          {goal.status === 'completed' ? 'Complete' : `${progress.toFixed(0)}%`}
                        </Badge>
                      </div>

                      <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
                        <div
                          className="bg-cyan-400 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      {goal.description && (
                        <p className="text-xs text-slate-400 mt-2">{goal.description}</p>
                      )}
                    </div>
                  );
                })}

                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Plus className="h-4 w-4" />}
                    onClick={() => {
                      // For now, show a placeholder message
                      toast.info('Personal savings goal creation will be available soon');
                    }}
                  >
                    Create New Goal
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <PiggyBank className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-sm text-slate-400 mb-2">No personal savings goals yet</p>
                <p className="text-xs text-slate-500 mb-4">Create your first goal to start tracking your savings progress</p>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() => {
                    // For now, show a placeholder message
                    toast.info('Personal savings goal creation will be available soon');
                  }}
                >
                  Create First Goal
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Transaction History */}
      <TransactionHistory />
    </div>
  );
}
