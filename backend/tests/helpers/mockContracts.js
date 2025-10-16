const { ethers } = require('ethers');

/**
 * Mock contract responses for testing
 */
class MockContractHelpers {
  /**
   * Create a mock transaction response
   */
  static createMockTransaction(hash = null) {
    const txHash = hash || `0x${Math.random().toString(16).substr(2, 64)}`;
    return {
      hash: txHash,
      wait: jest.fn().mockResolvedValue({
        blockNumber: 12345,
        transactionHash: txHash,
        status: 1
      })
    };
  }

  /**
   * Mock ethers Contract
   */
  static mockContract(methods = {}) {
    const defaultMethods = {
      supplyToAave: jest.fn().mockResolvedValue(this.createMockTransaction()),
      getATokenBalance: jest.fn().mockResolvedValue(ethers.parseEther('5.1')),
      getAaveYield: jest.fn().mockResolvedValue(ethers.parseEther('0.1')),
      sendEth: jest.fn().mockResolvedValue(this.createMockTransaction()),
      transferToWallet: jest.fn().mockResolvedValue(this.createMockTransaction()),
      contribute: jest.fn().mockResolvedValue(this.createMockTransaction()),
      contributeToken: jest.fn().mockResolvedValue(this.createMockTransaction()),
      completeCurrentWindow: jest.fn().mockResolvedValue(this.createMockTransaction()),
    };

    return {
      ...defaultMethods,
      ...methods
    };
  }

  /**
   * Mock aaveService
   */
  static mockAaveService() {
    return {
      initialize: jest.fn().mockResolvedValue(true),
      isReady: jest.fn().mockReturnValue(true),
      supplyPersonalSavingsToAave: jest.fn().mockResolvedValue({
        success: true,
        transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
        blockNumber: 12345,
        aTokenBalance: ethers.parseEther('5.1').toString(),
        suppliedAmount: ethers.parseEther('5.0').toString()
      }),
      supplyGroupPoolToAave: jest.fn().mockResolvedValue({
        success: true,
        transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
        blockNumber: 12345,
        aTokenBalance: ethers.parseEther('10.2').toString(),
        suppliedAmount: ethers.parseEther('10.0').toString()
      }),
      getATokenBalance: jest.fn().mockResolvedValue(ethers.parseEther('5.1').toString()),
      getAaveYield: jest.fn().mockResolvedValue(ethers.parseEther('0.1').toString())
    };
  }

  /**
   * Mock contractService
   */
  static mockContractService() {
    return {
      initialize: jest.fn().mockResolvedValue(true),
      callGroupPoolFunction: jest.fn().mockResolvedValue({
        transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
        blockNumber: 12345
      })
    };
  }
}

module.exports = MockContractHelpers;
