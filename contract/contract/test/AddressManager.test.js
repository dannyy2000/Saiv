const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AddressManager", function () {
  let addressManager;
  let owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const AddressManager = await ethers.getContractFactory("AddressManager");
    addressManager = await AddressManager.deploy();
    await addressManager.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await addressManager.owner()).to.equal(owner.address);
    });

    it("Should deploy implementations", async function () {
      const walletImpl = await addressManager.walletImplementation();
      const poolImpl = await addressManager.groupPoolImplementation();
      
      expect(walletImpl).to.not.equal(ethers.ZeroAddress);
      expect(poolImpl).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("User Wallet Creation", function () {
    it("Should create user wallets", async function () {
      await addressManager.createUserWallets(user1.address);

      const mainWallet = await addressManager.getUserMainWallet(user1.address);
      const savingsWallet = await addressManager.getUserSavingsWallet(user1.address);

      expect(mainWallet).to.not.equal(ethers.ZeroAddress);
      expect(savingsWallet).to.not.equal(ethers.ZeroAddress);
    });

    it("Should prevent duplicate wallets", async function () {
      await addressManager.createUserWallets(user1.address);

      await expect(
        addressManager.createUserWallets(user1.address)
      ).to.be.revertedWith("Wallets already exist");
    });
  });

  describe("Group Pool Creation", function () {
    it("Should create group pool", async function () {
      const groupId = "test_group_123";
      
      await addressManager.createGroupPool(
        groupId,
        user1.address,
        "Test Group",
        86400,
        0,
        10
      );

      const poolAddress = await addressManager.getGroupPool(groupId);
      expect(poolAddress).to.not.equal(ethers.ZeroAddress);
    });
  });
});
