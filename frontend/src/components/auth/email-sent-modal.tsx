'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mail, CheckCircle, RefreshCw } from 'lucide-react';

interface EmailSentModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  onResendEmail: () => Promise<void>;
}

export function EmailSentModal({ isOpen, onClose, email, onResendEmail }: EmailSentModalProps) {
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Countdown for resend button
  useEffect(() => {
    if (!isOpen || canResend) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, canResend]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCountdown(60);
      setCanResend(false);
      setIsResending(false);
    }
  }, [isOpen]);

  const handleResend = async () => {
    setIsResending(true);
    try {
      await onResendEmail();
      setCanResend(false);
      setCountdown(60);
    } finally {
      setIsResending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 text-center">
        {/* Success Icon */}
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <Mail className="w-8 h-8 text-green-600" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Check Your Email
        </h2>

        {/* Description */}
        <p className="text-gray-600 mb-6">
          We&apos;ve sent a verification link to{' '}
          <span className="font-semibold text-gray-900">{email}</span>
        </p>

        {/* Instructions */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Next steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li>Open your email inbox</li>
                <li>Look for an email from Saiv</li>
                <li>Click the verification link</li>
                <li>You&apos;ll be automatically logged in</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleResend}
            disabled={!canResend || isResending}
            variant="outline"
            className="w-full"
          >
            {isResending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : canResend ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Resend Email
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Resend in {countdown}s
              </>
            )}
          </Button>

          <Button
            onClick={onClose}
            variant="ghost"
            className="w-full text-gray-600 hover:text-gray-900"
          >
            I&apos;ll check my email later
          </Button>
        </div>

        {/* Help text */}
        <p className="text-xs text-gray-500 mt-4">
          Can&apos;t find the email? Check your spam folder or try a different email address.
        </p>
      </div>
    </div>
  );
}