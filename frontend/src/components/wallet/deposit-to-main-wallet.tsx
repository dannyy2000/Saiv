'use client';

import { useState } from 'react';
import { Copy, Check, QrCode, Info, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface DepositToMainWalletProps {
  mainWalletAddress: string;
  supportedTokens?: Array<{
    symbol: string;
    name: string;
    address: string;
  }>;
}

export function DepositToMainWallet({ mainWalletAddress, supportedTokens = [] }: DepositToMainWalletProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Validate Ethereum address (should be 42 characters: 0x + 40 hex chars)
  const isValidAddress = mainWalletAddress && mainWalletAddress.length === 42 && mainWalletAddress.startsWith('0x');

  const copyAddress = async () => {
    if (!isValidAddress) {
      toast.error('Invalid wallet address');
      return;
    }
    try {
      await navigator.clipboard.writeText(mainWalletAddress);
      setCopied(true);
      toast.success('Address copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy address');
    }
  };

  const openInExplorer = () => {
    if (!isValidAddress) {
      toast.error('Invalid wallet address');
      return;
    }
    // Optimism Sepolia block explorer
    const explorerUrl = `https://sepolia-optimism.etherscan.io/address/${mainWalletAddress}`;
    window.open(explorerUrl, '_blank');
  };

  return (
    <Card className="border-cyan-500/20 bg-gradient-to-br from-slate-900 to-slate-800">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span className="text-cyan-400">Deposit to Main Wallet</span>
              <Badge variant="secondary" className="text-xs">
                Gasless
              </Badge>
            </CardTitle>
            <CardDescription className="mt-2">
              Send tokens from your external wallet (MetaMask, etc.) to your Main Wallet address
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Warning for invalid address */}
        {!isValidAddress && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-yellow-200">Wallet Not Created Yet</p>
                <p className="text-xs text-yellow-100/80">
                  Your smart contract wallet hasn&apos;t been deployed yet. This happens automatically when you first register.
                  If you&apos;re seeing this message, there may be a network connectivity issue with the backend.
                </p>
                <p className="text-xs text-yellow-100/80">
                  Please contact support or try refreshing the page.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Address Display */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Info className="h-4 w-4" />
            <span>Your Main Wallet Address (Contract Wallet)</span>
          </div>

          <div className="relative group">
            <div className={`rounded-xl border ${isValidAddress ? 'border-white/10' : 'border-red-500/30'} bg-slate-900/60 p-4`}>
              <div className="flex items-center justify-between gap-3">
                <code className={`flex-1 break-all font-mono text-sm ${isValidAddress ? 'text-cyan-300' : 'text-red-400'}`}>
                  {mainWalletAddress || 'Address not available'}
                </code>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={copyAddress}
                    disabled={!isValidAddress}
                    className="h-8 w-8 p-0 hover:bg-cyan-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4 text-slate-400" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={openInExplorer}
                    disabled={!isValidAddress}
                    className="h-8 w-8 p-0 hover:bg-cyan-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isValidAddress ? "View in block explorer" : "Address not available"}
                  >
                    <ExternalLink className="h-4 w-4 text-slate-400" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* QR Code Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowQR(!showQR)}
            className="w-full border-white/10 hover:border-cyan-500/50"
          >
            <QrCode className="mr-2 h-4 w-4" />
            {showQR ? 'Hide' : 'Show'} QR Code
          </Button>

          {showQR && (
            <div className="flex justify-center rounded-xl border border-white/10 bg-slate-900/60 p-6">
              <div className="text-center">
                <div className="mb-3 rounded-lg bg-white p-4 inline-block">
                  {/* QR Code would go here - you can use a library like qrcode.react */}
                  <div className="h-48 w-48 flex items-center justify-center text-slate-400 text-sm">
                    QR Code
                    <br />
                    (Install qrcode.react)
                  </div>
                </div>
                <p className="text-xs text-slate-400">Scan with your wallet app</p>
              </div>
            </div>
          )}
        </div>

        {/* Supported Tokens */}
        {supportedTokens.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-300">Supported Tokens</h4>
            <div className="flex flex-wrap gap-2">
              {supportedTokens.map((token) => (
                <Badge
                  key={token.address}
                  variant="secondary"
                  className="bg-slate-800 hover:bg-slate-700"
                >
                  {token.symbol}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="space-y-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <h4 className="flex items-center gap-2 text-sm font-medium text-blue-300">
            <Info className="h-4 w-4" />
            How to Deposit
          </h4>
          <ol className="space-y-2 text-sm text-slate-300">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-300">
                1
              </span>
              <span>Open your external wallet (MetaMask, Trust Wallet, etc.)</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-300">
                2
              </span>
              <span>Copy the Main Wallet address above</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-300">
                3
              </span>
              <span>Send supported tokens (USDC, USDT, etc.) to this address</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-300">
                4
              </span>
              <span>Your balance will update automatically - no gas fees needed!</span>
            </li>
          </ol>
        </div>

        {/* Important Notes */}
        <div className="space-y-2 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <h4 className="text-sm font-semibold text-yellow-300">⚠️ Important</h4>
          <ul className="space-y-1 text-xs text-slate-300">
            <li>• Only send tokens on the <strong>Lisk network</strong></li>
            <li>• Double-check the address before sending</li>
            <li>• Deposits are irreversible - make sure you send to the correct address</li>
            <li>• Small test transactions are recommended first</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
