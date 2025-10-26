'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/auth-context';

interface EmailVerificationNoticeProps {
  email: string;
  onClose?: () => void;
}

export function EmailVerificationNotice({ email, onClose }: EmailVerificationNoticeProps) {
  const { resendVerification } = useAuth();
  const [isResending, setIsResending] = useState(false);

  const handleResendVerification = async () => {
    setIsResending(true);
    await resendVerification(email);
    setIsResending(false);
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Email Verification Required
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              We&apos;ve sent a 6-digit verification code to <strong>{email}</strong>.
              Please check your inbox and enter the code on the verification page to complete your registration.
            </p>
          </div>
          <div className="mt-4 flex space-x-3">
            <Button
              onClick={handleResendVerification}
              disabled={isResending}
              variant="outline"
              size="sm"
              className="bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200"
            >
              {isResending ? 'Sending...' : 'Resend Code'}
            </Button>
            {onClose && (
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="text-yellow-800 hover:bg-yellow-200"
              >
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}