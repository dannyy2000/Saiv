'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { useAuth } from '@/providers/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

function VerifyEmailContent() {
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const { refreshProfile } = useAuth();

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setIsVerifying(true);
    setStatus('idle');

    try {
      const response = await authService.verifyEmail(otp);

      if (response.success) {
        setStatus('success');
        setMessage('Email verified successfully! Redirecting to dashboard...');
        toast.success('Email verified successfully!');

        // Token is already set by authService.verifyEmail, just refresh profile
        if (response.data?.token) {
          try {
            await refreshProfile();
          } catch (profileError) {
            console.warn('Profile refresh failed, but continuing to dashboard:', profileError);
            // Don't block the user from accessing dashboard if profile refresh fails
            // They can retry once on the dashboard
          }

          setTimeout(() => {
            router.push('/dashboard');
          }, 1500);
        }
      } else {
        setStatus('error');
        setMessage(response.message || 'Verification failed');
        toast.error(response.message || 'Invalid or expired code');
      }
    } catch (error) {
      setStatus('error');
      setMessage('An error occurred during verification');
      toast.error('An error occurred during verification');
      console.error('Email verification error:', error);
    } finally {
      setIsVerifying(false);
    }
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
          <p className="mt-2 text-sm text-gray-600">
            Enter the 6-digit code sent to your email
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow rounded-lg">
          {status === 'success' ? (
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
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                  Verification Code
                </label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="text-center text-2xl font-mono tracking-widest"
                  disabled={isVerifying}
                  autoFocus
                />
                <p className="mt-2 text-xs text-gray-500 text-center">
                  Code expires in 15 minutes
                </p>
              </div>

              {status === 'error' && message && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-800 text-center">{message}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={isVerifying || otp.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isVerifying ? 'Verifying...' : 'Verify Email'}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  onClick={handleGoToLogin}
                  variant="ghost"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Back to Login
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Didn&apos;t receive the code?{' '}
            <button
              onClick={() => toast.info('Please request a new code from the login page')}
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Resend Code
            </button>
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