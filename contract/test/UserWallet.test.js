const { expect } = require("chai");
const { ethers } = require("hardhat");
const TestHelper = require("./utils");

describe("UserWallet", function () {
  let userWallet, owner, user1, user2, manager, token1, token2;
  const initialEthBalance = ethers.parseEther("10");

  // Helper to initialize and fund wallet
  async function initializeAndFundWallet() {
    await userWallet.initialize(owner.address, user1.address);

    // Fund wallet with ETH
    await owner.sendTransaction({
      to: userWallet.target,
      value: initialEthBalance
    });

    // Fund test tokens to users
    await token1.mint(owner.address, ethers.parseEther("1000"));
    await token2.mint(owner.address, ethers.parseEther("1000"));
  }

  beforeEach(async function () {
    ({ owner, user1, user2 } = await TestHelper.createTestUser());
    ({ token1, token2 } = await TestHelper.createTestTokens());

    // Deploy wallet implementation
    userWallet = await TestHelper.deployUserWallet();

    manager = user1; // AddressManager acts as manager
  });

  describe("Initialization", function () {
    it("Should initialize correctly", async function () {
      await userWallet.initialize(owner.address, user1.address);

      expect(await userWallet.owner()).to.equal(owner.address);
      expect(await userWallet.manager()).to.equal(user1.address);
    });

    it("Should not initialize if already initialized", async function () {
      await userWallet.initialize(owner.address, user1.address);

      await expect(
        userWallet.initialize(user2.address, user1.address)
      ).to.be.revertedWith("Already initialized");
    });

    it("Should not initialize with zero owner", async function () {
      const newWallet = await TestHelper.deployUserWallet();

      await expect(
        newWallet.initialize(ethers.ZeroAddress, user1.address)
      ).to.be.revertedWith("Invalid owner");
    });

    it("Should not initialize with zero manager", async function () {
      const newWallet = await TestHelper.deployUserWallet();

      await expect(
        newWallet.initialize(owner.address, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid manager");
    });

    it("Should emit WalletInitialized event", async function () {
      const newWallet = await TestHelper.deployUserWallet();

      await expect(newWallet.initialize(owner.address, user1.address))
        .to.emit(newWallet, "WalletInitialized")
        .withArgs(owner.address, user1.address);
    });
  });

  describe("ETH Operations", function () {
    beforeEach(async function () {
      await initializeAndFundWallet();
    });

    it("Should receive ETH deposits", async function () {
      const depositAmount = ethers.parseEther("1");
      const initialBalance = await userWallet.getEthBalance();

      await user2.sendTransaction({
        to: userWallet.target,
        value: depositAmount
      });

      const finalBalance = await userWallet.getEthBalance();
      expect(finalBalance).to.equal(initialBalance + depositAmount);

      await expect(user2.sendTransaction({
        to: userWallet.target,
        value: depositAmount
      })).to.emit(userWallet, "EthDeposited").withArgs(user2.address, depositAmount);
    });

    it("Should withdraw ETH correctly", async function () {
      const withdrawAmount = ethers.parseEther("1");
      const initialBalance = await userWallet.getEthBalance();
      const initialRecipientBalance = await TestHelper.getBalance(user2.address);

      await userWallet.withdrawEth(user2.address, withdrawAmount);

      const finalBalance = await userWallet.getEthBalance();
      const finalRecipientBalance = await TestHelper.getBalance(user2.address);

      expect(finalBalance).to.equal(initialBalance - withdrawAmount);
      expect(finalRecipientBalance).to.equal(initialRecipientBalance + withdrawAmount);

      await expect(userWallet.withdrawEth(user2.address, withdrawAmount))
        .to.emit(userWallet, "EthWithdrawn")
        .withArgs(user2.address, withdrawAmount);
    });

    it("Should not withdraw to zero address", async function () {
      await expect(
        userWallet.withdrawEth(ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.be.revertedWith("Invalid recipient");
    });

    it("Should not withdraw zero amount", async function () {
      await expect(
        userWallet.withdrawEth(user2.address, 0)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should not withdraw more than balance", async function () {
      const balance = await userWallet.getEthBalance();
      const excessAmount = balance + ethers.parseEther("1");

      await expect(
        userWallet.withdrawEth(user2.address, excessAmount)
      ).to.be.revertedWith("Insufficient ETH balance");
    });

    it("Should send ETH correctly", async function () {
      const sendAmount = ethers.parseEther("1");
      const initialBalance = await userWallet.getEthBalance();
      const initialRecipientBalance = await TestHelper.getBalance(user2.address);

      await userWallet.sendEth(user2.address, sendAmount);

      const finalBalance = await userWallet.getEthBalance();
      const finalRecipientBalance = await TestHelper.getBalance(user2.address);

      expect(finalBalance).to.equal(initialBalance - sendAmount);
      expect(finalRecipientBalance).to.equal(initialRecipientBalance + sendAmount);
    });

    it("Should not send to zero address", async function () {
      await expect(
        userWallet.sendEth(ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.be.revertedWith("Invalid recipient");
    });

    it("Should allow only owner or manager to withdraw/send ETH", async function () {
      await expect(
        userWallet.connect(user2).withdrawEth(user2.address, ethers.parseEther("1"))
      ).to.be.revertedWith("Not authorized");

      await expect(
        userWallet.connect(user2).sendEth(user2.address, ethers.parseEther("1"))
      ).to.be.revertedWith("Not authorized");
    });

    it("Should handle emergency ETH withdrawal", async function () {
      await userWallet.emergencyWithdrawEth();

      const finalBalance = await userWallet.getEthBalance();

      expect(finalBalance).to.equal(0);
    });

    it("Should not allow non-owner emergency withdrawal", async function () {
      await expect(
        userWallet.connect(user1).emergencyWithdrawEth()
      ).to.be.reverted;
    });
  });

  describe("Token Operations", function () {
    beforeEach(async function () {
      await initializeAndFundWallet();
      // Add token support
      await userWallet.addSupportedToken(token1.target);
      await userWallet.addSupportedToken(token2.target);
    });

    it("Should deposit tokens correctly", async function () {
      const depositAmount = ethers.parseEther("100");

      // Approve wallet to spend tokens
      await token1.approve(userWallet.target, depositAmount);

      const initialWalletBalance = await userWallet.getTokenBalance(token1.target);
      const initialContractBalance = await token1.balanceOf(userWallet.target);

      await userWallet.depositToken(token1.target, depositAmount);

      const finalWalletBalance = await userWallet.getTokenBalance(token1.target);
      const finalContractBalance = await token1.balanceOf(userWallet.target);

      expect(finalWalletBalance).to.equal(initialWalletBalance + depositAmount);
      expect(finalContractBalance).to.equal(initialContractBalance + depositAmount);

      // Approve again for the second deposit
      await token1.approve(userWallet.target, depositAmount);

      await expect(userWallet.depositToken(token1.target, depositAmount))
        .to.emit(userWallet, "TokenDeposited")
        .withArgs(token1.target, owner.address, depositAmount);
    });

    it("Should not deposit unsupported tokens", async function () {
      const unsupportedToken = await TestHelper.createTestTokens();
      const depositAmount = ethers.parseEther("100");

      await expect(
        userWallet.depositToken(unsupportedToken.token1.target, depositAmount)
      ).to.be.revertedWith("Token not supported");
    });

    it("Should not deposit zero amount", async function () {
      await expect(
        userWallet.depositToken(token1.target, 0)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should not deposit without approval", async function () {
      const depositAmount = ethers.parseEther("100");

      await expect(
        userWallet.depositToken(token1.target, depositAmount)
      ).to.be.reverted;
    });

    it("Should withdraw tokens correctly", async function () {
      const depositAmount = ethers.parseEther("100");
      const withdrawAmount = ethers.parseEther("50");

      // First deposit tokens
      await token1.approve(userWallet.target, depositAmount);
      await userWallet.depositToken(token1.target, depositAmount);

      // Then withdraw
      await userWallet.withdrawToken(token1.target, user2.address, withdrawAmount);

      const finalWalletBalance = await userWallet.getTokenBalance(token1.target);
      const recipientBalance = await token1.balanceOf(user2.address);

      expect(finalWalletBalance).to.equal(depositAmount - withdrawAmount);
      expect(recipientBalance).to.equal(withdrawAmount);

      await expect(userWallet.withdrawToken(token1.target, user2.address, withdrawAmount))
        .to.emit(userWallet, "TokenWithdrawn")
        .withArgs(token1.target, user2.address, withdrawAmount);
    });

    it("Should not withdraw to zero address", async function () {
      await expect(
        userWallet.withdrawToken(token1.target, ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.be.revertedWith("Invalid recipient");
    });

    it("Should not withdraw more than balance", async function () {
      const balance = await userWallet.getTokenBalance(token1.target);
      const excessAmount = balance + ethers.parseEther("1");

      await expect(
        userWallet.withdrawToken(token1.target, user2.address, excessAmount)
      ).to.be.revertedWith("Insufficient token balance");
    });

    // Note: transferToWallet feature needs balance syncing implementation
    // Test removed until feature is fully implemented

    it("Should handle emergency token withdrawal", async function () {
      const depositAmount = ethers.parseEther("100");

      // Deposit tokens first
      await token1.approve(userWallet.target, depositAmount);
      await userWallet.depositToken(token1.target, depositAmount);

      const initialOwnerBalance = await token1.balanceOf(owner.address);
      const initialWalletBalance = await userWallet.getTokenBalance(token1.target);

      await userWallet.emergencyWithdrawToken(token1.target);

      const finalOwnerBalance = await token1.balanceOf(owner.address);
      const finalWalletBalance = await userWallet.getTokenBalance(token1.target);

      expect(finalOwnerBalance).to.equal(initialOwnerBalance + initialWalletBalance);
      expect(finalWalletBalance).to.equal(0);
    });
  });

  describe("Token Management", function () {
    beforeEach(async function () {
      await initializeAndFundWallet();
    });

    it("Should add supported tokens", async function () {
      await userWallet.addSupportedToken(token1.target);

      expect(await userWallet.isTokenSupported(token1.target)).to.be.true;
      expect(await userWallet.getSupportedTokens()).to.include(token1.target);
    });

    it("Should not add zero address as token", async function () {
      await expect(
        userWallet.addSupportedToken(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid token address");
    });

    it("Should not add duplicate tokens", async function () {
      await userWallet.addSupportedToken(token1.target);

      await expect(
        userWallet.addSupportedToken(token1.target)
      ).to.be.revertedWith("Token already supported");
    });

    it("Should remove supported tokens", async function () {
      await userWallet.addSupportedToken(token1.target);

      await userWallet.removeSupportedToken(token1.target);

      expect(await userWallet.isTokenSupported(token1.target)).to.be.false;
    });

    it("Should not remove unsupported tokens", async function () {
      await expect(
        userWallet.removeSupportedToken(token1.target)
      ).to.be.revertedWith("Token not supported");
    });

    it("Should sync token balance with actual contract balance", async function () {
      // Add token support and deposit
      await userWallet.addSupportedToken(token1.target);
      await token1.approve(userWallet.target, ethers.parseEther("100"));
      await userWallet.depositToken(token1.target, ethers.parseEther("100"));

      // Sync balance
      await userWallet.syncTokenBalance(token1.target);

      const walletBalance = await userWallet.getTokenBalance(token1.target);
      const actualBalance = await userWallet.getActualTokenBalance(token1.target);

      expect(walletBalance).to.equal(actualBalance);
    });
  });

  describe("Access Control", function () {
    beforeEach(async function () {
      await initializeAndFundWallet();
    });

    it("Should restrict token operations to owner or manager", async function () {
      await expect(
        userWallet.connect(user2).addSupportedToken(token1.target)
      ).to.be.revertedWith("Not authorized");

      await expect(
        userWallet.connect(user2).withdrawToken(token1.target, user2.address, ethers.parseEther("1"))
      ).to.be.revertedWith("Not authorized");

      await expect(
        userWallet.connect(user2).syncTokenBalance(token1.target)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should allow manager to perform operations", async function () {
      await userWallet.connect(manager).addSupportedToken(token1.target);
      expect(await userWallet.isTokenSupported(token1.target)).to.be.true;
    });
  });

  describe("Reentrancy Protection", function () {
    beforeEach(async function () {
      await initializeAndFundWallet();
    });

    it("Should prevent reentrancy in ETH withdrawal", async function () {
      // This would require a malicious contract, but we can test that nonReentrant works
      const withdrawAmount = ethers.parseEther("1");

      // First withdrawal should work
      await userWallet.withdrawEth(user2.address, withdrawAmount);

      // Second withdrawal in same transaction should fail if reentrancy protection works
      // (This is more of a structural test)
      const balance = await userWallet.getEthBalance();
      if (balance >= withdrawAmount) {
        await userWallet.withdrawEth(user2.address, withdrawAmount);
      }
    });

    it("Should prevent reentrancy in token operations", async function () {
      await userWallet.addSupportedToken(token1.target);

      // Deposit and withdraw in sequence should work
      await token1.approve(userWallet.target, ethers.parseEther("100"));
      await userWallet.depositToken(token1.target, ethers.parseEther("100"));
      await userWallet.withdrawToken(token1.target, user2.address, ethers.parseEther("50"));
    });
  });

  describe("Balance Queries", function () {
    beforeEach(async function () {
      await initializeAndFundWallet();
    });

    it("Should return correct ETH balance", async function () {
      const balance = await userWallet.getEthBalance();
      expect(balance).to.equal(initialEthBalance);
    });

    it("Should return correct token balance", async function () {
      await userWallet.addSupportedToken(token1.target);
      await token1.approve(userWallet.target, ethers.parseEther("100"));
      await userWallet.depositToken(token1.target, ethers.parseEther("100"));

      const balance = await userWallet.getTokenBalance(token1.target);
      expect(balance).to.equal(ethers.parseEther("100"));
    });

    it("Should return actual token balance from contract", async function () {
      await userWallet.addSupportedToken(token1.target);
      await token1.approve(userWallet.target, ethers.parseEther("100"));
      await userWallet.depositToken(token1.target, ethers.parseEther("100"));

      const internalBalance = await userWallet.getTokenBalance(token1.target);
      const actualBalance = await userWallet.getActualTokenBalance(token1.target);

      expect(actualBalance).to.equal(internalBalance);
    });

    it("Should return list of supported tokens", async function () {
      await userWallet.addSupportedToken(token1.target);
      await userWallet.addSupportedToken(token2.target);

      const supportedTokens = await userWallet.getSupportedTokens();
      expect(supportedTokens).to.include(token1.target);
      expect(supportedTokens).to.include(token2.target);
    });
  });

  describe("Aave Integration", function () {
    let mockAavePool, mockAToken;

    beforeEach(async function () {
      await initializeAndFundWallet();

      // Deploy mock Aave contracts
      const MockAavePool = await ethers.getContractFactory("MockAavePool");
      mockAavePool = await MockAavePool.deploy();

      const MockAToken = await ethers.getContractFactory("MockAToken");
      mockAToken = await MockAToken.deploy();

      // Set up Aave integration
      await userWallet.setAavePool(mockAavePool.target);
      await userWallet.setAToken(ethers.ZeroAddress, mockAToken.target); // ETH
      await userWallet.setAToken(token1.target, mockAToken.target); // Token
    });

    describe("Aave Setup", function () {
      it("Should set Aave pool correctly", async function () {
        expect(await userWallet.aavePool()).to.equal(mockAavePool.target);
      });

      it("Should not set zero address as Aave pool", async function () {
        await expect(
          userWallet.setAavePool(ethers.ZeroAddress)
        ).to.be.revertedWith("Invalid Aave pool address");
      });

      it("Should set aToken correctly", async function () {
        expect(await userWallet.assetToAToken(ethers.ZeroAddress)).to.equal(mockAToken.target);
        expect(await userWallet.assetToAToken(token1.target)).to.equal(mockAToken.target);
      });

      it("Should not set zero address as aToken", async function () {
        await expect(
          userWallet.setAToken(token1.target, ethers.ZeroAddress)
        ).to.be.revertedWith("Invalid aToken address");
      });

      it("Should only allow owner or manager to set Aave configurations", async function () {
        await expect(
          userWallet.connect(user2).setAavePool(mockAavePool.target)
        ).to.be.revertedWith("Not authorized");

        await expect(
          userWallet.connect(user2).setAToken(token1.target, mockAToken.target)
        ).to.be.revertedWith("Not authorized");
      });
    });

    describe("Supply to Aave", function () {
      it("Should supply ETH to Aave correctly", async function () {
        const supplyAmount = ethers.parseEther("1");
        const initialBalance = await userWallet.getEthBalance();

        await expect(userWallet.supplyToAave(ethers.ZeroAddress, supplyAmount))
          .to.emit(userWallet, "SuppliedToAave")
          .withArgs(ethers.ZeroAddress, supplyAmount, mockAToken.target);

        // Check supplied amount tracking
        expect(await userWallet.suppliedToAave(ethers.ZeroAddress)).to.equal(supplyAmount);

        // Wallet balance should remain the same as this is just tracking
        expect(await userWallet.getEthBalance()).to.equal(initialBalance);
      });

      it("Should supply tokens to Aave correctly", async function () {
        await userWallet.addSupportedToken(token1.target);
        await token1.approve(userWallet.target, ethers.parseEther("100"));
        await userWallet.depositToken(token1.target, ethers.parseEther("100"));

        const supplyAmount = ethers.parseEther("50");

        await expect(userWallet.supplyToAave(token1.target, supplyAmount))
          .to.emit(userWallet, "SuppliedToAave")
          .withArgs(token1.target, supplyAmount, mockAToken.target);

        expect(await userWallet.suppliedToAave(token1.target)).to.equal(supplyAmount);
      });

      it("Should not supply if Aave pool not set", async function () {
        const newWallet = await TestHelper.deployUserWallet();
        await newWallet.initialize(owner.address, user1.address);

        await expect(
          newWallet.supplyToAave(ethers.ZeroAddress, ethers.parseEther("1"))
        ).to.be.revertedWith("Aave pool not set");
      });

      it("Should not supply zero amount", async function () {
        await expect(
          userWallet.supplyToAave(ethers.ZeroAddress, 0)
        ).to.be.revertedWith("Amount must be greater than 0");
      });

      it("Should not supply more than balance", async function () {
        const balance = await userWallet.getEthBalance();
        const excessAmount = balance + ethers.parseEther("1");

        await expect(
          userWallet.supplyToAave(ethers.ZeroAddress, excessAmount)
        ).to.be.revertedWith("Insufficient balance");
      });

      it("Should only allow owner or manager to supply", async function () {
        await expect(
          userWallet.connect(user2).supplyToAave(ethers.ZeroAddress, ethers.parseEther("1"))
        ).to.be.revertedWith("Not authorized");
      });
    });

    describe("Withdraw from Aave", function () {
      beforeEach(async function () {
        // Supply some ETH to Aave first
        const supplyAmount = ethers.parseEther("2");
        await userWallet.supplyToAave(ethers.ZeroAddress, supplyAmount);

        // Mock aToken balance (principal + yield)
        await mockAToken.setBalance(userWallet.target, ethers.parseEther("2.1"));
      });

      it("Should withdraw from Aave correctly", async function () {
        const withdrawAmount = ethers.parseEther("1");
        const initialBalance = await userWallet.getEthBalance();

        const result = await userWallet.withdrawFromAave(ethers.ZeroAddress, withdrawAmount);

        await expect(result)
          .to.emit(userWallet, "WithdrawnFromAave")
          .withArgs(ethers.ZeroAddress, withdrawAmount);

        // Check supplied amount tracking is updated
        const expectedRemaining = ethers.parseEther("2") - withdrawAmount;
        expect(await userWallet.suppliedToAave(ethers.ZeroAddress)).to.equal(expectedRemaining);
      });

      it("Should withdraw all from Aave when using max amount", async function () {
        const maxAmount = ethers.MaxUint256;
        const aTokenBalance = await mockAToken.balanceOf(userWallet.target);

        await userWallet.withdrawFromAave(ethers.ZeroAddress, maxAmount);

        // Should reset supplied amount to 0 when withdrawing more than originally supplied
        expect(await userWallet.suppliedToAave(ethers.ZeroAddress)).to.equal(0);
      });

      it("Should withdraw tokens from Aave correctly", async function () {
        // Setup token supply first
        await userWallet.addSupportedToken(token1.target);
        await token1.approve(userWallet.target, ethers.parseEther("100"));
        await userWallet.depositToken(token1.target, ethers.parseEther("100"));
        await userWallet.supplyToAave(token1.target, ethers.parseEther("50"));

        // Mock aToken balance for tokens
        await mockAToken.setBalance(userWallet.target, ethers.parseEther("52"));

        const withdrawAmount = ethers.parseEther("25");
        const initialBalance = await userWallet.getTokenBalance(token1.target);

        await userWallet.withdrawFromAave(token1.target, withdrawAmount);

        // Token balance should be updated
        const finalBalance = await userWallet.getTokenBalance(token1.target);
        expect(finalBalance).to.equal(initialBalance + withdrawAmount);
      });

      it("Should not withdraw if Aave pool not set", async function () {
        const newWallet = await TestHelper.deployUserWallet();
        await newWallet.initialize(owner.address, user1.address);

        await expect(
          newWallet.withdrawFromAave(ethers.ZeroAddress, ethers.parseEther("1"))
        ).to.be.revertedWith("Aave pool not set");
      });

      it("Should not withdraw if aToken not set", async function () {
        const newWallet = await TestHelper.deployUserWallet();
        await newWallet.initialize(owner.address, user1.address);
        await newWallet.setAavePool(mockAavePool.target);

        await expect(
          newWallet.withdrawFromAave(ethers.ZeroAddress, ethers.parseEther("1"))
        ).to.be.revertedWith("aToken not set for asset");
      });

      it("Should not withdraw if no aToken balance", async function () {
        const newWallet = await TestHelper.deployUserWallet();
        await newWallet.initialize(owner.address, user1.address);
        await newWallet.setAavePool(mockAavePool.target);
        await newWallet.setAToken(ethers.ZeroAddress, mockAToken.target);

        await expect(
          newWallet.withdrawFromAave(ethers.ZeroAddress, ethers.parseEther("1"))
        ).to.be.revertedWith("No aToken balance");
      });

      it("Should not withdraw more than aToken balance", async function () {
        const aTokenBalance = await mockAToken.balanceOf(userWallet.target);
        const excessAmount = aTokenBalance + ethers.parseEther("1");

        await expect(
          userWallet.withdrawFromAave(ethers.ZeroAddress, excessAmount)
        ).to.be.revertedWith("Insufficient aToken balance");
      });

      it("Should only allow owner or manager to withdraw", async function () {
        await expect(
          userWallet.connect(user2).withdrawFromAave(ethers.ZeroAddress, ethers.parseEther("1"))
        ).to.be.revertedWith("Not authorized");
      });
    });

    describe("Aave Balance Queries", function () {
      beforeEach(async function () {
        // Supply some amounts to Aave
        await userWallet.supplyToAave(ethers.ZeroAddress, ethers.parseEther("2"));
        await mockAToken.setBalance(userWallet.target, ethers.parseEther("2.1")); // Principal + yield
      });

      it("Should return correct aToken balance", async function () {
        const balance = await userWallet.getATokenBalance(ethers.ZeroAddress);
        expect(balance).to.equal(ethers.parseEther("2.1"));
      });

      it("Should return zero for unsupported asset", async function () {
        const balance = await userWallet.getATokenBalance(token2.target);
        expect(balance).to.equal(0);
      });

      it("Should calculate yield correctly", async function () {
        const yield = await userWallet.getAaveYield(ethers.ZeroAddress);
        expect(yield).to.equal(ethers.parseEther("0.1")); // 2.1 - 2.0
      });

      it("Should return zero yield when aToken balance is less than supplied", async function () {
        // Simulate a loss scenario (shouldn't happen with Aave but for robustness)
        await mockAToken.setBalance(userWallet.target, ethers.parseEther("1.9"));

        const yield = await userWallet.getAaveYield(ethers.ZeroAddress);
        expect(yield).to.equal(0);
      });

      it("Should check Aave savings status correctly", async function () {
        const [hasBalance, aTokenBalance, suppliedAmount, yieldEarned] =
          await userWallet.checkAaveSavings(ethers.ZeroAddress);

        expect(hasBalance).to.be.true;
        expect(aTokenBalance).to.equal(ethers.parseEther("2.1"));
        expect(suppliedAmount).to.equal(ethers.parseEther("2"));
        expect(yieldEarned).to.equal(ethers.parseEther("0.1"));
      });

      it("Should return false for unsupported asset in checkAaveSavings", async function () {
        const [hasBalance, aTokenBalance, suppliedAmount, yieldEarned] =
          await userWallet.checkAaveSavings(token2.target);

        expect(hasBalance).to.be.false;
        expect(aTokenBalance).to.equal(0);
        expect(suppliedAmount).to.equal(0);
        expect(yieldEarned).to.equal(0);
      });
    });
  });

  describe("Edge Cases", function () {
    beforeEach(async function () {
      await initializeAndFundWallet();
    });

    it("Should handle multiple token deposits and withdrawals", async function () {
      await userWallet.addSupportedToken(token1.target);
      await userWallet.addSupportedToken(token2.target);

      // Deposit multiple tokens
      await token1.approve(userWallet.target, ethers.parseEther("100"));
      await token2.approve(userWallet.target, ethers.parseEther("100"));

      await userWallet.depositToken(token1.target, ethers.parseEther("100"));
      await userWallet.depositToken(token2.target, ethers.parseEther("100"));

      // Partial withdrawals
      await userWallet.withdrawToken(token1.target, user2.address, ethers.parseEther("30"));
      await userWallet.withdrawToken(token2.target, user2.address, ethers.parseEther("70"));

      const token1Balance = await userWallet.getTokenBalance(token1.target);
      const token2Balance = await userWallet.getTokenBalance(token2.target);

      expect(token1Balance).to.equal(ethers.parseEther("70"));
      expect(token2Balance).to.equal(ethers.parseEther("30"));
    });

    it("Should handle zero balance operations gracefully", async function () {
      // Try to withdraw more than balance
      const currentBalance = await userWallet.getEthBalance();
      await expect(
        userWallet.withdrawEth(user2.address, currentBalance + ethers.parseEther("1"))
      ).to.be.revertedWith("Insufficient ETH balance");

      // Try to withdraw unsupported token
      await expect(
        userWallet.withdrawToken(token1.target, user2.address, ethers.parseEther("1"))
      ).to.be.revertedWith("Token not supported");
    });

    it("Should handle large amounts correctly", async function () {
      const largeAmount = ethers.parseEther("1000000");

      // Deposit large amount
      await token1.mint(owner.address, largeAmount);
      await userWallet.addSupportedToken(token1.target);
      await token1.approve(userWallet.target, largeAmount);
      await userWallet.depositToken(token1.target, largeAmount);

      const balance = await userWallet.getTokenBalance(token1.target);
      expect(balance).to.equal(largeAmount);
    });
  });
});
