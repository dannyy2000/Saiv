import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user?: any;
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
      this.token = localStorage.getItem('authToken');
    }
  }

  setAuthToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
    }
  }

  getAuthToken(): string | null {
    return this.token;
  }

  removeAuthToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
    }
  }

  private getAuthHeaders() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  async registerWithEmail(email: string): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register/email`, {
        email
      });

      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed'
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
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed'
      };
    }
  }

  async verifyEmail(token: string): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/verify-email`, {
        token
      });

      if (response.data.success && response.data.data?.token) {
        this.setAuthToken(response.data.data.token);
      }

      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Email verification failed'
      };
    }
  }

  async resendVerification(email: string): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/resend-verification`, {
        email
      });

      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to resend verification email'
      };
    }
  }

  async getProfile(): Promise<{ success: boolean; data?: { user: User }; message?: string }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/profile`, {
        headers: this.getAuthHeaders()
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403 && error.response?.data?.requiresVerification) {
        return {
          success: false,
          message: 'Email verification required'
        };
      }

      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get profile'
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
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update balance'
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