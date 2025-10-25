import { apiClient, extractData, type ApiEnvelope } from '@/lib/apiClient';
import type { SupportedToken, TokenBalance, WalletBalance } from '@/types/api';

export async function fetchWalletBalance(): Promise<WalletBalance> {
  try {
    const response = await apiClient.get<ApiEnvelope<WalletBalance> | WalletBalance>('/wallet/balance');
    return extractData(response);
  } catch (_err) {
    // Graceful fallback when backend is unreachable to prevent dev server stalls
    return {
      mainWallet: { usdcEquivalent: '0' },
      savingsWallet: { usdcEquivalent: '0' },
      totalUsdcEquivalent: '0',
      conversionInfo: {
        isDemo: true,
        note: 'Backend unreachable - showing placeholder balances',
      },
    };
  }
}

export async function fetchSupportedTokens(): Promise<SupportedToken[]> {
  try {
    const response = await apiClient.get<ApiEnvelope<{ tokens: SupportedToken[] }> | { tokens: SupportedToken[] }>(
      '/wallet/supported-tokens'
    );
    const data = extractData(response) as { tokens?: SupportedToken[] };
    return data.tokens ?? [];
  } catch (_err) {
    // Fallback: no supported tokens when backend is offline
    return [];
  }
}

export async function fetchTokenBalance(tokenAddress: string, walletType: 'main' | 'savings' = 'main'): Promise<TokenBalance> {
  try {
    const response = await apiClient.get<ApiEnvelope<TokenBalance> | TokenBalance>('/wallet/token-balance', {
      params: { tokenAddress, walletType },
    });
    return extractData(response);
  } catch (_err) {
    // Fallback: zero balance when backend is offline
    return {
      tokenAddress,
      balance: '0',
      formatted: '0',
    };
  }
}

export async function sendEth(payload: {
  toAddress: string;
  amount: string;
  walletType?: 'main' | 'savings';
}): Promise<void> {
  await apiClient.post('/wallet/send-eth', payload);
}

export async function withdrawEth(payload: {
  toAddress: string;
  amount: string;
  walletType?: 'main' | 'savings';
}): Promise<void> {
  await apiClient.post('/wallet/withdraw-eth', payload);
}

export async function withdrawToken(payload: {
  tokenAddress: string;
  toAddress: string;
  amount: string;
  walletType?: 'main' | 'savings';
}): Promise<void> {
  await apiClient.post('/wallet/withdraw-token', payload);
}

export async function addSupportedToken(payload: {
  tokenAddress: string;
  walletType?: 'main' | 'savings' | 'both';
}): Promise<void> {
  await apiClient.post('/wallet/add-token', payload);
}

export async function transferBetweenWallets(payload: {
  amount: string;
  tokenAddress?: string;
  fromWallet?: 'main' | 'savings';
  toWallet?: 'main' | 'savings';
}): Promise<void> {
  await apiClient.post('/wallet/transfer', payload);
}
