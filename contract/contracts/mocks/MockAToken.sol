// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IAave.sol";

/**
 * @title MockAToken
 * @dev Mock implementation of Aave aToken for testing
 */
contract MockAToken is IAToken {
    mapping(address => uint256) private balances;

    function balanceOf(address account) external view override returns (uint256) {
        return balances[account];
    }

    // Helper function to set balance for testing
    function setBalance(address account, uint256 amount) external {
        balances[account] = amount;
    }

    // Helper function to add to balance for testing
    function addToBalance(address account, uint256 amount) external {
        balances[account] += amount;
    }

    // Helper function to subtract from balance for testing
    function subtractFromBalance(address account, uint256 amount) external {
        require(balances[account] >= amount, "Insufficient balance");
        balances[account] -= amount;
    }
}