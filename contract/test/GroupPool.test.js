const { expect } = require("chai");
const { ethers } = require("hardhat");
const TestHelper = require("./utils");

describe("GroupPool", function () {
  let groupPool, owner, user1, user2, user3, manager;
  let token1, token2;
  let groupName, paymentWindowDuration, minContribution, maxMembers;

  // Helper to initialize pool
  async function initializePool() {
    await groupPool.initialize(
      owner.address,
      user1.address, // manager (AddressManager)
      groupName,
      paymentWindowDuration,
      minContribution,
      maxMembers
    );
  }

  beforeEach(async function () {
    ({ owner, user1, user2, user3 } = await TestHelper.createTestUser());
    ({ token1, token2 } = await TestHelper.createTestTokens());

    // Deploy group pool implementation
    groupPool = await TestHelper.deployGroupPool();

    // Set up test parameters
    groupName = "Test Savings Group";
    paymentWindowDuration = 7 * 24 * 60 * 60; // 7 days
    minContribution = ethers.parseEther("0.01");
    maxMembers = 10;
    manager = user1;
  });

  describe("Initialization", function () {
    it("Should initialize correctly", async function () {
      await groupPool.initialize(
        owner.address,
        user1.address,
        groupName,
        paymentWindowDuration,
        minContribution,
        maxMembers
      );

      expect(await groupPool.owner()).to.equal(owner.address);
      expect(await groupPool.manager()).to.equal(user1.address);
      expect(await groupPool.groupName()).to.equal(groupName);
      expect(await groupPool.paymentWindowDuration()).to.equal(paymentWindowDuration);
      expect(await groupPool.minContribution()).to.equal(minContribution);
      expect(await groupPool.maxMembers()).to.equal(maxMembers);
    });

    it("Should not initialize if already initialized", async function () {
      await groupPool.initialize(
        owner.address,
        user1.address,
        groupName,
        paymentWindowDuration,
        minContribution,
        maxMembers
      );

      await expect(
        groupPool.initialize(
          user2.address,
          user1.address,
          "Another Group",
          paymentWindowDuration,
          minContribution,
          maxMembers
        )
      ).to.be.revertedWith("Already initialized");
    });

    it("Should not initialize with zero owner", async function () {
      const newPool = await TestHelper.deployGroupPool();

      await expect(
        newPool.initialize(
          ethers.ZeroAddress,
          user1.address,
          groupName,
          paymentWindowDuration,
          minContribution,
          maxMembers
        )
      ).to.be.revertedWith("Invalid owner");
    });

    it("Should not initialize with zero manager", async function () {
      const newPool = await TestHelper.deployGroupPool();

      await expect(
        newPool.initialize(
          owner.address,
          ethers.ZeroAddress,
          groupName,
          paymentWindowDuration,
          minContribution,
          maxMembers
        )
      ).to.be.revertedWith("Invalid manager");
    });

    it("Should not initialize with zero payment window duration", async function () {
      const newPool = await TestHelper.deployGroupPool();

      await expect(
        newPool.initialize(
          owner.address,
          user1.address,
          groupName,
          0,
          minContribution,
          maxMembers
        )
      ).to.be.revertedWith("Invalid payment window duration");
    });

    it("Should create first payment window on initialization", async function () {
      const newPool = await TestHelper.deployGroupPool();
      await newPool.initialize(
        owner.address,
        user1.address,
        groupName,
        paymentWindowDuration,
        minContribution,
        maxMembers
      );

      const currentWindow = await newPool.currentWindowNumber();
      expect(currentWindow).to.equal(1);

      const window = await newPool.getPaymentWindow(1);
      expect(window.active).to.be.true;
      expect(window.completed).to.be.false;
      expect(window.start).to.be.gt(0);
      expect(window.end).to.equal(window.start + BigInt(paymentWindowDuration));
    });

    it("Should emit GroupPoolInitialized event", async function () {
      const newPool = await TestHelper.deployGroupPool();

      await expect(newPool.initialize(
        owner.address,
        user1.address,
        groupName,
        paymentWindowDuration,
        minContribution,
        maxMembers
      )).to.emit(newPool, "GroupPoolInitialized")
        .withArgs(owner.address, user1.address);
    });
  });

  describe("ETH Contributions", function () {
    beforeEach(async function () {
      await initializePool();
      // Add members first
      await groupPool.addMember(user2.address);
      await groupPool.addMember(user3.address);
    });

    it("Should accept ETH contributions", async function () {
      const contributionAmount = ethers.parseEther("0.05");

      await expect(
        user2.sendTransaction({
          to: groupPool.target,
          value: contributionAmount
        })
      ).to.emit(groupPool, "ContributionMade");
    });

    it("Should track member contributions correctly", async function () {
      const contributionAmount = ethers.parseEther("0.05");

      await user2.sendTransaction({
        to: groupPool.target,
        value: contributionAmount
      });

      const memberContribution = await groupPool.getMemberContribution(user2.address, 1);
      expect(memberContribution).to.equal(contributionAmount);

      const window = await groupPool.getPaymentWindow(1);
      expect(window.total).to.equal(contributionAmount);
    });

    it("Should not accept contributions below minimum", async function () {
      const smallAmount = ethers.parseEther("0.005"); // Less than minContribution

      await expect(
        user2.sendTransaction({
          to: groupPool.target,
          value: smallAmount
        })
      ).to.be.revertedWith("Contribution below minimum");
    });

    it("Should not accept contributions when no active window", async function () {
      // Complete current window
      await groupPool.completeCurrentWindow();

      const contributionAmount = ethers.parseEther("0.05");

      await expect(
        user2.sendTransaction({
          to: groupPool.target,
          value: contributionAmount
        })
      ).to.be.revertedWith("No active payment window");
    });

    it("Should not accept contributions from non-members", async function () {
      const contributionAmount = ethers.parseEther("0.05");

      await expect(
        owner.sendTransaction({
          to: groupPool.target,
          value: contributionAmount
        })
      ).to.be.revertedWith("Not a group member");
    });

    it("Should handle multiple contributions from same member", async function () {
      const contribution1 = ethers.parseEther("0.03");
      const contribution2 = ethers.parseEther("0.02");
      const totalExpected = contribution1 + contribution2;

      await user2.sendTransaction({ to: groupPool.target, value: contribution1 });
      await user2.sendTransaction({ to: groupPool.target, value: contribution2 });

      const memberContribution = await groupPool.getMemberContribution(user2.address, 1);
      expect(memberContribution).to.equal(totalExpected);

      const window = await groupPool.getPaymentWindow(1);
      expect(window.total).to.equal(totalExpected);
    });

    it("Should update total member contributions", async function () {
      const contributionAmount = ethers.parseEther("0.05");

      await user2.sendTransaction({
        to: groupPool.target,
        value: contributionAmount
      });

      const totalMemberContributions = await groupPool.totalMemberContributions(user2.address);
      expect(totalMemberContributions).to.equal(contributionAmount);
    });

    it("Should use contribute() function for explicit contributions", async function () {
      const contributionAmount = ethers.parseEther("0.05");

      await expect(
        groupPool.connect(user2).contribute({ value: contributionAmount })
      ).to.emit(groupPool, "ContributionMade");
    });
  });

  describe("Token Contributions", function () {
    beforeEach(async function () {
      await initializePool();
      // Add members and token support
      await groupPool.addMember(user2.address);
      await groupPool.addMember(user3.address);
      await groupPool.addSupportedToken(token1.target);

      // Mint tokens to members
      await token1.mint(user2.address, ethers.parseEther("100"));
      await token1.mint(user3.address, ethers.parseEther("100"));
    });

    it("Should accept token contributions", async function () {
      const contributionAmount = ethers.parseEther("10");

      // Approve pool to spend tokens
      await token1.connect(user2).approve(groupPool.target, contributionAmount);

      await expect(
        groupPool.connect(user2).contributeToken(token1.target, contributionAmount)
      ).to.emit(groupPool, "ContributionMade");
    });

    it("Should track token contributions correctly", async function () {
      const contributionAmount = ethers.parseEther("10");

      await token1.connect(user2).approve(groupPool.target, contributionAmount);
      await groupPool.connect(user2).contributeToken(token1.target, contributionAmount);

      const memberTokenContribution = await groupPool.getMemberTokenContribution(
        user2.address,
        1,
        token1.target
      );
      expect(memberTokenContribution).to.equal(contributionAmount);

      const totalMemberTokenContributions = await groupPool.totalMemberTokenContributions(
        user2.address,
        token1.target
      );
      expect(totalMemberTokenContributions).to.equal(contributionAmount);
    });

    it("Should not accept contributions for unsupported tokens", async function () {
      const contributionAmount = ethers.parseEther("10");

      await expect(
        groupPool.connect(user2).contributeToken(token2.target, contributionAmount)
      ).to.be.revertedWith("Token not supported");
    });

    it("Should not accept zero token contributions", async function () {
      await expect(
        groupPool.connect(user2).contributeToken(token1.target, 0)
      ).to.be.revertedWith("Contribution below minimum");
    });

    it("Should not accept token contributions without approval", async function () {
      const contributionAmount = ethers.parseEther("10");

      await expect(
        groupPool.connect(user2).contributeToken(token1.target, contributionAmount)
      ).to.be.reverted;
    });

    it("Should not accept token contributions from non-members", async function () {
      const contributionAmount = ethers.parseEther("10");

      await token1.connect(owner).approve(groupPool.target, contributionAmount);

      await expect(
        groupPool.connect(owner).contributeToken(token1.target, contributionAmount)
      ).to.be.revertedWith("Not a group member");
    });

    it("Should handle multiple token contributions", async function () {
      const contribution1 = ethers.parseEther("5");
      const contribution2 = ethers.parseEther("3");
      const totalExpected = contribution1 + contribution2;

      await token1.connect(user2).approve(groupPool.target, totalExpected);

      await groupPool.connect(user2).contributeToken(token1.target, contribution1);
      await groupPool.connect(user2).contributeToken(token1.target, contribution2);

      const memberTokenContribution = await groupPool.getMemberTokenContribution(
        user2.address,
        1,
        token1.target
      );
      expect(memberTokenContribution).to.equal(totalExpected);
    });
  });

  describe("Member Management", function () {
    beforeEach(async function () {
      await initializePool();
    });

    it("Should add members correctly", async function () {
      await groupPool.addMember(user2.address);

      expect(await groupPool.isGroupMember(user2.address)).to.be.true;
      expect(await groupPool.getGroupMembers()).to.include(user2.address);
    });

    it("Should not add zero address as member", async function () {
      await expect(
        groupPool.addMember(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid member address");
    });

    it("Should not add duplicate members", async function () {
      await groupPool.addMember(user2.address);

      await expect(
        groupPool.addMember(user2.address)
      ).to.be.revertedWith("Already a member");
    });

    it("Should not exceed max members", async function () {
      // Add max members
      for (let i = 0; i < maxMembers; i++) {
        const testUser = ethers.Wallet.createRandom().address;
        await groupPool.addMember(testUser);
      }

      await expect(
        groupPool.addMember(user2.address)
      ).to.be.revertedWith("Group is full");
    });

    it("Should remove members correctly", async function () {
      await groupPool.addMember(user2.address);
      expect(await groupPool.isGroupMember(user2.address)).to.be.true;

      await groupPool.removeMember(user2.address);
      expect(await groupPool.isGroupMember(user2.address)).to.be.false;
    });

    it("Should not remove non-members", async function () {
      await expect(
        groupPool.removeMember(user2.address)
      ).to.be.revertedWith("Not a member");
    });

    it("Should only allow owner or manager to manage members", async function () {
      await expect(
        groupPool.connect(user2).addMember(user3.address)
      ).to.be.revertedWith("Not authorized");

      await groupPool.addMember(user2.address);

      await expect(
        groupPool.connect(user2).removeMember(user2.address)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Token Management", function () {
    beforeEach(async function () {
      await initializePool();
    });

    it("Should add supported tokens", async function () {
      await groupPool.addSupportedToken(token1.target);

      expect(await groupPool.supportedTokens(token1.target)).to.be.true;
      expect(await groupPool.getSupportedTokens()).to.include(token1.target);
    });

    it("Should not add zero address as token", async function () {
      await expect(
        groupPool.addSupportedToken(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid token address");
    });

    it("Should not add duplicate tokens", async function () {
      await groupPool.addSupportedToken(token1.target);

      await expect(
        groupPool.addSupportedToken(token1.target)
      ).to.be.revertedWith("Token already supported");
    });

    it("Should only allow owner or manager to add tokens", async function () {
      await expect(
        groupPool.connect(user2).addSupportedToken(token1.target)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Payment Windows", function () {
    beforeEach(async function () {
      await initializePool();
    });

    it("Should create new payment window", async function () {
      const initialWindow = await groupPool.currentWindowNumber();
      expect(initialWindow).to.equal(1);

      await groupPool.createNewPaymentWindow();

      const newWindow = await groupPool.currentWindowNumber();
      expect(newWindow).to.equal(2);

      const window = await groupPool.getPaymentWindow(2);
      expect(window.active).to.be.true;
      expect(window.completed).to.be.false;
    });

    it("Should complete current payment window", async function () {
      await groupPool.completeCurrentWindow();

      const window = await groupPool.getPaymentWindow(1);
      expect(window.active).to.be.false;
      expect(window.completed).to.be.true;

      // Should create new window
      const currentWindow = await groupPool.currentWindowNumber();
      expect(currentWindow).to.equal(2);
    });

    it("Should auto-complete window when time expires", async function () {
      // Advance time past window duration
      await TestHelper.advanceTime(paymentWindowDuration + 60);

      // Try to contribute (should trigger auto-completion)
      await groupPool.addMember(user2.address);

      await expect(
        user2.sendTransaction({
          to: groupPool.target,
          value: ethers.parseEther("0.05")
        })
      ).to.emit(groupPool, "PaymentWindowCompleted");
    });

    it("Should not complete non-active window", async function () {
      await expect(
        groupPool.completeCurrentWindow()
      ).to.not.be.reverted;

      await expect(
        groupPool.completeCurrentWindow()
      ).to.be.revertedWith("No active window");
    });

    it("Should only allow owner or manager to manage windows", async function () {
      await expect(
        groupPool.connect(user2).createNewPaymentWindow()
      ).to.be.revertedWith("Not authorized");

      await expect(
        groupPool.connect(user2).completeCurrentWindow()
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Fund Withdrawal", function () {
    beforeEach(async function () {
      await initializePool();
      // Add member and make contribution
      await groupPool.addMember(user2.address);
      await user2.sendTransaction({
        to: groupPool.target,
        value: ethers.parseEther("1")
      });
    });

    it("Should withdraw ETH correctly", async function () {
      const withdrawAmount = ethers.parseEther("0.5");
      const initialBalance = await TestHelper.getBalance(user3.address);

      await groupPool.withdrawEth(user3.address, withdrawAmount);

      const finalBalance = await TestHelper.getBalance(user3.address);
      expect(finalBalance).to.equal(initialBalance + withdrawAmount);

      await expect(groupPool.withdrawEth(user3.address, withdrawAmount))
        .to.emit(groupPool, "FundsWithdrawn")
        .withArgs(user3.address, withdrawAmount, ethers.ZeroAddress);
    });

    it("Should withdraw tokens correctly", async function () {
      // Add token support and make token contribution
      await groupPool.addSupportedToken(token1.target);
      await token1.mint(user2.address, ethers.parseEther("10"));
      await token1.connect(user2).approve(groupPool.target, ethers.parseEther("5"));
      await groupPool.connect(user2).contributeToken(token1.target, ethers.parseEther("5"));

      const withdrawAmount = ethers.parseEther("2");
      await groupPool.withdrawToken(token1.target, user3.address, withdrawAmount);

      const recipientBalance = await token1.balanceOf(user3.address);
      expect(recipientBalance).to.equal(withdrawAmount);

      await expect(groupPool.withdrawToken(token1.target, user3.address, withdrawAmount))
        .to.emit(groupPool, "FundsWithdrawn")
        .withArgs(user3.address, withdrawAmount, token1.target);
    });

    it("Should not withdraw to zero address", async function () {
      await expect(
        groupPool.withdrawEth(ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.be.revertedWith("Invalid recipient");

      await expect(
        groupPool.withdrawToken(token1.target, ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.be.revertedWith("Invalid recipient");
    });

    it("Should not withdraw zero amount", async function () {
      await expect(
        groupPool.withdrawEth(user3.address, 0)
      ).to.be.revertedWith("Amount must be greater than 0");

      await expect(
        groupPool.withdrawToken(token1.target, user3.address, 0)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should not withdraw more than balance", async function () {
      const balance = await ethers.provider.getBalance(groupPool.target);
      const excessAmount = balance + ethers.parseEther("1");

      await expect(
        groupPool.withdrawEth(user3.address, excessAmount)
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should only allow owner or manager to withdraw", async function () {
      await expect(
        groupPool.connect(user2).withdrawEth(user3.address, ethers.parseEther("1"))
      ).to.be.revertedWith("Not authorized");

      await expect(
        groupPool.connect(user2).withdrawToken(token1.target, user3.address, ethers.parseEther("1"))
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Balance Queries", function () {
    beforeEach(async function () {
      await initializePool();
    });

    it("Should return correct pool balances", async function () {
      // Add contributions
      await groupPool.addMember(user2.address);
      await groupPool.addSupportedToken(token1.target);

      await user2.sendTransaction({
        to: groupPool.target,
        value: ethers.parseEther("1")
      });

      await token1.mint(user2.address, ethers.parseEther("5"));
      await token1.connect(user2).approve(groupPool.target, ethers.parseEther("5"));
      await groupPool.connect(user2).contributeToken(token1.target, ethers.parseEther("5"));

      const balances = await groupPool.getPoolBalances();
      expect(balances.ethBalance).to.equal(ethers.parseEther("1"));
      expect(balances.tokens).to.include(token1.target);
      expect(balances.tokenBalances[0]).to.equal(ethers.parseEther("5"));
    });

    it("Should return correct group members", async function () {
      await groupPool.addMember(user2.address);
      await groupPool.addMember(user3.address);

      const members = await groupPool.getGroupMembers();
      expect(members).to.include(user2.address);
      expect(members).to.include(user3.address);
      expect(members.length).to.equal(2);
    });

    it("Should return correct supported tokens", async function () {
      await groupPool.addSupportedToken(token1.target);
      await groupPool.addSupportedToken(token2.target);

      const tokens = await groupPool.getSupportedTokens();
      expect(tokens).to.include(token1.target);
      expect(tokens).to.include(token2.target);
      expect(tokens.length).to.equal(2);
    });
  });

  describe("Edge Cases", function () {
    beforeEach(async function () {
      await initializePool();
    });

    it("Should handle empty contributions gracefully", async function () {
      await groupPool.addMember(user2.address);

      // Try to contribute zero (should fail)
      await expect(
        user2.sendTransaction({
          to: groupPool.target,
          value: 0
        })
      ).to.be.reverted;
    });

    it("Should handle maximum members correctly", async function () {
      // Add maximum members
      const members = [];
      for (let i = 0; i < maxMembers; i++) {
        const wallet = ethers.Wallet.createRandom();
        members.push(wallet.address);
        await groupPool.addMember(wallet.address);
      }

      const groupMembers = await groupPool.getGroupMembers();
      expect(groupMembers.length).to.equal(maxMembers);
    });

    it("Should handle concurrent contributions", async function () {
      await groupPool.addMember(user2.address);
      await groupPool.addMember(user3.address);

      const contribution1 = ethers.parseEther("0.05");
      const contribution2 = ethers.parseEther("0.03");

      // Both contribute simultaneously
      await Promise.all([
        user2.sendTransaction({ to: groupPool.target, value: contribution1 }),
        user3.sendTransaction({ to: groupPool.target, value: contribution2 })
      ]);

      const window = await groupPool.getPaymentWindow(1);
      expect(window.total).to.equal(contribution1 + contribution2);
    });

    it("Should handle token contribution edge cases", async function () {
      await groupPool.addMember(user2.address);
      await groupPool.addSupportedToken(token1.target);

      // Try to contribute more than balance
      await token1.mint(user2.address, ethers.parseEther("1"));
      await token1.connect(user2).approve(groupPool.target, ethers.parseEther("10"));

      await expect(
        groupPool.connect(user2).contributeToken(token1.target, ethers.parseEther("10"))
      ).to.be.reverted;
    });
  });
});
