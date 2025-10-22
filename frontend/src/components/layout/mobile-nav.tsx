'use client';

import type { ReactElement } from 'react';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, LayoutDashboard, PiggyBank, Users, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Overview',
    description: 'Snapshot of balances, activity, and savings',
    icon: LayoutDashboard,
  },
  {
    href: '/wallet',
    label: 'Wallets',
    description: 'Manage main and savings wallets',
    icon: Wallet,
  },
  {
    href: '/groups',
    label: 'Groups',
    description: 'Create, join, and coordinate pods',
    icon: Users,
  },
  {
    href: '/savings',
    label: 'Savings',
    description: 'Track personal and group goals',
    icon: PiggyBank,
  },
];

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps): ReactElement {
  const pathname = usePathname();

  // Close menu when clicking outside or pressing escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return <></>;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm xl:hidden"
        onClick={onClose}
      />

      {/* Mobile Navigation Panel */}
      <div className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-slate-950/95 backdrop-blur-xl border-r border-white/10 xl:hidden">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Saiv</span>
              <h1 className="text-xl font-bold text-slate-100">Command Center</h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-6 py-6">
            <div className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 shadow-lg shadow-cyan-500/10'
                        : 'text-slate-300 hover:bg-white/5 hover:text-slate-200'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-5 w-5 transition-colors',
                        isActive ? 'text-cyan-300' : 'text-slate-400 group-hover:text-slate-300'
                      )}
                    />
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs text-slate-400 group-hover:text-slate-300">
                        {item.description}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="border-t border-white/10 px-6 py-4">
            <p className="text-xs text-slate-400">
              Gasless Web3 savings and coordination
            </p>
          </div>
        </div>
      </div>
    </>
  );
}