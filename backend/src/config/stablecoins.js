/**
 * Stablecoin Configuration
 * Defines supported stablecoins for different networks
 */

const STABLECOINS = {
  // Lisk Mainnet
  '1135': {
    USDC: {
      address: '0x', // TODO: Deploy or get USDC on Lisk
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      aaveSupported: false
    },
    USDT: {
      address: '0x', // TODO: Deploy or get USDT on Lisk
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      aaveSupported: false
    }
  },

  // Lisk Sepolia Testnet
  '4202': {
    USDC: {
      address: '0x', // TODO: Deploy or get test USDC on Lisk Sepolia
      symbol: 'USDC',
      name: 'USD Coin (Test)',
      decimals: 6,
      aaveSupported: false
    },
    USDT: {
      address: '0x', // TODO: Deploy or get test USDT on Lisk Sepolia
      symbol: 'USDT',
      name: 'Tether USD (Test)',
      decimals: 6,
      aaveSupported: false
    }
  },

  // Polygon Mainnet
  '137': {
    USDC: {
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // Native USDC on Polygon
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      aaveSupported: true,
      aaveAToken: '0x625E7708f30cA75bfd92586e17077590C60eb4cD'
    },
    USDT: {
      address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      aaveSupported: true,
      aaveAToken: '0x6ab707Aca953eDAeFBc4fD23bA73294241490620'
    },
    DAI: {
      address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      aaveSupported: true,
      aaveAToken: '0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE'
    }
  },

  // Arbitrum One
  '42161': {
    USDC: {
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Native USDC on Arbitrum
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      aaveSupported: true,
      aaveAToken: '0x724dc807b04555b71ed48a6896b6F41593b8C637'
    },
    USDT: {
      address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      aaveSupported: true,
      aaveAToken: '0x6ab707Aca953eDAeFBc4fD23bA73294241490620'
    },
    DAI: {
      address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      aaveSupported: true,
      aaveAToken: '0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE'
    }
  },

  // Ethereum Sepolia (Testnet)
  '11155111': {
    USDC: {
      address: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8', // Aave Faucet USDC
      symbol: 'USDC',
      name: 'USD Coin (Test)',
      decimals: 6,
      aaveSupported: true,
      aaveAToken: '0x16dA4541aD1807f4443d92D26044C1147406EB80'
    },
    DAI: {
      address: '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357',
      symbol: 'DAI',
      name: 'Dai Stablecoin (Test)',
      decimals: 18,
      aaveSupported: true,
      aaveAToken: '0x29598b72eb5CeBd806C5dCD549490FtestTEST' // Example
    }
  },

  // Optimism Sepolia (Testnet) - RECOMMENDED FOR TESTING
  '11155420': {
    USDC: {
      address: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', // Circle USDC on OP Sepolia
      symbol: 'USDC',
      name: 'USD Coin (Test)',
      decimals: 6,
      aaveSupported: true,
      aaveAToken: '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB' // Aave V3 aUSDC
    },
    USDT: {
      address: '0x8B8B06ff1c8Ac51E6ED5b6e7Df4B8D3c0E6F3c4B', // Mock USDT for testing
      symbol: 'USDT',
      name: 'Tether USD (Test)',
      decimals: 6,
      aaveSupported: false
    },
    DAI: {
      address: '0x68f180fcCe6836688e9084f035309E29Bf0A2095', // Mock DAI on OP Sepolia
      symbol: 'DAI',
      name: 'Dai Stablecoin (Test)',
      decimals: 18,
      aaveSupported: true,
      aaveAToken: '0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE' // Aave V3 aDAI
    }
  },

  // Optimism Mainnet
  '10': {
    USDC: {
      address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // Native USDC on Optimism
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      aaveSupported: true,
      aaveAToken: '0x625E7708f30cA75bfd92586e17077590C60eb4cD'
    },
    USDT: {
      address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      aaveSupported: true,
      aaveAToken: '0x6ab707Aca953eDAeFBc4fD23bA73294241490620'
    },
    DAI: {
      address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      aaveSupported: true,
      aaveAToken: '0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE'
    }
  },

  // Local development
  '31337': {
    USDC: {
      address: '0x', // Will be set after local deployment
      symbol: 'USDC',
      name: 'USD Coin (Local)',
      decimals: 6,
      aaveSupported: false
    },
    USDT: {
      address: '0x',
      symbol: 'USDT',
      name: 'Tether USD (Local)',
      decimals: 6,
      aaveSupported: false
    }
  }
};

/**
 * Get supported stablecoins for a given chain ID
 * @param {string|number} chainId - The chain ID
 * @returns {Object} Stablecoins configuration for the chain
 */
function getStablecoinsForChain(chainId) {
  const id = chainId.toString();
  return STABLECOINS[id] || {};
}

/**
 * Get all stablecoin addresses for a chain
 * @param {string|number} chainId - The chain ID
 * @returns {string[]} Array of stablecoin addresses
 */
function getStablecoinAddresses(chainId) {
  const stablecoins = getStablecoinsForChain(chainId);
  return Object.values(stablecoins)
    .map(token => token.address)
    .filter(address => address && address !== '0x');
}

/**
 * Get stablecoin info by address
 * @param {string|number} chainId - The chain ID
 * @param {string} address - The token address
 * @returns {Object|null} Stablecoin info or null
 */
function getStablecoinByAddress(chainId, address) {
  const stablecoins = getStablecoinsForChain(chainId);
  return Object.values(stablecoins).find(
    token => token.address.toLowerCase() === address.toLowerCase()
  ) || null;
}

/**
 * Check if an address is a supported stablecoin
 * @param {string|number} chainId - The chain ID
 * @param {string} address - The token address
 * @returns {boolean} True if address is a supported stablecoin
 */
function isStablecoin(chainId, address) {
  return !!getStablecoinByAddress(chainId, address);
}

/**
 * Get Aave-supported stablecoins for a chain
 * @param {string|number} chainId - The chain ID
 * @returns {Object} Aave-supported stablecoins
 */
function getAaveSupportedStablecoins(chainId) {
  const stablecoins = getStablecoinsForChain(chainId);
  const aaveCoins = {};

  Object.entries(stablecoins).forEach(([key, token]) => {
    if (token.aaveSupported) {
      aaveCoins[key] = token;
    }
  });

  return aaveCoins;
}

module.exports = {
  STABLECOINS,
  getStablecoinsForChain,
  getStablecoinAddresses,
  getStablecoinByAddress,
  isStablecoin,
  getAaveSupportedStablecoins
};
