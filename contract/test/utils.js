const { ethers } = require("hardhat");
const { expect } = require("chai");

// Test utilities and helper functions
class TestHelper {
  static async deployAddressManager() {
    const AddressManager = await ethers.getContractFactory("AddressManager");
    const addressManager = await AddressManager.deploy();
    await addressManager.waitForDeployment();
    return addressManager;
  }

  static async deployUserWallet() {
    const UserWallet = await ethers.getContractFactory("UserWallet");
    const userWallet = await UserWallet.deploy();
    await userWallet.waitForDeployment();
    return userWallet;
  }

  static async deployGroupPool() {
    const GroupPool = await ethers.getContractFactory("GroupPool");
    const groupPool = await GroupPool.deploy();
    await groupPool.waitForDeployment();
    return groupPool;
  }

  static async deployLock() {
    const currentTime = Math.floor(Date.now() / 1000);
    const unlockTime = currentTime + 3600; // 1 hour from now

    const Lock = await ethers.getContractFactory("Lock");
    const lock = await Lock.deploy(unlockTime, { value: ethers.parseEther("1") });
    await lock.waitForDeployment();
    return lock;
  }

  static async createTestUser() {
    const [owner, user1, user2, user3] = await ethers.getSigners();
    return { owner, user1, user2, user3 };
  }

  static async createTestTokens() {
    const Token = await ethers.getContractFactory("ERC20Mock");
    const token1 = await Token.deploy("Test Token 1", "TT1", ethers.parseEther("1000000"));
    const token2 = await Token.deploy("Test Token 2", "TT2", ethers.parseEther("1000000"));
    await token1.waitForDeployment();
    await token2.waitForDeployment();
    return { token1, token2 };
  }

  static async hashEmail(email) {
    return ethers.keccak256(ethers.toUtf8Bytes(email));
  }

  static async expectRevert(promise, expectedMessage) {
    try {
      await promise;
      expect.fail("Expected transaction to revert");
    } catch (error) {
      if (expectedMessage) {
        expect(error.message).to.include(expectedMessage);
      }
    }
  }

  static async advanceTime(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine");
  }

  static async getCurrentTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  }

  static async getBalance(address) {
    return await ethers.provider.getBalance(address);
  }

  static formatEther(amount) {
    return ethers.formatEther(amount);
  }

  static parseEther(amount) {
    return ethers.parseEther(amount.toString());
  }
}

module.exports = TestHelper;
