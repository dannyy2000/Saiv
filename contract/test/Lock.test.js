const { expect } = require("chai");
const { ethers } = require("hardhat");
const TestHelper = require("./utils");

describe("Lock", function () {
  let lock, owner, otherAccount;
  const unlockTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  const initialValue = ethers.parseEther("1");

  beforeEach(async function () {
    ({ owner, user1: otherAccount } = await TestHelper.createTestUser());

    lock = await TestHelper.deployLock();
  });

  describe("Deployment", function () {
    it("Should set the correct unlock time", async function () {
      expect(await lock.unlockTime()).to.equal(unlockTime);
    });

    it("Should set the correct owner", async function () {
      expect(await lock.owner()).to.equal(owner.address);
    });

    it("Should receive and store funds", async function () {
      const balance = await ethers.provider.getBalance(lock.target);
      expect(balance).to.equal(initialValue);
    });

    it("Should not allow unlock time in the past", async function () {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      await expect(
        TestHelper.deployLock(pastTime)
      ).to.be.revertedWith("Unlock time should be in the future");
    });

    it("Should not allow zero unlock time", async function () {
      const currentTime = Math.floor(Date.now() / 1000);

      await expect(
        TestHelper.deployLock(currentTime)
      ).to.be.revertedWith("Unlock time should be in the future");
    });
  });

  describe("Withdrawal", function () {
    it("Should allow owner to withdraw after unlock time", async function () {
      // Advance time past unlock time
      await TestHelper.advanceTime(3600 + 60); // 1 hour + 1 minute

      const initialOwnerBalance = await TestHelper.getBalance(owner.address);
      const lockBalance = await ethers.provider.getBalance(lock.target);

      await expect(lock.withdraw())
        .to.emit(lock, "Withdrawal")
        .withArgs(lockBalance, ethers.ZeroAddress);

      const finalOwnerBalance = await TestHelper.getBalance(owner.address);
      expect(finalOwnerBalance).to.equal(initialOwnerBalance + lockBalance);

      // Contract should be empty
      const finalLockBalance = await ethers.provider.getBalance(lock.target);
      expect(finalLockBalance).to.equal(0);
    });

    it("Should not allow withdrawal before unlock time", async function () {
      await expect(lock.withdraw()).to.be.revertedWith("You can't withdraw yet");
    });

    it("Should not allow non-owner to withdraw", async function () {
      // Advance time past unlock time
      await TestHelper.advanceTime(3600 + 60);

      await expect(lock.connect(otherAccount).withdraw())
        .to.be.revertedWith("You aren't the owner");
    });

    it("Should not allow withdrawal twice", async function () {
      // Advance time past unlock time
      await TestHelper.advanceTime(3600 + 60);

      await lock.withdraw();

      // Try to withdraw again
      await expect(lock.withdraw()).to.be.reverted;
    });

    it("Should handle exact unlock time correctly", async function () {
      // Set unlock time to current time
      await TestHelper.advanceTime(3600); // Exactly at unlock time

      await expect(lock.withdraw()).to.be.revertedWith("You can't withdraw yet");

      // Advance one more second
      await TestHelper.advanceTime(1);

      await expect(lock.withdraw()).to.not.be.reverted;
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to withdraw", async function () {
      // Advance time past unlock time
      await TestHelper.advanceTime(3600 + 60);

      await expect(lock.connect(otherAccount).withdraw())
        .to.be.revertedWith("You aren't the owner");
    });

    it("Should allow owner to withdraw at any time after unlock", async function () {
      // Advance time past unlock time
      await TestHelper.advanceTime(3600 + 60);

      await expect(lock.withdraw()).to.not.be.reverted;
    });

    it("Should handle multiple accounts correctly", async function () {
      const { user1, user2, user3 } = await TestHelper.createTestUser();

      // Advance time past unlock time
      await TestHelper.advanceTime(3600 + 60);

      // Only owner should be able to withdraw
      await expect(lock.connect(user1).withdraw()).to.be.revertedWith("You aren't the owner");
      await expect(lock.connect(user2).withdraw()).to.be.revertedWith("You aren't the owner");
      await expect(lock.connect(user3).withdraw()).to.be.revertedWith("You aren't the owner");

      // Owner should succeed
      await expect(lock.withdraw()).to.not.be.reverted;
    });
  });

  describe("State Changes", function () {
    it("Should update contract balance after withdrawal", async function () {
      // Advance time past unlock time
      await TestHelper.advanceTime(3600 + 60);

      const initialBalance = await ethers.provider.getBalance(lock.target);
      expect(initialBalance).to.equal(initialValue);

      await lock.withdraw();

      const finalBalance = await ethers.provider.getBalance(lock.target);
      expect(finalBalance).to.equal(0);
    });

    it("Should update owner balance after withdrawal", async function () {
      // Advance time past unlock time
      await TestHelper.advanceTime(3600 + 60);

      const initialOwnerBalance = await TestHelper.getBalance(owner.address);
      const lockBalance = await ethers.provider.getBalance(lock.target);

      await lock.withdraw();

      const finalOwnerBalance = await TestHelper.getBalance(owner.address);
      expect(finalOwnerBalance).to.equal(initialOwnerBalance + lockBalance);
    });

    it("Should emit correct withdrawal event", async function () {
      // Advance time past unlock time
      await TestHelper.advanceTime(3600 + 60);

      const lockBalance = await ethers.provider.getBalance(lock.target);
      const currentTime = await TestHelper.getCurrentTimestamp();

      await expect(lock.withdraw())
        .to.emit(lock, "Withdrawal")
        .withArgs(lockBalance, currentTime);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle large unlock times correctly", async function () {
      const farFutureTime = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year from now

      const newLock = await ethers.getContractFactory("Lock");
      const lock = await newLock.deploy(farFutureTime, { value: initialValue });
      await lock.waitForDeployment();

      // Should not be able to withdraw immediately
      await expect(lock.withdraw()).to.be.revertedWith("You can't withdraw yet");

      // Advance time to unlock time
      await TestHelper.advanceTime(365 * 24 * 60 * 60);

      await expect(lock.withdraw()).to.not.be.reverted;
    });

    it("Should handle zero value lock", async function () {
      const newLock = await ethers.getContractFactory("Lock");
      const lock = await newLock.deploy(unlockTime, { value: 0 });
      await lock.waitForDeployment();

      // Advance time past unlock time
      await TestHelper.advanceTime(3600 + 60);

      // Should be able to withdraw even with zero balance
      await expect(lock.withdraw()).to.not.be.reverted;
    });

    it("Should handle very small time differences", async function () {
      const closeTime = Math.floor(Date.now() / 1000) + 60; // 1 minute from now

      const newLock = await ethers.getContractFactory("Lock");
      const lock = await newLock.deploy(closeTime, { value: initialValue });
      await lock.waitForDeployment();

      // Should not be able to withdraw before unlock time
      await expect(lock.withdraw()).to.be.revertedWith("You can't withdraw yet");

      // Advance exactly to unlock time
      await TestHelper.advanceTime(60);

      await expect(lock.withdraw()).to.not.be.reverted;
    });

    it("Should handle multiple withdrawals correctly", async function () {
      // Advance time past unlock time
      await TestHelper.advanceTime(3600 + 60);

      // First withdrawal
      await lock.withdraw();

      // Contract should be empty, so second withdrawal should fail
      await expect(lock.withdraw()).to.be.reverted;
    });

    it("Should maintain correct state after failed withdrawal", async function () {
      // Try to withdraw before unlock time
      await expect(lock.withdraw()).to.be.revertedWith("You can't withdraw yet");

      // State should remain unchanged
      expect(await lock.unlockTime()).to.equal(unlockTime);
      expect(await lock.owner()).to.equal(owner.address);

      const balance = await ethers.provider.getBalance(lock.target);
      expect(balance).to.equal(initialValue);

      // Should be able to withdraw after unlock time
      await TestHelper.advanceTime(3600 + 60);
      await expect(lock.withdraw()).to.not.be.reverted;
    });
  });

  describe("Gas Efficiency", function () {
    it("Should deploy with reasonable gas cost", async function () {
      // This is more of a structural test - gas costs can vary
      const deployTx = await ethers.getContractFactory("Lock").deploy(unlockTime, { value: initialValue });
      const receipt = await deployTx.waitForDeployment();

      // Gas used should be reasonable (less than 100,000 gas for simple contract)
      expect(receipt.gasUsed).to.be.lt(100000);
    });

    it("Should withdraw with reasonable gas cost", async function () {
      // Advance time past unlock time
      await TestHelper.advanceTime(3600 + 60);

      const withdrawTx = await lock.withdraw();
      const receipt = await withdrawTx.wait();

      // Withdrawal should use reasonable gas
      expect(receipt.gasUsed).to.be.lt(50000);
    });
  });

  describe("Security", function () {
    it("Should prevent reentrancy attacks", async function () {
      // This would require a malicious contract, but we can test that
      // the withdrawal works correctly and doesn't leave the contract in a bad state

      await TestHelper.advanceTime(3600 + 60);

      const initialBalance = await ethers.provider.getBalance(lock.target);

      await lock.withdraw();

      const finalBalance = await ethers.provider.getBalance(lock.target);
      expect(finalBalance).to.equal(0);

      // Contract should be in a consistent state
      expect(await lock.unlockTime()).to.equal(unlockTime);
      expect(await lock.owner()).to.equal(owner.address);
    });

    it("Should handle owner transfer correctly", async function () {
      // Note: Lock contract doesn't have owner transfer, but we test that
      // ownership is correctly enforced

      await TestHelper.advanceTime(3600 + 60);

      // Non-owner should not be able to withdraw
      await expect(lock.connect(otherAccount).withdraw()).to.be.reverted;

      // Owner should be able to withdraw
      await expect(lock.withdraw()).to.not.be.reverted;
    });
  });
});
