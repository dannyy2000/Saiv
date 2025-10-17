const { expect } = require("chai");
const { ethers } = require("hardhat");
const TestHelper = require("./utils");

describe("AddressManager", function () {
  let addressManager, owner, user1, user2, user3;
  let walletImplementation, groupPoolImplementation;

  beforeEach(async function () {
    // Deploy AddressManager
    addressManager = await TestHelper.deployAddressManager();
    ({ owner, user1, user2, user3 } = await TestHelper.createTestUser());

    // Get implementation contracts
    walletImplementation = await addressManager.walletImplementation();
    groupPoolImplementation = await addressManager.groupPoolImplementation();
  });

  describe("Deployment", function () {
    it("Should deploy correctly", async function () {
      expect(addressManager.target).to.not.equal(ethers.ZeroAddress);
      expect(await addressManager.owner()).to.equal(owner.address);
    });

    it("Should deploy wallet implementation", async function () {
      expect(walletImplementation).to.not.equal(ethers.ZeroAddress);
    });

    it("Should deploy group pool implementation", async function () {
      expect(groupPoolImplementation).to.not.equal(ethers.ZeroAddress);
    });

    it("Should initialize with correct owner", async function () {
      expect(await addressManager.owner()).to.equal(owner.address);
    });
  });

  describe("User Wallet Creation", function () {
    describe("EOA User Wallets", function () {
      it("Should create wallets for EOA user", async function () {
        const tx = await addressManager.createUserWallets(user1.address);

        // Check that events were emitted
        await expect(tx).to.emit(addressManager, "UserWalletsCreated");
        await expect(tx).to.emit(addressManager, "WalletDeployed");

        // Check mappings
        const mainWallet = await addressManager.userToMainWallet(user1.address);
        const savingsWallet = await addressManager.userToSavingsWallet(user1.address);

        expect(mainWallet).to.not.equal(ethers.ZeroAddress);
        expect(savingsWallet).to.not.equal(ethers.ZeroAddress);
        expect(mainWallet).to.not.equal(savingsWallet);

        // Check reverse mappings
        expect(await addressManager.walletToUser(mainWallet)).to.equal(user1.address);
        expect(await addressManager.walletToUser(savingsWallet)).to.equal(user1.address);
      });

      it("Should not create wallets for zero address", async function () {
        await expect(
          addressManager.createUserWallets(ethers.ZeroAddress)
        ).to.be.revertedWith("Invalid user identifier");
      });

      it("Should not create duplicate wallets", async function () {
        await addressManager.createUserWallets(user1.address);

        await expect(
          addressManager.createUserWallets(user1.address)
        ).to.be.revertedWith("Wallets already exist");
      });

      it("Should predict wallet addresses correctly", async function () {
        // Get the timestamp that will be used in the next block
        const block = await ethers.provider.getBlock('latest');
        const nextTimestamp = block.timestamp + 1;

        // Set next block timestamp
        await ethers.provider.send("evm_setNextBlockTimestamp", [nextTimestamp]);

        const predictedMain = await addressManager.predictMainWalletAddress(user1.address, nextTimestamp);
        const predictedSavings = await addressManager.predictSavingsWalletAddress(user1.address, nextTimestamp);

        await addressManager.createUserWallets(user1.address);

        const actualMain = await addressManager.userToMainWallet(user1.address);
        const actualSavings = await addressManager.userToSavingsWallet(user1.address);

        expect(actualMain).to.equal(predictedMain);
        expect(actualSavings).to.equal(predictedSavings);
      });

      it("Should retrieve wallets correctly", async function () {
        await addressManager.createUserWallets(user1.address);

        const mainWallet = await addressManager.getUserMainWallet(user1.address);
        const savingsWallet = await addressManager.getUserSavingsWallet(user1.address);

        expect(mainWallet).to.not.equal(ethers.ZeroAddress);
        expect(savingsWallet).to.not.equal(ethers.ZeroAddress);
      });
    });

    describe("Email User Wallets", function () {
      it("Should create wallets for email user", async function () {
        const email = "test@example.com";
        const emailHash = await TestHelper.hashEmail(email);

        const tx = await addressManager.createEmailUserWallets(emailHash, user1.address);

        // Check that event was emitted
        await expect(tx).to.emit(addressManager, "EmailUserWalletsCreated");

        // Check mappings
        const mainWallet = await addressManager.getEmailUserMainWallet(emailHash);
        const savingsWallet = await addressManager.getEmailUserSavingsWallet(emailHash);

        expect(mainWallet).to.not.equal(ethers.ZeroAddress);
        expect(savingsWallet).to.not.equal(ethers.ZeroAddress);
      });

      it("Should not create wallets for invalid email hash", async function () {
        await expect(
          addressManager.createEmailUserWallets(ethers.ZeroHash, user1.address)
        ).to.be.revertedWith("Invalid email hash");
      });

      it("Should not create wallets for invalid user identifier", async function () {
        const emailHash = await TestHelper.hashEmail("test@example.com");

        await expect(
          addressManager.createEmailUserWallets(emailHash, ethers.ZeroAddress)
        ).to.be.revertedWith("Invalid user identifier");
      });

      it("Should not create duplicate email wallets", async function () {
        const emailHash = await TestHelper.hashEmail("test@example.com");

        await addressManager.createEmailUserWallets(emailHash, user1.address);

        await expect(
          addressManager.createEmailUserWallets(emailHash, user2.address)
        ).to.be.revertedWith("Wallets already exist");
      });
    });

    describe("Wallet Management", function () {
      beforeEach(async function () {
        await addressManager.createUserWallets(user1.address);
      });

      it("Should track all wallets", async function () {
        const totalWallets = await addressManager.getTotalWallets();
        expect(totalWallets).to.equal(2); // main + savings

        const wallet1 = await addressManager.getWalletAtIndex(0);
        const wallet2 = await addressManager.getWalletAtIndex(1);

        expect(wallet1).to.not.equal(ethers.ZeroAddress);
        expect(wallet2).to.not.equal(ethers.ZeroAddress);
        expect(wallet1).to.not.equal(wallet2);
      });

      it("Should get wallet owner", async function () {
        const mainWallet = await addressManager.userToMainWallet(user1.address);
        const walletOwner = await addressManager.getWalletOwner(mainWallet);

        expect(walletOwner).to.equal(user1.address);
      });

      it("Should add supported token to wallet", async function () {
        const { token1 } = await TestHelper.createTestTokens();
        const mainWallet = await addressManager.userToMainWallet(user1.address);

        await addressManager.addSupportedTokenToWallet(mainWallet, token1.target);

        // Check if token is supported by calling wallet directly
        const UserWallet = await ethers.getContractFactory("UserWallet");
        const wallet = UserWallet.attach(mainWallet);
        expect(await wallet.isTokenSupported(token1.target)).to.be.true;
      });

      it("Should add supported token to all wallets", async function () {
        const { token1 } = await TestHelper.createTestTokens();

        await addressManager.addSupportedTokenToAllWallets(token1.target);

        const mainWallet = await addressManager.userToMainWallet(user1.address);
        const savingsWallet = await addressManager.userToSavingsWallet(user1.address);

        const UserWallet = await ethers.getContractFactory("UserWallet");
        const mainWalletContract = UserWallet.attach(mainWallet);
        const savingsWalletContract = UserWallet.attach(savingsWallet);

        expect(await mainWalletContract.isTokenSupported(token1.target)).to.be.true;
        expect(await savingsWalletContract.isTokenSupported(token1.target)).to.be.true;
      });
    });
  });

  describe("Group Pool Management", function () {
    let groupIdentifier, groupName, paymentWindowDuration, minContribution, maxMembers;

    beforeEach(async function () {
      groupIdentifier = "test_group_1";
      groupName = "Test Savings Group";
      paymentWindowDuration = 30 * 24 * 60 * 60; // 30 days
      minContribution = ethers.parseEther("0.01");
      maxMembers = 10;
    });

    it("Should create group pool", async function () {
      const tx = await addressManager.createGroupPool(
        groupIdentifier,
        user1.address,
        groupName,
        paymentWindowDuration,
        minContribution,
        maxMembers
      );

      // Check that event was emitted
      await expect(tx).to.emit(addressManager, "GroupPoolCreated");

      const poolAddress = await addressManager.groupToPool(groupIdentifier);
      expect(poolAddress).to.not.equal(ethers.ZeroAddress);

      // Check reverse mapping
      const retrievedIdentifier = await addressManager.getGroupIdentifier(poolAddress);
      expect(retrievedIdentifier).to.equal(groupIdentifier);
    });

    it("Should not create pool with empty identifier", async function () {
      await expect(
        addressManager.createGroupPool(
          "",
          user1.address,
          groupName,
          paymentWindowDuration,
          minContribution,
          maxMembers
        )
      ).to.be.revertedWith("Invalid group identifier");
    });

    it("Should not create pool with zero owner", async function () {
      await expect(
        addressManager.createGroupPool(
          groupIdentifier,
          ethers.ZeroAddress,
          groupName,
          paymentWindowDuration,
          minContribution,
          maxMembers
        )
      ).to.be.revertedWith("Invalid group owner");
    });

    it("Should not create duplicate group pool", async function () {
      await addressManager.createGroupPool(
        groupIdentifier,
        user1.address,
        groupName,
        paymentWindowDuration,
        minContribution,
        maxMembers
      );

      await expect(
        addressManager.createGroupPool(
          groupIdentifier,
          user2.address,
          "Different Name",
          paymentWindowDuration,
          minContribution,
          maxMembers
        )
      ).to.be.revertedWith("Group pool already exists");
    });

    it("Should not create pool with zero payment window duration", async function () {
      await expect(
        addressManager.createGroupPool(
          groupIdentifier,
          user1.address,
          groupName,
          0,
          minContribution,
          maxMembers
        )
      ).to.be.revertedWith("Invalid payment window duration");
    });

    it("Should track all group pools", async function () {
      await addressManager.createGroupPool(
        groupIdentifier,
        user1.address,
        groupName,
        paymentWindowDuration,
        minContribution,
        maxMembers
      );

      const totalPools = await addressManager.getTotalGroupPools();
      expect(totalPools).to.equal(1);

      const pool = await addressManager.getGroupPoolAtIndex(0);
      expect(pool).to.not.equal(ethers.ZeroAddress);
    });

    it("Should add member to group pool", async function () {
      await addressManager.createGroupPool(
        groupIdentifier,
        user1.address,
        groupName,
        paymentWindowDuration,
        minContribution,
        maxMembers
      );

      const poolAddress = await addressManager.groupToPool(groupIdentifier);

      await addressManager.addMemberToGroupPool(poolAddress, user2.address);

      const GroupPool = await ethers.getContractFactory("GroupPool");
      const pool = GroupPool.attach(poolAddress);
      expect(await pool.isGroupMember(user2.address)).to.be.true;
    });

    it("Should add supported token to group pool", async function () {
      await addressManager.createGroupPool(
        groupIdentifier,
        user1.address,
        groupName,
        paymentWindowDuration,
        minContribution,
        maxMembers
      );

      const { token1 } = await TestHelper.createTestTokens();
      const poolAddress = await addressManager.groupToPool(groupIdentifier);

      await addressManager.addSupportedTokenToGroupPool(poolAddress, token1.target);

      const GroupPool = await ethers.getContractFactory("GroupPool");
      const pool = GroupPool.attach(poolAddress);
      expect(await pool.supportedTokens(token1.target)).to.be.true;
    });
  });

  describe("Ownership", function () {
    it("Should transfer ownership", async function () {
      await addressManager.transferOwnership(user1.address);
      expect(await addressManager.owner()).to.equal(user1.address);
    });

    it("Should not transfer ownership to zero address", async function () {
      await expect(
        addressManager.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("New owner cannot be zero address");
    });

    it("Should not transfer ownership if not owner", async function () {
      await expect(
        addressManager.connect(user1).transferOwnership(user2.address)
      ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should execute emergency call", async function () {
      // This would typically be used for emergency wallet operations
      const data = "0x"; // Empty call data for testing
      const result = await addressManager.emergencyCall(user1.address, data);
      expect(result).to.not.be.null;
    });

    it("Should not execute emergency call if not owner", async function () {
      await expect(
        addressManager.connect(user1).emergencyCall(user2.address, "0x")
      ).to.be.revertedWith("Only owner can call this function");
    });
  });

  describe("Access Control", function () {
    it("Should restrict wallet token operations to owner only", async function () {
      await expect(
        addressManager.connect(user1).addSupportedTokenToWallet(user2.address, user3.address)
      ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should restrict pool member operations to owner only", async function () {
      await addressManager.createGroupPool(
        "test_group",
        user1.address,
        "Test Group",
        30 * 24 * 60 * 60,
        ethers.parseEther("0.01"),
        10
      );

      const poolAddress = await addressManager.groupToPool("test_group");

      await expect(
        addressManager.connect(user1).addMemberToGroupPool(poolAddress, user2.address)
      ).to.be.revertedWith("Only owner can call this function");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple users correctly", async function () {
      await addressManager.createUserWallets(user1.address);
      await addressManager.createUserWallets(user2.address);
      await addressManager.createUserWallets(user3.address);

      const totalWallets = await addressManager.getTotalWallets();
      expect(totalWallets).to.equal(6); // 3 users × 2 wallets each

      const user1Main = await addressManager.getUserMainWallet(user1.address);
      const user2Main = await addressManager.getUserMainWallet(user2.address);
      const user3Main = await addressManager.getUserMainWallet(user3.address);

      expect(user1Main).to.not.equal(user2Main);
      expect(user2Main).to.not.equal(user3Main);
      expect(user1Main).to.not.equal(user3Main);
    });

    it("Should handle multiple group pools correctly", async function () {
      const groupNames = ["Group1", "Group2", "Group3"];

      for (let i = 0; i < groupNames.length; i++) {
        await addressManager.createGroupPool(
          `group_${i}`,
          user1.address,
          groupNames[i],
          30 * 24 * 60 * 60,
          ethers.parseEther("0.01"),
          10
        );
      }

      const totalPools = await addressManager.getTotalGroupPools();
      expect(totalPools).to.equal(3);
    });
  });
});
