export interface WalletAccount {
  address?: string;
  balance?: string;
  network?: string;
  [key: string]: unknown;
}

export interface WalletBalance {
  mainWallet?: WalletAccount;
  savingsWallet?: WalletAccount;
}

export interface SupportedToken {
  address: string;
  symbol: string;
  decimals: number;
  name?: string;
  logoURI?: string;
  [key: string]: unknown;
}

export interface TokenBalance {
  tokenAddress: string;
  balance?: string;
  formatted?: string;
  symbol?: string;
  decimals?: number;
}

export interface GroupMember {
  userId?: string;
  user?: BackendUser;
  role?: 'admin' | 'member';
  joinedAt?: string;
  totalContribution?: string;
  [key: string]: unknown;
}

export interface PaymentWindow {
  windowNumber?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  totalContributions?: string;
  contributors?: Array<{ userId?: string; amount?: string }>;
  [key: string]: unknown;
}

export interface Group {
  _id?: string;
  id?: string;
  name: string;
  description?: string;
  address?: string;
  members?: GroupMember[];
  owner?: string;
  paymentWindowDuration?: number;
  poolSettings?: {
    minContribution?: string;
    maxMembers?: number;
    currency?: string;
    [key: string]: unknown;
  };
  savings?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  [key: string]: unknown;
}

export interface Contribution {
  amount: string;
  type?: string;
  tokenAddress?: string;
  createdAt?: string;
  windowNumber?: number;
  [key: string]: unknown;
}

export interface SavingsGoal {
  _id?: string;
  id?: string;
  name: string;
  description?: string;
  type: 'personal' | 'group';
  owner?: string;
  group?: string;
  targetAmount?: string;
  currentAmount?: string;
  currency?: string;
  tokenAddress?: string;
  interest?: number;
  status?: string;
  settings?: {
    minContribution?: string;
    lockUntilDate?: string;
    [key: string]: unknown;
  };
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface SavingsTransaction {
  _id?: string;
  id?: string;
  type: 'deposit' | 'withdrawal' | string;
  amount: string;
  description?: string;
  createdAt?: string;
  tokenAddress?: string;
  [key: string]: unknown;
}

export interface GasStatus {
  enabled?: boolean;
  backendWalletBalance?: string;
  network?: string;
  lastUpdated?: string;
  [key: string]: unknown;
}

export interface GasEstimates {
  [operation: string]: {
    estimatedGas?: string;
    costInETH?: string;
    costInUSD?: string;
    notes?: string;
  };
}

export interface BackendUser {
  id?: string;
  _id?: string;
  email?: string;
  eoaAddress?: string;
  address?: string;
  savingsAddress?: string;
  balance?: string;
  registrationType?: 'email' | 'wallet';
  profile?: {
    name?: string;
    avatar?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface PaginatedResponse<T> {
  items: T[];
  total?: number;
  page?: number;
  limit?: number;
}
