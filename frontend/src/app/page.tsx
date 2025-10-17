'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, Wallet, Zap } from 'lucide-react';
import { ConnectWalletButton } from '@/components/auth/connect-wallet-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';
import { useAuth } from '@/providers/auth-context';

const features = [
  {
    title: 'Zero Gas Fees',
    description: 'Register and save without paying any blockchain fees. We handle all gas costs.',
    icon: <Sparkles className="h-6 w-6 text-cyan-300" />,
  },
  {
    title: 'Group Savings',
    description: 'Create savings groups with friends and family. Coordinate contributions easily.',
    icon: <Wallet className="h-6 w-6 text-cyan-300" />,
  },
  {
    title: 'Instant Wallets',
    description: 'Get secure wallets instantly with just your email. No complex setup required.',
    icon: <Zap className="h-6 w-6 text-cyan-300" />,
  },
];

export default function LandingPage(): ReactElement {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 py-6 sm:px-8">
        <Logo size="md" />
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button size="sm">Dashboard</Button>
            </Link>
          ) : (
            <ConnectWalletButton label="Get Started" />
          )}
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 pb-20 pt-12 sm:px-8">
        {/* Hero Section */}
        <section className="text-center space-y-8 py-16">
          <div className="space-y-4">
            <Badge variant="outline" className="rounded-full border-cyan-400/40 bg-cyan-500/10 text-xs uppercase tracking-wide text-cyan-200">
              Zero Gas Fees
            </Badge>
            <h1 className="text-4xl font-bold leading-tight text-slate-50 sm:text-6xl lg:text-7xl">
              Save Money<br />
              <span className="bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent">Together</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-slate-300 sm:text-xl">
              Create savings groups, set goals, and coordinate contributions with friends and family.
              No gas fees, no complexity - just simple savings powered by blockchain.
            </p>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-4">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="lg" className="text-lg px-8 py-3">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <ConnectWalletButton label="Start Saving for Free" />
            )}
            <Link href="/dashboard">
              <Button variant="ghost" size="lg" className="text-lg px-8 py-3">
                View Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid gap-8 sm:grid-cols-3 max-w-4xl mx-auto pt-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-cyan-400">$0</p>
              <p className="text-slate-400">Gas Fees</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-cyan-400">2</p>
              <p className="text-slate-400">Wallets per User</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-cyan-400">1 Click</p>
              <p className="text-slate-400">to Get Started</p>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-slate-50 sm:text-4xl">Why Choose Saiv?</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Simple, secure, and gasless savings for everyone
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="border-white/10 bg-slate-900/40 hover:bg-slate-900/60 transition-colors">
                <CardHeader className="text-center space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl text-slate-100">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-slate-300">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-12 text-center space-y-6">
          <h3 className="text-3xl font-bold text-slate-50">Ready to Start Saving?</h3>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Join thousands of users who save money together without worrying about gas fees or complexity.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="lg" className="text-lg px-8 py-3">
                  Open Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <ConnectWalletButton label="Get Started for Free" />
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-900/40 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            {/* Logo Section */}
            <div className="space-y-4">
              <Logo size="md" />
              <p className="text-sm text-slate-400">
                Simple, secure, and gasless savings for everyone. Built on blockchain, designed for simplicity.
              </p>
            </div>

            {/* Product Links */}
            <div>
              <h4 className="font-semibold text-slate-50 mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="/dashboard" className="hover:text-cyan-400 transition-colors">Dashboard</Link></li>
                <li><Link href="/wallet" className="hover:text-cyan-400 transition-colors">Wallet</Link></li>
                <li><Link href="/groups" className="hover:text-cyan-400 transition-colors">Groups</Link></li>
                <li><Link href="/savings" className="hover:text-cyan-400 transition-colors">Savings</Link></li>
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h4 className="font-semibold text-slate-50 mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-cyan-400 transition-colors">About</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Contact</a></li>
              </ul>
            </div>

            {/* Support Links */}
            <div>
              <h4 className="font-semibold text-slate-50 mb-3">Support</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Security</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center">
            <p className="text-sm text-slate-400">
              © 2024 Saiv. All rights reserved.
            </p>
            <div className="flex items-center gap-4 mt-4 sm:mt-0">
              <p className="text-sm text-slate-400">Built on Lisk Sepolia</p>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-400"></div>
                <span className="text-xs text-slate-400">All systems operational</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
