const mongoose = require('mongoose');
const { ethers } = require('ethers');

/**
 * Test data fixtures
 */
module.exports = {
  // Test user data
  testUser: {
    email: 'test@example.com',
    eoaAddress: '0x' + '1'.repeat(40),
    address: '0x' + '2'.repeat(40), // Main wallet
    savingsAddress: '0x' + '3'.repeat(40), // Savings wallet
    password: 'Test123!@#',
    registrationType: 'email', 

    profile: {
      firstName: 'Test',
      lastName: 'User'
    }
  },

  testUser2: {
    email: 'test2@example.com',
    eoaAddress: '0x' + '4'.repeat(40),
    address: '0x' + '5'.repeat(40),
    savingsAddress: '0x' + '6'.repeat(40),
    password: 'Test123!@#',
    registrationType: 'wallet', 
    profile: {
      firstName: 'Test2',
      lastName: 'User2'
    }
  },

  // Test group data
  testGroup: {
    name: 'Test Savings Group',
    description: 'A test group for savings',
    address: '0x' + '7'.repeat(40), // GroupPool contract
    paymentWindowDuration: 86400, // 1 day
    poolSettings: {
      minContribution: '0.1',
      maxMembers: 10,
      isPrivate: false,
      contributionFrequency: 'weekly'
    }
  },

  // Test savings data
  testPersonalSavings: {
    name: 'My ETH Savings',
    description: 'Personal ETH savings with Aave yield',
    type: 'personal',
    currency: 'ETH',
    tokenAddress: null,
    targetAmount: '10',
    currentAmount: '0',
    settings: {
      autoSave: false,
      allowWithdrawal: true,
      lockUntilTarget: false
    }
  },

  testGroupSavings: {
    name: 'Group ETH Savings',
    description: 'Group ETH savings with Aave yield',
    type: 'group',
    currency: 'ETH',
    tokenAddress: null,
    targetAmount: '50',
    currentAmount: '0'
  },

  // Contract addresses
  contracts: {
    aavePool: '0x' + 'a'.repeat(40),
    aETH: '0x' + 'b'.repeat(40),
    usdc: '0x' + 'c'.repeat(40),
    aUSDC: '0x' + 'd'.repeat(40)
  },

  // Test amounts
  amounts: {
    smallEth: '1.0',
    mediumEth: '5.0',
    largeEth: '10.0',
    smallEthWei: ethers.parseEther('1.0').toString(),
    mediumEthWei: ethers.parseEther('5.0').toString(),
    largeEthWei: ethers.parseEther('10.0').toString()
  }
};
