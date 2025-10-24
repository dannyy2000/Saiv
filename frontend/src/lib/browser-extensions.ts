'use client';

interface ExtensionInfo {
  name: string;
  detected: boolean;
  provider?: any;
}

export function detectWalletExtensions(): ExtensionInfo[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const extensions: ExtensionInfo[] = [];

  // MetaMask
  if (typeof (window as any).ethereum !== 'undefined') {
    const ethereum = (window as any).ethereum;

    if (ethereum.isMetaMask) {
      extensions.push({
        name: 'MetaMask',
        detected: true,
        provider: ethereum
      });
    }

    if (ethereum.isCoinbaseWallet) {
      extensions.push({
        name: 'Coinbase Wallet',
        detected: true,
        provider: ethereum
      });
    }

    if (ethereum.isRabby) {
      extensions.push({
        name: 'Rabby Wallet',
        detected: true,
        provider: ethereum
      });
    }

    // Generic ethereum provider
    if (!ethereum.isMetaMask && !ethereum.isCoinbaseWallet && !ethereum.isRabby) {
      extensions.push({
        name: 'Unknown Wallet',
        detected: true,
        provider: ethereum
      });
    }
  }

  // Coinbase Wallet (alternative detection)
  if (typeof (window as any).coinbaseWalletExtension !== 'undefined') {
    const existingCoinbase = extensions.find(ext => ext.name === 'Coinbase Wallet');
    if (!existingCoinbase) {
      extensions.push({
        name: 'Coinbase Wallet',
        detected: true,
        provider: (window as any).coinbaseWalletExtension
      });
    }
  }

  // Phantom (Solana)
  if (typeof (window as any).phantom !== 'undefined') {
    extensions.push({
      name: 'Phantom',
      detected: true,
      provider: (window as any).phantom
    });
  }

  return extensions;
}

export function cleanupBrowserExtensionAttributes() {
  if (typeof window === 'undefined') return;

  // Remove common extension-injected attributes that cause hydration issues
  const elementsToClean = document.querySelectorAll('[data-extension-id], [data-metamask], [data-coinbase]');

  elementsToClean.forEach(element => {
    element.removeAttribute('data-extension-id');
    element.removeAttribute('data-metamask');
    element.removeAttribute('data-coinbase');
  });
}

export function suppressBrowserExtensionWarnings() {
  if (typeof window === 'undefined') return;

  // Suppress common extension-related console warnings
  const originalConsoleWarn = console.warn;
  console.warn = (...args) => {
    const message = args.join(' ');

    // Skip warnings related to browser extensions
    if (
      message.includes('ethereum') ||
      message.includes('MetaMask') ||
      message.includes('coinbase') ||
      message.includes('extension') ||
      message.includes('Hydration')
    ) {
      return;
    }

    originalConsoleWarn.apply(console, args);
  };
}