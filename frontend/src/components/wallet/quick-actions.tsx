'use client';

import type { ReactElement } from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, QrCode, Upload } from 'lucide-react';
import { fetchWalletBalance } from '@/services/api/wallet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface QuickActionsProps {
  onTransfer?: () => void;
  onWithdraw?: () => void;
}

export function QuickActions({
  onTransfer,
  onWithdraw
}: QuickActionsProps): ReactElement {
  const [showReceiveQR, setShowReceiveQR] = useState(false);

  const { data: walletBalance } = useQuery({
    queryKey: ['wallet', 'balance'],
    queryFn: fetchWalletBalance,
  });

  const actions = [
    {
      id: 'receive',
      label: 'Receive',
      description: 'Show wallet address',
      icon: <QrCode className="h-5 w-5" />,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      onClick: () => setShowReceiveQR(true)
    },
    {
      id: 'transfer',
      label: 'Transfer',
      description: 'Main to savings wallet',
      icon: <ArrowLeftRight className="h-5 w-5" />,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      onClick: onTransfer
    },
    {
      id: 'withdraw',
      label: 'Withdraw',
      description: 'Remove funds (gasless)',
      icon: <Upload className="h-5 w-5" />,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      onClick: onWithdraw
    }
  ];

  return (
    <>
      <Card className="border-white/10">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common wallet operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {actions.map((action) => (
              <button
                key={action.id}
                onClick={action.onClick}
                className="flex flex-col items-center gap-3 rounded-lg border border-white/10 bg-slate-900/40 p-4 transition-all hover:border-white/20 hover:bg-slate-900/60 hover:scale-105"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${action.bgColor}`}>
                  <span className={action.color}>
                    {action.icon}
                  </span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-200">{action.label}</p>
                  <p className="text-xs text-slate-400 mt-1">{action.description}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge variant="outline" className="text-green-400">
              $0 Gas Fees
            </Badge>
            <Badge variant="outline" className="text-blue-400">
              Instant Transfers
            </Badge>
            <Badge variant="outline" className="text-purple-400">
              Backend Sponsored
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Receive QR Modal */}
      {showReceiveQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Receive Funds</CardTitle>
              <CardDescription>Share your wallet address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="mx-auto mb-4 h-48 w-48 rounded-lg bg-white p-4">
                  {/* QR Code placeholder - you can integrate a QR library here */}
                  <div className="h-full w-full rounded bg-slate-100 flex items-center justify-center">
                    <QrCode className="h-16 w-16 text-slate-400" />
                  </div>
                </div>
                <p className="text-xs text-slate-400 break-all font-mono">
                  {walletBalance?.mainWallet?.address || '0x1234...5678'}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  Copy Address
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowReceiveQR(false)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}