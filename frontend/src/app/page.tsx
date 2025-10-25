'use client';

import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Sparkles, Wallet, Zap } from 'lucide-react';
import { ConnectWalletButton } from '@/components/auth/connect-wallet-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';
import { useAuth } from '@/providers/auth-context';

const features = [
  {
    title: 'Zero Gas Fees',
    description: 'Save money without worrying about transaction costs. Our gasless technology covers all blockchain fees, making every save completely free.',
    detail: 'Powered by account abstraction and sponsored transactions',
    icon: <Sparkles className="h-6 w-6 text-cyan-300" />,
  },
  {
    title: 'Smart Group Savings',
    description: 'Create collaborative savings pools with automated contribution tracking, transparent fund management, and fair distribution systems.',
    detail: 'Built on smart contracts for transparency and security',
    icon: <Wallet className="h-6 w-6 text-cyan-300" />,
  },
  {
    title: 'Email-to-Wallet Technology',
    description: 'Revolutionary wallet creation using just your email address. Secure, non-custodial wallets without seed phrases or complex setup.',
    detail: 'Powered by Thirdweb\'s account abstraction technology',
    icon: <Zap className="h-6 w-6 text-cyan-300" />,
  },
];

export default function LandingPage(): ReactElement {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

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
        <section className="text-center space-y-8 py-16 animate-in fade-in duration-1000">
          <div className="space-y-4">
            <Badge variant="outline" className="rounded-full border-cyan-400/40 bg-cyan-500/10 text-xs uppercase tracking-wide text-cyan-200 animate-in slide-in-from-top duration-700 delay-200">
              🚀 Zero Gas Fees Technology
            </Badge>
            <h1 className="text-4xl font-bold leading-tight text-slate-50 sm:text-6xl lg:text-7xl animate-in slide-in-from-bottom duration-700 delay-300">
              Save Money<br />
              <span className="bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent animate-pulse">Together</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-slate-300 sm:text-xl animate-in slide-in-from-bottom duration-700 delay-500">
              Join the future of collaborative savings. Create groups, track contributions, and achieve financial goals together.
              <br /><span className="text-cyan-400 font-semibold">100% gasless, 100% transparent, 100% secure.</span>
            </p>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-4 animate-in slide-in-from-bottom duration-700 delay-700">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="lg" className="text-lg px-8 py-3">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <ConnectWalletButton label="Get Started" />
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
            <div className="text-center group cursor-pointer">
              <p className="text-3xl font-bold text-cyan-400 group-hover:scale-110 transition-transform duration-300">$0</p>
              <p className="text-slate-400 group-hover:text-slate-300 transition-colors">Transaction Fees</p>
              <p className="text-xs text-slate-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Completely gasless experience</p>
            </div>
            <div className="text-center group cursor-pointer">
              <p className="text-3xl font-bold text-cyan-400 group-hover:scale-110 transition-transform duration-300">∞</p>
              <p className="text-slate-400 group-hover:text-slate-300 transition-colors">Groups & Savings</p>
              <p className="text-xs text-slate-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Unlimited group participation</p>
            </div>
            <div className="text-center group cursor-pointer">
              <p className="text-3xl font-bold text-cyan-400 group-hover:scale-110 transition-transform duration-300">30s</p>
              <p className="text-slate-400 group-hover:text-slate-300 transition-colors">Setup Time</p>
              <p className="text-xs text-slate-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Email to wallet in seconds</p>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="space-y-12 animate-in fade-in duration-1000 delay-1000">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-slate-50 sm:text-4xl">Why Choose Saiv?</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Experience the next generation of collaborative financial technology
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature, index) => (
              <Card key={feature.title} className="border-white/10 bg-slate-900/40 hover:bg-slate-900/60 hover:border-cyan-500/30 transition-all duration-500 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/20 group animate-in slide-in-from-bottom duration-700" style={{ animationDelay: `${1200 + index * 200}ms` }}>
                <CardHeader className="text-center space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/20 group-hover:bg-cyan-500/20 group-hover:border-cyan-400/40 group-hover:scale-110 transition-all duration-300">
                    <div className="group-hover:animate-pulse">
                      {feature.icon}
                    </div>
                  </div>
                  <CardTitle className="text-xl text-slate-100 group-hover:text-cyan-200 transition-colors">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-3">
                  <p className="text-slate-300 group-hover:text-slate-200 transition-colors">{feature.description}</p>
                  <p className="text-xs text-cyan-400/80 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">{feature.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How It Works Section */}
        <section className="space-y-12 animate-in fade-in duration-1000 delay-1800">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-slate-50 sm:text-4xl">How Saiv Works</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Get started in three simple steps
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center space-y-4 group">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/20 border-2 border-cyan-400/40 text-cyan-400 font-bold text-lg group-hover:scale-110 transition-transform duration-300">
                1
              </div>
              <h3 className="text-xl font-semibold text-slate-200">Connect with Email</h3>
              <p className="text-slate-400">Sign up using just your email address. We&apos;ll create a secure wallet for you instantly.</p>
            </div>

            <div className="text-center space-y-4 group">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/20 border-2 border-cyan-400/40 text-cyan-400 font-bold text-lg group-hover:scale-110 transition-transform duration-300">
                2
              </div>
              <h3 className="text-xl font-semibold text-slate-200">Create or Join Groups</h3>
              <p className="text-slate-400">Start a savings group with friends or join existing ones. Set goals and contribution schedules.</p>
            </div>

            <div className="text-center space-y-4 group">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/20 border-2 border-cyan-400/40 text-cyan-400 font-bold text-lg group-hover:scale-110 transition-transform duration-300">
                3
              </div>
              <h3 className="text-xl font-semibold text-slate-200">Save & Achieve Goals</h3>
              <p className="text-slate-400">Make contributions without any fees. Track progress and withdraw when goals are met.</p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-12 text-center space-y-6 hover:border-cyan-500/30 transition-all duration-500 animate-in slide-in-from-bottom duration-1000 delay-2000">
          <h3 className="text-3xl font-bold text-slate-50">Ready to Start Saving?</h3>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Join the revolution in collaborative savings. No fees, no barriers, just pure financial empowerment.
          </p>
          <div className="flex justify-center items-center gap-8 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
              <span>Secure & Audited</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></div>
              <span>100% Gasless</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse"></div>
              <span>Instant Setup</span>
            </div>
          </div>
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
