import { apiClient, extractData, type ApiEnvelope } from '@/lib/apiClient';
import type { GasEstimates, GasStatus } from '@/types/api';

export async function fetchGasStatus(): Promise<GasStatus> {
  const response = await apiClient.get<ApiEnvelope<GasStatus> | GasStatus>('/gas/status');
  return extractData(response);
}

export async function fetchBackendWalletInfo(): Promise<{ address?: string; balance?: string; network?: string }> {
  const response = await apiClient.get<ApiEnvelope<{ address?: string; balance?: string; network?: string }> | { address?: string; balance?: string; network?: string }>(
    '/gas/backend-wallet'
  );
  return extractData(response);
}

export async function fetchGasEstimates(): Promise<GasEstimates> {
  const response = await apiClient.get<ApiEnvelope<GasEstimates> | GasEstimates>('/gas/estimates');
  return extractData(response);
}
