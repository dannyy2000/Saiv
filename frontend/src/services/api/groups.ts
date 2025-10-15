import { apiClient, extractData, type ApiEnvelope } from '@/lib/apiClient';
import type { Contribution, Group, GroupMember, PaymentWindow } from '@/types/api';

export async function fetchGroups(): Promise<Group[]> {
  const response = await apiClient.get<ApiEnvelope<Group[]> | Group[]>('/groups');
  const data = extractData(response) as Group[] | { groups?: Group[] };
  if (Array.isArray(data)) {
    return data;
  }
  return data.groups ?? [];
}

export async function fetchGroup(groupId: string): Promise<Group | null> {
  if (!groupId) {
    return null;
  }
  const response = await apiClient.get<ApiEnvelope<Group> | Group>(`/groups/${groupId}`);
  return extractData(response) as Group;
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const response = await apiClient.get<ApiEnvelope<GroupMember[]> | GroupMember[]>(`/groups/${groupId}/members`);
  const data = extractData(response);
  return Array.isArray(data) ? data : [];
}

export async function createGroup(payload: {
  name: string;
  description?: string;
  paymentWindowDuration: number;
  poolSettings?: {
    minContribution?: string;
    maxMembers?: number;
    currency?: string;
  };
}): Promise<Group> {
  const response = await apiClient.post<ApiEnvelope<Group> | Group>('/groups', payload);
  return extractData(response) as Group;
}

export async function updateGroup(groupId: string, payload: Partial<Group>): Promise<Group> {
  const response = await apiClient.put<ApiEnvelope<Group> | Group>(`/groups/${groupId}`, payload);
  return extractData(response) as Group;
}

export async function joinGroup(groupId: string): Promise<void> {
  await apiClient.post(`/groups/${groupId}/join`);
}

export async function leaveGroup(groupId: string): Promise<void> {
  await apiClient.post(`/groups/${groupId}/leave`);
}

export async function fetchPaymentWindows(groupId: string): Promise<PaymentWindow[]> {
  const response = await apiClient.get<ApiEnvelope<PaymentWindow[]> | PaymentWindow[]>(`/groups/${groupId}/payment-windows`);
  const data = extractData(response);
  return Array.isArray(data) ? data : [];
}

export async function createPaymentWindow(
  groupId: string,
  payload?: { startDate?: string; endDate?: string }
): Promise<PaymentWindow> {
  const response = await apiClient.post<ApiEnvelope<PaymentWindow> | PaymentWindow>(
    `/groups/${groupId}/payment-window`,
    payload
  );
  return extractData(response) as PaymentWindow;
}

export async function completePaymentWindow(groupId: string, windowNumber: number): Promise<void> {
  await apiClient.put(`/groups/${groupId}/payment-window/${windowNumber}/complete`);
}

export async function contributeToGroup(groupId: string, payload: { amount: string }): Promise<void> {
  await apiClient.post(`/groups/${groupId}/contribute`, payload);
}

export async function contributeTokenToGroup(groupId: string, payload: { tokenAddress: string; amount: string }): Promise<void> {
  await apiClient.post(`/groups/${groupId}/contribute-token`, payload);
}

export async function fetchUserContributions(groupId: string, userId: string): Promise<Contribution[]> {
  const response = await apiClient.get<ApiEnvelope<Contribution[]> | Contribution[]>(`/groups/${groupId}/contributions/${userId}`);
  const data = extractData(response);
  return Array.isArray(data) ? data : [];
}
