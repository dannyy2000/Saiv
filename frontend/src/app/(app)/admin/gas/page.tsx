'use client';

import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Fuel, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchBackendWalletInfo, fetchGasEstimates, fetchGasStatus } from '@/services/api/gas';
import type { GasEstimates, GasStatus } from '@/types/api';
import { formatTokenAmount, truncateAddress } from '@/lib/utils';

export default function GasInsightsPage(): ReactElement {
  const { data: status, isLoading: isStatusLoading } = useQuery<GasStatus>({
    queryKey: ['gas', 'status'],
    queryFn: fetchGasStatus,
  });

  const { data: backendWallet, isLoading: isWalletLoading } = useQuery<{ address?: string; balance?: string; network?: string }>(
    {
      queryKey: ['gas', 'wallet'],
      queryFn: fetchBackendWalletInfo,
    }
  );

  const { data: estimates, isLoading: isEstimatesLoading } = useQuery<GasEstimates>({
    queryKey: ['gas', 'estimates'],
    queryFn: fetchGasEstimates,
  });

  const registry = useMemo(() => {
    if (!estimates) {
      return [];
    }
    return Object.entries(estimates).map(([operation, detail]) => ({
      operation,
      estimatedGas: detail.estimatedGas ?? '-',
      costInETH: detail.costInETH ?? '-',
      costInUSD: detail.costInUSD ?? '-',
      notes: detail.notes ?? '',
    }));
  }, [estimates]);

  const serviceEnabled = status?.enabled ?? true;

  return (
    <div className="space-y-8">
      <section className="grid gap-5 md:grid-cols-3">
        <Card className="border-white/10">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Gasless status</CardTitle>
              <CardDescription>Global toggle for backend gas sponsorship.</CardDescription>
            </div>
            <Badge variant={serviceEnabled ? 'success' : 'danger'}>{serviceEnabled ? 'Enabled' : 'Paused'}</Badge>
          </CardHeader>
          <CardContent>
            {isStatusLoading ? (
              <Skeleton className="h-5 w-40" />
            ) : (
              <p className="text-sm text-slate-300">
                Users currently experience <span className="font-semibold text-cyan-200">0 gas fees</span> across registration,
                wallet actions, and savings operations.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Backend wallet</CardTitle>
              <CardDescription>Saiv operator wallet covering gas fees.</CardDescription>
            </div>
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            {isWalletLoading ? (
              <Skeleton className="h-5 w-56" />
            ) : (
              <>
                <p>
                  Network: <span className="font-semibold text-slate-100">{backendWallet?.network ?? 'Unknown'}</span>
                </p>
                <p>
                  Balance: <span className="font-semibold text-cyan-200">{formatTokenAmount(backendWallet?.balance ?? '0')} ETH</span>
                </p>
                <p className="font-mono text-xs text-cyan-300">
                  {backendWallet?.address ? truncateAddress(backendWallet.address) : 'No wallet configured'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Throughput insights</CardTitle>
              <CardDescription>Monitor how Saiv operations map to gas usage.</CardDescription>
            </div>
            <Activity className="h-5 w-5 text-cyan-300" />
          </CardHeader>
          <CardContent className="text-sm text-slate-300">
            {isStatusLoading ? (
              <Skeleton className="h-5 w-36" />
            ) : (
              <p>
                Recent operations: registration, group creation, wallet transfers, and savings deposits all run gaslessly via the backend
                relayer. Keep the backend wallet topped up to maintain the experience.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="border-white/10">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Estimated gas per operation</CardTitle>
              <CardDescription>Use these numbers to forecast backend wallet refills.</CardDescription>
            </div>
            <Fuel className="h-5 w-5 text-cyan-300" />
          </CardHeader>
          <CardContent>
            {isEstimatesLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : registry.length ? (
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full border-collapse text-sm text-slate-300">
                  <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Operation</th>
                      <th className="px-4 py-3 text-left">Estimated gas</th>
                      <th className="px-4 py-3 text-left">Cost (ETH)</th>
                      <th className="px-4 py-3 text-left">Cost (USD)</th>
                      <th className="px-4 py-3 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registry.map((row) => (
                      <tr key={row.operation} className="border-t border-white/5">
                        <td className="px-4 py-3 font-medium text-slate-100">{row.operation}</td>
                        <td className="px-4 py-3">{row.estimatedGas}</td>
                        <td className="px-4 py-3">{row.costInETH}</td>
                        <td className="px-4 py-3">{row.costInUSD}</td>
                        <td className="px-4 py-3 text-slate-400">{row.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                No estimates available yet. Once the backend reports metrics, they will surface here for quick reference.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">Operational checklist</CardTitle>
            <CardDescription>Keep the Saiv experience frictionless for contributors.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <p className="mb-2 text-sm font-semibold text-slate-100">Top up backend wallet</p>
              <p>Maintain at least 5 MATIC/ETH equivalent to ensure uninterrupted gas sponsorship.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <p className="mb-2 text-sm font-semibold text-slate-100">Monitor spikes</p>
              <p>Large group onboarding or contribution days increase gas usage—watch the estimates table.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <p className="mb-2 text-sm font-semibold text-slate-100">Enable alerts</p>
              <p>Hook backend wallet balance alerts into your ops tooling to prevent downtime.</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
