'use client';

import type { ReactElement } from 'react';
import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MagicAuthButton } from './magic-auth-button';

interface MagicAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MagicAuthModal({ isOpen, onClose }: MagicAuthModalProps): ReactElement | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="absolute top-4 right-4 z-20">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <MagicAuthButton />
      </div>
    </div>
  );
}

interface MagicAuthTriggerProps {
  children: React.ReactNode;
}

export function MagicAuthTrigger({ children }: MagicAuthTriggerProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div onClick={() => setIsOpen(true)}>
        {children}
      </div>
      <MagicAuthModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}