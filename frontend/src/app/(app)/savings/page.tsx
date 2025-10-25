'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SavingsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-slate-400">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}