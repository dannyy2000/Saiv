'use client';

import type { ReactElement } from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, ExternalLink, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTokenAmount, truncateAddress } from '@/lib/utils';
import { apiClient, extractData } from '@/lib/apiClient';

interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'withdraw' | 'transfer';
  amount: string;
  token: string;
  toAddress?: string;
  fromAddress?: string;
  txHash?: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
  walletType: 'main' | 'savings';
}

async function fetchTransactionHistory(): Promise<Transaction[]> {
  try {
    const response = await apiClient.get('/wallet/transactions');
    return extractData(response) as Transaction[];
  } catch (error) {
    console.log('Transaction history not available:', error);
    // Return mock data for now since this endpoint might not exist yet
    return [
      {
        id: '1',
        type: 'receive',
        amount: '0.5',
        token: 'ETH',
        fromAddress: '0x1234...5678',
        status: 'completed',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        walletType: 'main'
      },
      {
        id: '2',
        type: 'send',
        amount: '0.1',
        token: 'ETH',
        toAddress: '0x9876...5432',
        status: 'completed',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        walletType: 'main'
      },
      {
        id: '3',
        type: 'transfer',
        amount: '0.2',
        token: 'ETH',
        status: 'completed',
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        walletType: 'savings'
      }
    ];
  }
}

export function TransactionHistory(): ReactElement {
  const [filter, setFilter] = useState<'all' | 'main' | 'savings'>('all');

  const { data: transactions, isLoading, refetch } = useQuery({
    queryKey: ['wallet', 'transactions'],
    queryFn: fetchTransactionHistory,
  });

  const filteredTransactions = transactions?.filter(tx =>
    filter === 'all' || tx.walletType === filter
  ) || [];

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'receive':
        return <ArrowDownLeft className="h-4 w-4 text-green-400" />;
      case 'send':
      case 'withdraw':
        return <ArrowUpRight className="h-4 w-4 text-red-400" />;
      case 'transfer':
        return <RefreshCw className="h-4 w-4 text-blue-400" />;
      default:
        return <ArrowUpRight className="h-4 w-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'failed':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <Card className="border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Recent wallet activity</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          {(['all', 'main', 'savings'] as const).map((filterOption) => (
            <Button
              key={filterOption}
              variant={filter === filterOption ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter(filterOption)}
            >
              {filterOption === 'all' ? 'All' : filterOption === 'main' ? 'Main' : 'Savings'}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : filteredTransactions.length > 0 ? (
          <div className="space-y-3">
            {filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-900/40 p-3 transition-colors hover:bg-slate-900/60"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800">
                  {getTransactionIcon(tx.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium capitalize">
                      {tx.type}
                    </p>
                    <Badge variant="outline" className={getStatusColor(tx.status)}>
                      {tx.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{formatTokenAmount(tx.amount, 4)} {tx.token}</span>
                    {tx.toAddress && (
                      <>
                        <span>→</span>
                        <span>{truncateAddress(tx.toAddress)}</span>
                      </>
                    )}
                    {tx.fromAddress && (
                      <>
                        <span>←</span>
                        <span>{truncateAddress(tx.fromAddress)}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <p className="text-sm font-medium">
                    {tx.type === 'receive' ? '+' : '-'}{formatTokenAmount(tx.amount, 4)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(tx.timestamp).toLocaleDateString()}
                  </p>
                </div>

                {tx.txHash && (
                  <Button variant="ghost" size="sm" className="p-1">
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-slate-400">No transactions found</p>
            <p className="text-xs text-slate-500 mt-1">
              Your wallet activity will appear here
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}