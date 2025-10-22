'use client';

import type { ComponentType, ReactElement, SVGProps } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, PiggyBank, Users, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
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

export function AppSidebar(): ReactElement {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 flex-col gap-8 border-r border-white/10 bg-slate-950/60 px-6 py-8 backdrop-blur xl:flex">
      <div className="space-y-1">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Saiv</span>
        <h1 className="text-2xl font-bold text-slate-100">Command Center</h1>
        <p className="text-sm text-slate-400">Gasless Web3 savings and coordination.</p>
      </div>

      <nav className="flex flex-1 flex-col gap-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group relative overflow-hidden rounded-2xl border border-transparent bg-slate-900/50 p-4 transition hover:border-cyan-400/30 hover:bg-slate-900',
                isActive && 'border-cyan-400/60 bg-slate-900'
              )}
            >
              <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100" />
              <div className="flex items-center gap-3">
                <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800/60 text-cyan-300 transition group-hover:bg-cyan-500/20 group-hover:text-cyan-200', isActive && 'bg-cyan-500/20 text-cyan-100')}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-100">{item.label}</p>
                  <p className="text-xs text-slate-400">{item.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-950/60 p-5 text-sm text-slate-300 shadow-inner shadow-black/30">
        <h2 className="mb-2 text-sm font-semibold text-slate-100">Need a refresher?</h2>
        <p className="mb-4 text-xs leading-relaxed text-slate-400">
          Saiv automatically creates main and savings wallets, powers gasless interactions, and keeps your contributors in sync.
        </p>
        <p className="text-xs uppercase tracking-wide text-cyan-300">Secure • Gasless • Composable</p>
      </div>
    </aside>
  );
}
