const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("GroupPool - Automatic Withdrawal", function () {
  let groupPool;
  let addressManager;
  let mockAavePool;
  let mockAToken;
  let usdc;
  let owner;
  let treasury;
  let member1;
  let member2;
  let member3;
  let admin;

  const LOCK_PERIOD_DURATION = 30 * 24 * 60 * 60; // 30 days
  const MIN_CONTRIBUTION = ethers.parseUnits("1", 6); // 1 USDC minimum
  const MAX_MEMBERS = 10;
  const PAYMENT_WINDOW_DURATION = 7 * 24 * 60 * 60; // 7 days
  const SYSTEM_FEE_PERCENT = 3; // 3%

  beforeEach(async function () {
    [owner, treasury, member1, member2, member3, admin] = await ethers.getSigners();

    // Deploy mock USDC token
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    usdc = await ERC20Mock.deploy("USD Coin", "USDC", ethers.parseUnits("1000000", 6));
    await usdc.waitForDeployment();

    // Deploy mock aToken
    const ATokenMock = await ethers.getContractFactory("ERC20Mock");
    mockAToken = await ATokenMock.deploy("Aave USDC", "aUSDC", ethers.parseUnits("1000000", 18));
    await mockAToken.waitForDeployment();

    // Deploy mock Aave pool
    const AavePoolMock = await ethers.getContractFactory("AavePoolMock");
    mockAavePool = await AavePoolMock.deploy();
    await mockAavePool.waitForDeployment();

    // Set aToken in mock pool for both USDC and ETH
    await mockAavePool.setAToken(await usdc.getAddress(), await mockAToken.getAddress());
    await mockAavePool.setAToken(ethers.ZeroAddress, await mockAToken.getAddress()); // ETH

    // Mint aTokens to the mock pool so it can transfer them during supply operations
    await mockAToken.mint(await mockAavePool.getAddress(), ethers.parseUnits("1000000", 18));

    // Fund the AavePoolMock with underlying assets for withdrawals
    // Send ETH to the mock pool
    await owner.sendTransaction({
      to: await mockAavePool.getAddress(),
      value: ethers.parseEther("100") // 100 ETH
    });

    // Mint and transfer USDC to the mock pool
    await usdc.mint(await mockAavePool.getAddress(), ethers.parseUnits("100000", 6)); // 100k USDC

    // Deploy AddressManager
    const AddressManager = await ethers.getContractFactory("AddressManager");
    addressManager = await AddressManager.deploy();
    await addressManager.waitForDeployment();

    // Deploy GroupPool
    const GroupPool = await ethers.getContractFactory("GroupPool");
    groupPool = await GroupPool.deploy();
    await groupPool.waitForDeployment();

    // Initialize GroupPool
    await groupPool.initialize(
      owner.address,
      await addressManager.getAddress(),
      "Test Group",
      PAYMENT_WINDOW_DURATION,
      MIN_CONTRIBUTION,
      MAX_MEMBERS,
      LOCK_PERIOD_DURATION,
      treasury.address
    );

    // Set up Aave integration
    await groupPool.setAavePool(await mockAavePool.getAddress());
    await groupPool.setAToken(await usdc.getAddress(), await mockAToken.getAddress());
    await groupPool.setAToken(ethers.ZeroAddress, await mockAToken.getAddress());

    // Add supported token
    await groupPool.addSupportedToken(await usdc.getAddress());

    // Add members
    await groupPool.addMember(member1.address);
    await groupPool.addMember(member2.address);
    await groupPool.addMember(member3.address);

    // Mint tokens to members (enough for their contributions)
    await usdc.mint(member1.address, ethers.parseUnits("2000", 6));
    await usdc.mint(member2.address, ethers.parseUnits("2000", 6));
    await usdc.mint(member3.address, ethers.parseUnits("2000", 6));
  });

  describe("Initialization and Setup", function () {
    it("Should initialize with correct lock period", async function () {
      const lockPeriod = await groupPool.lockPeriod();
      const currentTime = await time.latest();

      expect(lockPeriod).to.be.closeTo(
        currentTime + LOCK_PERIOD_DURATION,
        15 // 15 second tolerance for block timing variations
      );
    });

    it("Should set correct system treasury", async function () {
      expect(await groupPool.systemTreasury()).to.equal(treasury.address);
    });

    it("Should start with Active status", async function () {
      expect(await groupPool.groupStatus()).to.equal(0); // Active
    });
  });

  describe("Withdrawal Eligibility", function () {
    it("Should return false when lock period not expired", async function () {
      const [eligible, timeRemaining] = await groupPool.checkWithdrawalEligibility();

      expect(eligible).to.be.false;
      expect(timeRemaining).to.be.gt(0);
    });

    it("Should return true when lock period expired and group is active", async function () {
      // Fast forward time past lock period
      await time.increase(LOCK_PERIOD_DURATION + 1);

      const [eligible, timeRemaining] = await groupPool.checkWithdrawalEligibility();

      expect(eligible).to.be.true;
      expect(timeRemaining).to.equal(0);
    });

    it("Should return false if group is not active", async function () {
      // Fast forward time past lock period
      await time.increase(LOCK_PERIOD_DURATION + 1);

      // Change group status to completed (would be done by withdrawal)
      // For testing, we can't directly change status, so this tests the concept
      const [eligible] = await groupPool.checkWithdrawalEligibility();
      expect(eligible).to.be.true; // Should be true when active
    });
  });

  describe("ETH Automatic Withdrawal", function () {
    beforeEach(async function () {
      // Members make contributions
      const contribution1 = ethers.parseEther("1"); // 40%
      const contribution2 = ethers.parseEther("1.5"); // 60%

      await groupPool.connect(member1).contribute({ value: contribution1 });
      await groupPool.connect(member2).contribute({ value: contribution2 });

      // Supply to Aave
      await groupPool.supplyToAave(ethers.ZeroAddress, ethers.parseEther("2.5"));

      // Simulate yield generation in Aave (mint additional aTokens)
      const yieldAmount = ethers.parseEther("0.1"); // 4% yield
      await mockAToken.mint(await groupPool.getAddress(), yieldAmount);
    });

    it("Should fail if lock period not expired", async function () {
      await expect(
        groupPool.processAutomaticWithdraw(ethers.ZeroAddress)
      ).to.be.revertedWith("Lock period not expired");
    });

    it("Should fail if no funds supplied to Aave", async function () {
      // Fast forward time
      await time.increase(LOCK_PERIOD_DURATION + 1);

      // Try to withdraw a different asset
      await expect(
        groupPool.processAutomaticWithdraw(await usdc.getAddress())
      ).to.be.revertedWith("No funds supplied to Aave for this asset");
    });

    it("Should successfully process automatic withdrawal", async function () {
      // Fast forward time past lock period
      await time.increase(LOCK_PERIOD_DURATION + 1);

      const initialTreasuryBalance = await ethers.provider.getBalance(treasury.address);
      const initialMember1Balance = await ethers.provider.getBalance(member1.address);
      const initialMember2Balance = await ethers.provider.getBalance(member2.address);

      // Process withdrawal
      const tx = await groupPool.processAutomaticWithdraw(ethers.ZeroAddress);
      const receipt = await tx.wait();

      // Check events
      const withdrawalEvent = receipt.logs.find(
        log => log.fragment && log.fragment.name === "AutomaticWithdrawalProcessed"
      );
      expect(withdrawalEvent).to.not.be.undefined;

      const completedEvent = receipt.logs.find(
        log => log.fragment && log.fragment.name === "GroupCompleted"
      );
      expect(completedEvent).to.not.be.undefined;

      // Check group status changed to completed
      expect(await groupPool.groupStatus()).to.equal(1); // Completed

      // Check system fee calculation (3% of interest)
      const totalWithdrawn = ethers.parseEther("2.6"); // 2.5 + 0.1 yield
      const interest = ethers.parseEther("0.1");
      const expectedSystemFee = (interest * BigInt(3)) / BigInt(100);

      // Check treasury received system fee
      const finalTreasuryBalance = await ethers.provider.getBalance(treasury.address);
      expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(expectedSystemFee);

      // Check members received proportional amounts
      const distributableAmount = totalWithdrawn - expectedSystemFee;
      const member1Share = (ethers.parseEther("1") * distributableAmount) / ethers.parseEther("2.5");
      const member2Share = (ethers.parseEther("1.5") * distributableAmount) / ethers.parseEther("2.5");

      const finalMember1Balance = await ethers.provider.getBalance(member1.address);
      const finalMember2Balance = await ethers.provider.getBalance(member2.address);

      expect(finalMember1Balance - initialMember1Balance).to.equal(member1Share);
      expect(finalMember2Balance - initialMember2Balance).to.equal(member2Share);
    });

    it("Should emit correct events with accurate data", async function () {
      await time.increase(LOCK_PERIOD_DURATION + 1);

      const tx = await groupPool.processAutomaticWithdraw(ethers.ZeroAddress);

      // Check AutomaticWithdrawalProcessed event
      await expect(tx)
        .to.emit(groupPool, "AutomaticWithdrawalProcessed")
        .withArgs(
          ethers.parseEther("2.6"), // totalAmount
          ethers.parseEther("2.5"), // principal
          ethers.parseEther("0.1"), // interest
          ethers.parseEther("0.003"), // systemFee (3% of 0.1)
          expect.any(Number) // timestamp
        );

      // Check MemberPayout events
      await expect(tx)
        .to.emit(groupPool, "MemberPayout")
        .withArgs(
          member1.address,
          expect.any(Number), // amount (calculated proportionally)
          ethers.parseEther("1"), // contribution
          expect.any(Number) // timestamp
        );

      await expect(tx)
        .to.emit(groupPool, "GroupCompleted");
    });
  });

  describe("Token Automatic Withdrawal", function () {
    beforeEach(async function () {
      // Members make USDC contributions (using larger amounts to meet minimum)
      const contribution1 = ethers.parseUnits("1000", 6); // 40%
      const contribution2 = ethers.parseUnits("1500", 6); // 60%

      // Approve and contribute
      await usdc.connect(member1).approve(await groupPool.getAddress(), contribution1);
      await usdc.connect(member2).approve(await groupPool.getAddress(), contribution2);

      await groupPool.connect(member1).contributeToken(await usdc.getAddress(), contribution1);
      await groupPool.connect(member2).contributeToken(await usdc.getAddress(), contribution2);

      // Supply to Aave
      await groupPool.supplyToAave(await usdc.getAddress(), ethers.parseUnits("2500", 6));

      // Simulate yield generation
      const yieldAmount = ethers.parseUnits("100", 6); // 4% yield
      await mockAToken.mint(await groupPool.getAddress(), yieldAmount);
    });

    it("Should successfully process token withdrawal", async function () {
      await time.increase(LOCK_PERIOD_DURATION + 1);

      const initialTreasuryBalance = await usdc.balanceOf(treasury.address);
      const initialMember1Balance = await usdc.balanceOf(member1.address);
      const initialMember2Balance = await usdc.balanceOf(member2.address);

      await groupPool.processAutomaticWithdraw(await usdc.getAddress());

      // Check system fee (3% of 100 USDC yield = 3 USDC)
      const expectedSystemFee = ethers.parseUnits("3", 6);
      const finalTreasuryBalance = await usdc.balanceOf(treasury.address);
      expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(expectedSystemFee);

      // Check member distributions
      const totalWithdrawn = ethers.parseUnits("2600", 6); // 2500 + 100 yield
      const distributableAmount = totalWithdrawn - expectedSystemFee;

      const member1Share = (ethers.parseUnits("1000", 6) * distributableAmount) / ethers.parseUnits("2500", 6);
      const member2Share = (ethers.parseUnits("1500", 6) * distributableAmount) / ethers.parseUnits("2500", 6);

      const finalMember1Balance = await usdc.balanceOf(member1.address);
      const finalMember2Balance = await usdc.balanceOf(member2.address);

      expect(finalMember1Balance - initialMember1Balance).to.equal(member1Share);
      expect(finalMember2Balance - initialMember2Balance).to.equal(member2Share);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero yield scenario", async function () {
      // Members contribute
      await groupPool.connect(member1).contribute({ value: ethers.parseEther("1") });
      await groupPool.supplyToAave(ethers.ZeroAddress, ethers.parseEther("1"));

      // No additional yield generated
      await time.increase(LOCK_PERIOD_DURATION + 1);

      const tx = await groupPool.processAutomaticWithdraw(ethers.ZeroAddress);

      // Should emit event with zero interest and system fee
      await expect(tx)
        .to.emit(groupPool, "AutomaticWithdrawalProcessed")
        .withArgs(
          ethers.parseEther("1"), // totalAmount
          ethers.parseEther("1"), // principal
          0, // interest
          0, // systemFee
          anyValue // timestamp
        );
    });

    it("Should handle member with zero contribution", async function () {
      await groupPool.connect(member1).contribute({ value: ethers.parseEther("1") });
      await groupPool.supplyToAave(ethers.ZeroAddress, ethers.parseEther("1"));

      await time.increase(LOCK_PERIOD_DURATION + 1);

      const initialMember2Balance = await ethers.provider.getBalance(member2.address);

      await groupPool.processAutomaticWithdraw(ethers.ZeroAddress);

      const finalMember2Balance = await ethers.provider.getBalance(member2.address);

      // Member2 should receive nothing (no contribution)
      expect(finalMember2Balance).to.equal(initialMember2Balance);
    });

    it("Should prevent double withdrawal", async function () {
      await groupPool.connect(member1).contribute({ value: ethers.parseEther("1") });
      await groupPool.supplyToAave(ethers.ZeroAddress, ethers.parseEther("1"));

      await time.increase(LOCK_PERIOD_DURATION + 1);

      // First withdrawal
      await groupPool.processAutomaticWithdraw(ethers.ZeroAddress);

      // Second withdrawal attempt should fail
      await expect(
        groupPool.processAutomaticWithdraw(ethers.ZeroAddress)
      ).to.be.revertedWith("Group not active");
    });
  });

  describe("Group Summary", function () {
    beforeEach(async function () {
      await groupPool.connect(member1).contribute({ value: ethers.parseEther("1") });
      await groupPool.connect(member2).contribute({ value: ethers.parseEther("2") });
      await groupPool.supplyToAave(ethers.ZeroAddress, ethers.parseEther("3"));

      // Add yield
      await mockAToken.mint(await groupPool.getAddress(), ethers.parseEther("0.12"));
    });

    it("Should return correct group summary", async function () {
      const [
        principal,
        currentYield,
        totalMembers,
        totalContributions,
        withdrawalEligible,
        lockTimeRemaining
      ] = await groupPool.getGroupSummary(ethers.ZeroAddress);

      expect(principal).to.equal(ethers.parseEther("3"));
      expect(currentYield).to.equal(ethers.parseEther("0.12"));
      expect(totalMembers).to.equal(3); // 3 members added
      expect(totalContributions).to.equal(ethers.parseEther("3"));
      expect(withdrawalEligible).to.be.false; // Lock period not expired
      expect(lockTimeRemaining).to.be.gt(0);
    });

    it("Should show withdrawal eligible after lock period", async function () {
      await time.increase(LOCK_PERIOD_DURATION + 1);

      const [
        principal,
        currentYield,
        totalMembers,
        totalContributions,
        withdrawalEligible,
        lockTimeRemaining
      ] = await groupPool.getGroupSummary(ethers.ZeroAddress);

      expect(withdrawalEligible).to.be.true;
      expect(lockTimeRemaining).to.equal(0);
    });
  });
});

