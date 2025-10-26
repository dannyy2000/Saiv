import axios from 'axios';
import { setAuthToken as setApiClientToken, getAuthToken as getApiClientToken, clearAuthToken as clearApiClientToken } from '@/lib/apiClient';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user?: User;
    token?: string;
    requiresVerification?: boolean;
    email?: string;
  };
  requiresVerification?: boolean;
}

export interface User {
  id: string;
  email?: string;
  eoaAddress?: string;
  address: string;
  savingsAddress: string;
  balance: string;
  registrationType: 'email' | 'wallet';
  profile: {
    name: string;
    avatar?: string;
  };
  isEmailVerified?: boolean;
}

class AuthService {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Use apiClient's token management
      this.token = getApiClientToken();
    }
  }

  setAuthToken(token: string) {
    this.token = token;
    // Use apiClient's setAuthToken to ensure consistency
    setApiClientToken(token);
  }

  getAuthToken(): string | null {
    // Use apiClient's token
    return getApiClientToken();
  }

  removeAuthToken() {
    this.token = null;
    // Use apiClient's clearAuthToken
    clearApiClientToken();
  }

  private getAuthHeaders() {
    const token = getApiClientToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async registerWithEmail(email: string): Promise<AuthResponse> {
    try {
      // Use dev endpoint in development to bypass rate limiting
      const isDev = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENV === 'development';
      const endpoint = isDev ? '/auth/dev/register/email' : '/auth/register/email';

      const response = await axios.post(`${API_BASE_URL}${endpoint}`, {
        email
      });

      return response.data;
    } catch (error: unknown) {
      return {
        success: false,
        message: (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Registration failed'
      };
    }
  }

  async registerWithWallet(eoaAddress: string): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register/wallet`, {
        eoaAddress
      });

      if (response.data.success && response.data.data?.token) {
        this.setAuthToken(response.data.data.token);
      }

      return response.data;
    } catch (error: unknown) {
      return {
        success: false,
        message: (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Registration failed'
      };
    }
  }

  async verifyEmail(otp: string): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/verify-email`, {
        otp  // Send as OTP instead of token
      });

      if (response.data.success && response.data.data?.token) {
        this.setAuthToken(response.data.data.token);
      }

      return response.data;
    } catch (error: unknown) {
      return {
        success: false,
        message: (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Email verification failed'
      };
    }
  }

  async resendVerification(email: string): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/resend-verification`, {
        email
      });

      return response.data;
    } catch (error: unknown) {
      return {
        success: false,
        message: (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to resend verification email'
      };
    }
  }

  async getProfile(): Promise<{ success: boolean; data?: { user: User }; message?: string }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/profile`, {
        headers: this.getAuthHeaders()
      });

      return response.data;
    } catch (error: unknown) {
      const errorObj = error as { response?: { status?: number; data?: { requiresVerification?: boolean; message?: string } } };
      if (errorObj.response?.status === 403 && errorObj.response?.data?.requiresVerification) {
        return {
          success: false,
          message: 'Email verification required'
        };
      }

      return {
        success: false,
        message: errorObj.response?.data?.message || 'Failed to get profile'
      };
    }
  }

  async updateBalance(amount: string): Promise<AuthResponse> {
    try {
      const response = await axios.put(`${API_BASE_URL}/auth/balance`, {
        amount
      }, {
        headers: this.getAuthHeaders()
      });

      return response.data;
    } catch (error: unknown) {
      return {
        success: false,
        message: (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to update balance'
      };
    }
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  logout() {
    this.removeAuthToken();
  }
}

export const authService = new AuthService();