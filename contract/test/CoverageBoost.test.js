const { expect } = require("chai");
const { ethers } = require("hardhat");
const TestHelper = require("./utils");

describe("Coverage Boost Tests", function () {
  let addressManager, groupPool, userWallet, owner, user1, user2;
  let token1;

  beforeEach(async function () {
    ({ owner, user1, user2 } = await TestHelper.createTestUser());
    ({ token1 } = await TestHelper.createTestTokens());
    addressManager = await TestHelper.deployAddressManager();
  });

  describe("AddressManager Uncovered Lines", function () {
    it("Should get group pool by identifier", async function () {
      // Line 363: getGroupPool function
      const groupIdentifier = `${owner.address}_${Date.now()}`;

      await addressManager.createGroupPool(
        groupIdentifier,
        owner.address,
        "Test Group",
        7 * 24 * 60 * 60,
        ethers.parseEther("0.01"),
        10
      );

      const poolAddress = await addressManager.getGroupPool(groupIdentifier);
      expect(poolAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should remove member from group pool", async function () {
      // Lines 411-414: removeMemberFromGroupPool function
      const groupIdentifier = `${owner.address}_${Date.now()}`;

      await addressManager.createGroupPool(
        groupIdentifier,
        owner.address,
        "Test Group",
        7 * 24 * 60 * 60,
        ethers.parseEther("0.01"),
        10
      );

      const poolAddress = await addressManager.getGroupPool(groupIdentifier);

      // Add a member first
      await addressManager.addMemberToGroupPool(poolAddress, user1.address);

      // Remove the member
      await addressManager.removeMemberFromGroupPool(poolAddress, user1.address);

      const GroupPool = await ethers.getContractFactory("GroupPool");
      const pool = GroupPool.attach(poolAddress);
      expect(await pool.isGroupMember(user1.address)).to.be.false;
    });
  });

  describe("UserWallet Emergency Functions", function () {
    beforeEach(async function () {
      userWallet = await TestHelper.deployUserWallet();
      await userWallet.initialize(owner.address, user1.address);

      // Fund with ETH
      await owner.sendTransaction({
        to: userWallet.target,
        value: ethers.parseEther("5")
      });

      // Add and fund token
      await userWallet.addSupportedToken(token1.target);
      await token1.mint(owner.address, ethers.parseEther("1000"));
      await token1.approve(userWallet.target, ethers.parseEther("100"));
      await userWallet.depositToken(token1.target, ethers.parseEther("100"));
    });

    it("Should handle emergency token withdrawal", async function () {
      const initialBalance = await token1.balanceOf(owner.address);

      await userWallet.emergencyWithdrawToken(token1.target);

      const finalBalance = await token1.balanceOf(owner.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("Should send ETH to another address", async function () {
      const sendAmount = ethers.parseEther("1");
      const initialBalance = await ethers.provider.getBalance(user2.address);

      await userWallet.sendEth(user2.address, sendAmount);

      const finalBalance = await ethers.provider.getBalance(user2.address);
      expect(finalBalance).to.equal(initialBalance + sendAmount);
    });

    it("Should remove supported token", async function () {
      expect(await userWallet.isTokenSupported(token1.target)).to.be.true;

      await userWallet.removeSupportedToken(token1.target);

      expect(await userWallet.isTokenSupported(token1.target)).to.be.false;
    });

    it("Should sync token balance", async function () {
      // Send tokens directly to wallet (bypassing deposit)
      await token1.transfer(userWallet.target, ethers.parseEther("50"));

      // Balance should be out of sync
      const internalBalance = await userWallet.getTokenBalance(token1.target);
      const actualBalance = await token1.balanceOf(userWallet.target);

      expect(actualBalance).to.be.gt(internalBalance);

      // Sync the balance
      await userWallet.syncTokenBalance(token1.target);

      const syncedBalance = await userWallet.getTokenBalance(token1.target);
      expect(syncedBalance).to.equal(actualBalance);
    });
  });

  describe("ERC20Mock Coverage", function () {
    it("Should mint tokens", async function () {
      const initialSupply = await token1.totalSupply();
      await token1.mint(user1.address, ethers.parseEther("1000"));
      const finalSupply = await token1.totalSupply();

      expect(finalSupply).to.equal(initialSupply + ethers.parseEther("1000"));
    });
  });
});
