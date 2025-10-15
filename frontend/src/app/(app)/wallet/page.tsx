'use client';

import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowLeftRight, Coins, Plus, Send, WalletMinimal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/providers/auth-context';
import {
  addSupportedToken,
  fetchSupportedTokens,
  fetchTokenBalance,
  fetchWalletBalance,
  sendEth,
  transferBetweenWallets,
  withdrawEth,
  withdrawToken,
} from '@/services/api/wallet';
import type { SupportedToken, TokenBalance, WalletBalance } from '@/types/api';
import { formatTokenAmount, truncateAddress } from '@/lib/utils';
import { toast } from 'sonner';

const sendSchema = z.object({
  toAddress: z.string().min(1, 'Recipient address is required'),
  amount: z.string().min(1, 'Amount is required'),
  walletType: z.enum(['main', 'savings']).default('main'),
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

type TokenFormValues = {
  tokenAddress: string;
  walletType: 'main' | 'savings' | 'both';
};

export default function WalletPage(): ReactElement {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [selectedToken, setSelectedToken] = useState<SupportedToken | null>(null);

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

  const sendForm = useForm<SendFormValues>({
    resolver: zodResolver(sendSchema),
    defaultValues: { walletType: 'main', tokenAddress: '' },
  });

  const transferForm = useForm<TransferFormValues>({
    defaultValues: { amount: '', fromWallet: 'main', toWallet: 'savings' },
  });

  const tokenForm = useForm<TokenFormValues>({
    defaultValues: { walletType: 'both', tokenAddress: '' },
  });

  const sendMutation = useMutation({
    mutationFn: sendEth,
    onSuccess: async () => {
      toast.success('ETH transfer initiated successfully.');
      await queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
      sendForm.reset({ walletType: 'main' });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to send ETH right now.');
    },
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

  const addTokenMutation = useMutation({
    mutationFn: addSupportedToken,
    onSuccess: async () => {
      toast.success('Token added to your managed list.');
      await queryClient.invalidateQueries({ queryKey: ['wallet', 'supported-tokens'] });
      tokenForm.reset({ walletType: 'both', tokenAddress: '' });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to add token.');
    },
  });

  const handleSend = (values: SendFormValues) => {
    sendMutation.mutate(values);
  };

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
    if (values.fromWallet === values.toWallet) {
      toast.error('Select two different wallets to transfer between.');
      return;
    }
    transferMutation.mutate(values);
  };

  const handleAddToken = (values: TokenFormValues) => {
    addTokenMutation.mutate(values);
  };

  const mainBalanceFormatted = useMemo(
    () => formatTokenAmount(walletBalance?.mainWallet?.balance ?? '0', 6),
    [walletBalance?.mainWallet?.balance]
  );
  const savingsBalanceFormatted = useMemo(
    () => formatTokenAmount(walletBalance?.savingsWallet?.balance ?? '0', 6),
    [walletBalance?.savingsWallet?.balance]
  );

  return (
    <div className="space-y-8">
      <section className="grid gap-5 lg:grid-cols-3">
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle>Main wallet</CardTitle>
            <CardDescription>Gasless account for everyday transfers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isWalletLoading ? <Skeleton className="h-8 w-32" /> : <p className="text-3xl font-semibold text-slate-50">{mainBalanceFormatted} ETH</p>}
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
            {isWalletLoading ? <Skeleton className="h-8 w-32" /> : <p className="text-3xl font-semibold text-slate-50">{savingsBalanceFormatted} ETH</p>}
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
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Send className="h-5 w-5 text-cyan-300" /> Send or withdraw ETH
            </CardTitle>
            <CardDescription>Saiv will execute the transfer using the backend wallet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="grid gap-4" onSubmit={sendForm.handleSubmit(handleSend)}>
              <Label htmlFor="toAddress">Recipient address</Label>
              <Input id="toAddress" placeholder="0x..." {...sendForm.register('toAddress')} />
              {sendForm.formState.errors.toAddress ? <p className="text-xs text-rose-400">{sendForm.formState.errors.toAddress.message}</p> : null}

              <Label htmlFor="amount">Amount (ETH)</Label>
              <Input id="amount" placeholder="0.10" type="number" step="0.0001" {...sendForm.register('amount')} />
              {sendForm.formState.errors.amount ? <p className="text-xs text-rose-400">{sendForm.formState.errors.amount.message}</p> : null}

              <Label htmlFor="tokenAddress">Token contract (for ERC-20 withdrawals)</Label>
              <Input id="tokenAddress" placeholder="0x..." {...sendForm.register('tokenAddress')} />
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
                    {wallet === 'main' ? 'Main' : 'Savings'}
                  </Button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" isLoading={sendMutation.isLoading} leftIcon={<Send className="h-4 w-4" />}>
                  Send ETH
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={sendForm.handleSubmit(handleWithdrawEth)}
                  isLoading={withdrawEthMutation.isLoading}
                  leftIcon={<WalletMinimal className="h-4 w-4" />}
                >
                  Withdraw ETH
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={sendForm.handleSubmit(handleWithdrawToken)}
                  isLoading={withdrawTokenMutation.isLoading}
                >
                  Withdraw token
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ArrowLeftRight className="h-5 w-5 text-cyan-300" /> Transfer between wallets
            </CardTitle>
            <CardDescription>Rebalance between main and savings or move ERC-20 balances.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="grid gap-4" onSubmit={transferForm.handleSubmit(handleTransfer)}>
              <Label htmlFor="transfer-amount">Amount</Label>
              <Input id="transfer-amount" placeholder="0.25" type="number" step="0.0001" {...transferForm.register('amount', { required: true })} />

              <Label>Direction</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={transferForm.watch('fromWallet') === 'main' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => transferForm.setValue('fromWallet', 'main')}
                >
                  From main
                </Button>
                <Button
                  type="button"
                  variant={transferForm.watch('fromWallet') === 'savings' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => transferForm.setValue('fromWallet', 'savings')}
                >
                  From savings
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={transferForm.watch('toWallet') === 'main' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => transferForm.setValue('toWallet', 'main')}
                >
                  To main
                </Button>
                <Button
                  type="button"
                  variant={transferForm.watch('toWallet') === 'savings' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => transferForm.setValue('toWallet', 'savings')}
                >
                  To savings
                </Button>
              </div>

              <Label htmlFor="tokenAddress">Token (optional)</Label>
              <Input id="tokenAddress" placeholder="ERC-20 token contract" {...transferForm.register('tokenAddress')} />

              <Button type="submit" isLoading={transferMutation.isLoading} leftIcon={<ArrowLeftRight className="h-4 w-4" />}>
                Transfer
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-cyan-300" /> Add token to monitoring list
            </CardTitle>
            <CardDescription>Track ERC-20 tokens across your main and savings wallets.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={tokenForm.handleSubmit(handleAddToken)}>
              <div className="space-y-3">
                <Label htmlFor="token-address">Token contract</Label>
                <Input id="token-address" placeholder="0x..." {...tokenForm.register('tokenAddress', { required: true })} />
              </div>
              <Button type="submit" isLoading={addTokenMutation.isLoading} leftIcon={<Plus className="h-4 w-4" />}>
                Add token
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
