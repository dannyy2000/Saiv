const { ethers } = require("hardhat");

module.exports = {
  networks: {
    hardhat: {
      chainId: 1337,
      gas: 12000000,
      gasPrice: 1,
      blockGasLimit: 12000000,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        accountsBalance: ethers.parseEther("1000").toString()
      }
    }
  },
  mocha: {
    timeout: 100000,
    reporter: 'spec',
    reporterOptions: {
      output: 'out.json'
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: 'ETH',
    gasPrice: 1
  }
};