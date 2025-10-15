'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, Wallet, Zap } from 'lucide-react';
import { ConnectWalletButton } from '@/components/auth/connect-wallet-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/providers/auth-context';

const features = [
  {
    title: 'Zero gas onboarding',
    description: 'Email users receive production wallets instantly—no seed phrases, no extensions, no gas.',
    icon: <Sparkles className="h-5 w-5 text-cyan-300" />,
  },
  {
    title: 'Coordinated pods',
    description: 'Spin up group vaults, payment windows, and tracked contributions in one place.',
    icon: <Wallet className="h-5 w-5 text-cyan-300" />,
  },
  {
    title: 'Backend-powered Web3',
    description: 'Saiv handles contract interactions server-side so frontends stay fast and familiar.',
    icon: <Zap className="h-5 w-5 text-cyan-300" />,
  },
];

export default function LandingPage(): ReactElement {
  const { isAuthenticated } = useAuth();

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-16 px-4 pb-20 pt-24 sm:px-8">
      <section className="relative grid gap-10 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
        <div className="space-y-6">
          <Badge variant="outline" className="rounded-full border-cyan-400/40 bg-cyan-500/10 text-xs uppercase tracking-[0.4em] text-cyan-200">
            Gasless by design
          </Badge>
          <h1 className="text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl">
            Save, coordinate, and move value in Web3 without your users ever touching gas.
          </h1>
          <p className="max-w-xl text-base text-slate-300">
            Saiv fuses thirdweb authentication with a fully managed backend so every contribution, withdrawal, and group deployment
            stays effortless. Email or wallet sign in; we take care of smart contract complexity while you ship product.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button leftIcon={<ArrowRight className="h-4 w-4" />}>Open dashboard</Button>
              </Link>
            ) : (
              <ConnectWalletButton />
            )}
            <Link href="/dashboard">
              <Button variant="ghost" rightIcon={<ArrowRight className="h-4 w-4" />}>Preview workspace</Button>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
              <p className="text-2xl font-semibold text-slate-100">2 wallets</p>
              <p>Every user receives main and savings addresses automatically.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
              <p className="text-2xl font-semibold text-slate-100">0 gas fees</p>
              <p>Backend relayer pays for contract calls in real time.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
              <p className="text-2xl font-semibold text-slate-100">Full API surface</p>
              <p>Wallet, savings, group, and gas endpoints ready to consume.</p>
            </div>
          </div>
        </div>
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle>Platform map</CardTitle>
            <CardDescription>Everything your frontend needs is exposed through the Saiv REST API.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300">
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Authentication</p>
              <p>Email and wallet registration via thirdweb, JWT issuance via Saiv backend.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Wallet orchestration</p>
              <p>Fetch balances, transfer funds, register ERC-20 tokens, and withdraw on behalf of users.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Groups & savings</p>
              <p>Coordinate pods, automate payment windows, and track deposits across pooled vaults.</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-slate-50">Why teams ship with Saiv</h2>
            <p className="text-sm text-slate-400">Launch a beautiful Web3 experience while relying on a production-ready backend.</p>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="border-white/10">
              <CardHeader className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">{feature.icon}</span>
                <CardTitle className="text-lg text-slate-100">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm text-slate-300">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-10 text-center text-slate-100">
        <h3 className="text-2xl font-semibold">Ready to explore the dashboard?</h3>
        <p className="mt-2 text-sm text-slate-300">
          Connect with email or wallet, and Saiv will hydrate your entire workspace—gasless wallets, groups, savings, and admin insights.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button leftIcon={<ArrowRight className="h-4 w-4" />}>Go to dashboard</Button>
            </Link>
          ) : (
            <ConnectWalletButton />
          )}
        </div>
      </section>
    </main>
  );
}
