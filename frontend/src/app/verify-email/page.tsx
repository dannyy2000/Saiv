'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { useAuth } from '@/providers/auth-context';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function VerifyEmailContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const token = searchParams.get('token');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('No verification token provided');
        return;
      }

      try {
        const response = await authService.verifyEmail(token);

        if (response.success) {
          setStatus('success');
          setMessage('Email verified successfully! You can now access your account.');

          // Store the token and refresh profile
          if (response.data?.token) {
            localStorage.setItem('authToken', response.data.token);
            await refreshProfile();
            setTimeout(() => {
              router.push('/dashboard');
            }, 2000);
          }
        } else {
          setStatus('error');
          setMessage(response.message || 'Verification failed');
        }
      } catch (error) {
        setStatus('error');
        setMessage('An error occurred during verification');
        console.error('Email verification error:', error);
      }
    };

    verifyEmail();
  }, [token, router, refreshProfile]);

  const handleResendVerification = async () => {
    // This would need email input - for now just show message
    toast.info('Please use the resend verification option on the login page');
  };

  const handleGoToLogin = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Email Verification
          </h2>
        </div>

        <div className="bg-white py-8 px-6 shadow rounded-lg">
          {status === 'loading' && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Verifying your email...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Verification Successful!</h3>
              <p className="text-gray-600 mb-6">{message}</p>
              <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Verification Failed</h3>
              <p className="text-gray-600 mb-6">{message}</p>

              <div className="space-y-3">
                <Button
                  onClick={handleGoToLogin}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Go to Login
                </Button>

                <Button
                  onClick={handleResendVerification}
                  variant="outline"
                  className="w-full"
                >
                  Request New Verification
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Need help?{' '}
            <a href="/support" className="font-medium text-blue-600 hover:text-blue-500">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
