'use client';

import type { ReactElement } from 'react';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BalanceOverview } from '@/components/wallet/balance-overview';
import { QuickActions } from '@/components/wallet/quick-actions';
import { TransactionHistory } from '@/components/wallet/transaction-history';

export default function EnhancedWalletPage(): ReactElement {
  const [activeTab, setActiveTab] = useState('overview');


  const handleTransfer = () => {
    setActiveTab('transfer');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-50">Wallet</h1>
          <p className="text-slate-400 mt-1">
            Manage your gasless wallets and transactions
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions
        onTransfer={handleTransfer}
      />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="send">Send/Withdraw</TabsTrigger>
          <TabsTrigger value="transfer">Transfer</TabsTrigger>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <BalanceOverview />
          <TransactionHistory />
        </TabsContent>

        <TabsContent value="send" className="space-y-6">
          {/* Send/Withdraw form would go here */}
          <div className="text-center py-8 text-slate-400">
            Send/Withdraw functionality - integrate existing form
          </div>
        </TabsContent>

        <TabsContent value="transfer" className="space-y-6">
          {/* Transfer form would go here */}
          <div className="text-center py-8 text-slate-400">
            Transfer functionality - integrate existing form
          </div>
        </TabsContent>

        <TabsContent value="tokens" className="space-y-6">
          {/* Token management would go here */}
          <div className="text-center py-8 text-slate-400">
            Token management - integrate existing functionality
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}