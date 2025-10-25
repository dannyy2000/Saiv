import { apiClient, extractData, type ApiEnvelope } from '@/lib/apiClient';
import type { PaginatedResponse, SavingsGoal, SavingsTransaction } from '@/types/api';

export async function fetchSavings(type: 'personal' | 'group' | 'all' = 'all'): Promise<SavingsGoal[]> {
  try {
    const response = await apiClient.get<ApiEnvelope<{ savings: SavingsGoal[] }> | { savings: SavingsGoal[] } | SavingsGoal[]>('/savings', {
      params: { type },
    });
    const data = extractData(response);
    if (Array.isArray(data)) {
      return data;
    }
    return (data as { savings?: SavingsGoal[] }).savings ?? [];
  } catch (_err) {
    // Fallback to empty list to prevent dev/runtime crashes when backend is offline
    return [];
  }
}

export async function createPersonalSavings(payload: {
  name: string;
  targetAmount: string;
  currency?: string;
  tokenAddress?: string;
  interest?: number;
  settings?: { minContribution?: string; lockUntilDate?: string };
}): Promise<SavingsGoal> {
  const response = await apiClient.post<ApiEnvelope<SavingsGoal> | SavingsGoal>('/savings/personal', payload);
  return extractData(response) as SavingsGoal;
}

export async function createGroupSavings(payload: {
  groupId: string;
  name: string;
  targetAmount: string;
  currency?: string;
  tokenAddress?: string;
  interest?: number;
}): Promise<SavingsGoal> {
  const response = await apiClient.post<ApiEnvelope<SavingsGoal> | SavingsGoal>('/savings/group', payload);
  return extractData(response) as SavingsGoal;
}

export async function updateSavings(savingsId: string, payload: Partial<SavingsGoal>): Promise<SavingsGoal> {
  const response = await apiClient.put<ApiEnvelope<SavingsGoal> | SavingsGoal>(`/savings/${savingsId}`, payload);
  return extractData(response) as SavingsGoal;
}

export async function fetchSavingsById(savingsId: string): Promise<SavingsGoal | null> {
  try {
    const response = await apiClient.get<ApiEnvelope<SavingsGoal> | SavingsGoal>(`/savings/${savingsId}`);
    return extractData(response) as SavingsGoal;
  } catch (_err) {
    return null;
  }
}

export async function depositToSavings(savingsId: string, payload: { amount: string; description?: string }): Promise<void> {
  await apiClient.post(`/savings/${savingsId}/deposit`, payload);
}

export async function withdrawFromSavings(savingsId: string, payload: { amount: string; description?: string }): Promise<void> {
  await apiClient.post(`/savings/${savingsId}/withdraw`, payload);
}

export async function fetchSavingsTransactions(
  savingsId: string,
  options?: { page?: number; limit?: number }
): Promise<PaginatedResponse<SavingsTransaction>> {
  try {
    const response = await apiClient.get<
      ApiEnvelope<{ transactions: SavingsTransaction[]; page?: number; limit?: number; total?: number }>
    >(`/savings/${savingsId}/transactions`, {
      params: options,
    });
    const data = extractData(response) as { transactions?: SavingsTransaction[]; page?: number; limit?: number; total?: number };
    return {
      items: data.transactions ?? [],
      page: data.page,
      limit: data.limit,
      total: data.total,
    };
  } catch (_err) {
    return {
      items: [],
      page: options?.page ?? 1,
      limit: options?.limit ?? 10,
      total: 0,
    };
  }
}
