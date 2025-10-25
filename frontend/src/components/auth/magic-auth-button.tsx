'use client';

import type { ReactElement } from 'react';
import { useState, Fragment, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/providers/auth-context';
import { EmailVerificationNotice } from '@/components/auth/email-verification-notice';
import { EmailSentModal } from '@/components/auth/email-sent-modal';
import { NoSSR } from '@/components/no-ssr';
import { cn } from '@/lib/utils';

interface MagicAuthButtonProps {
  className?: string;
}

export function MagicAuthButton({ className }: MagicAuthButtonProps): ReactElement {
  const router = useRouter();
  const { signInWithEmail, isLoading, requiresVerification, verificationEmail, resendVerification } = useAuth();
  const [email, setEmail] = useState('');
  const [showVerificationNotice, setShowVerificationNotice] = useState(false);
  const [showEmailSentModal, setShowEmailSentModal] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || isLoading) {
      return;
    }

    const success = await signInWithEmail(email);
    if (success) {
      router.push('/dashboard');
    } else if (requiresVerification) {
      setShowEmailSentModal(true);
    }
  };

  const handleResendEmail = async () => {
    if (verificationEmail || email) {
      await resendVerification(verificationEmail || email);
    }
  };

  // Watch for requiresVerification state changes
  useEffect(() => {
    if (requiresVerification && verificationEmail) {
      console.log('📧 Showing email sent modal for:', verificationEmail);
      setShowEmailSentModal(true);
    }
  }, [requiresVerification, verificationEmail]);

  // Show verification notice if user requires verification (but still show the modal)
  if (requiresVerification || showVerificationNotice) {
    return (
      <Fragment>
        <Card className={cn('w-full max-w-md border-white/10 bg-slate-900/40', className)}>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Email Verification Required</CardTitle>
            <CardDescription>
              Please verify your email address to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmailVerificationNotice
              email={verificationEmail || email}
              onClose={() => {
                setShowVerificationNotice(false);
              }}
            />
            <Button
              variant="outline"
              onClick={() => {
                setShowVerificationNotice(false);
              }}
              className="w-full mt-4"
            >
              Try Different Email
            </Button>
          </CardContent>
        </Card>

        {/* Email Sent Modal - Also show when verification is required */}
        <EmailSentModal
          isOpen={showEmailSentModal}
          onClose={() => setShowEmailSentModal(false)}
          email={verificationEmail || email}
          onResendEmail={handleResendEmail}
        />
      </Fragment>
    );
  }

  return (
    <Fragment>
      <NoSSR fallback={
        <Card className={cn('w-full max-w-md border-white/10 bg-slate-900/40', className)}>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Loading...</CardTitle>
          </CardHeader>
        </Card>
      }>
      <Card className={cn('w-full max-w-md border-white/10 bg-slate-900/40', className)}>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>
            Enter your email address to create or access your Saiv account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-200">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email address"
                  className="pl-10"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={!email || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending link...
                </>
              ) : (
                'Continue'
              )}
            </Button>
            <p className="text-xs text-slate-400 text-center">
              We&apos;ll spin up your gasless wallets and take you straight to the dashboard.
            </p>
          </form>
        </CardContent>
      </Card>

    </NoSSR>

    {/* Email Sent Modal - Outside NoSSR for proper rendering */}
    <EmailSentModal
      isOpen={showEmailSentModal}
      onClose={() => setShowEmailSentModal(false)}
      email={verificationEmail || email}
      onResendEmail={handleResendEmail}
    />
    </Fragment>
  );
}
