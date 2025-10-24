'use client';

import { useEffect, useState } from 'react';
import { detectWalletExtensions } from '@/lib/browser-extensions';

interface EthereumProvider {
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  request?: (args: any) => Promise<any>;
}

export function useEthereumProvider() {
  const [provider, setProvider] = useState<EthereumProvider | null>(null);
  const [detectedWallets, setDetectedWallets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    const detectProviders = () => {
      try {
        const wallets = detectWalletExtensions();
        setDetectedWallets(wallets);

        // Prefer MetaMask if available
        const ethereum = (window as any).ethereum;
        if (ethereum) {
          // Handle multiple providers
          if (ethereum.providers?.length > 0) {
            // Find MetaMask specifically
            const metamask = ethereum.providers.find((p: any) => p.isMetaMask);
            setProvider(metamask || ethereum.providers[0]);
          } else {
            setProvider(ethereum);
          }
        }
      } catch (error) {
        console.warn('Error detecting wallet providers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Initial detection
    detectProviders();

    // Listen for provider changes
    const handleEthereumChanged = () => {
      detectProviders();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('ethereum#initialized', handleEthereumChanged);

      // Cleanup function
      return () => {
        window.removeEventListener('ethereum#initialized', handleEthereumChanged);
      };
    }
  }, []);

  return {
    provider,
    detectedWallets,
    isLoading,
    hasMultipleWallets: detectedWallets.length > 1,
  };
}