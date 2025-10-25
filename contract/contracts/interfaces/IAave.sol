// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IAavePool
 * @notice Simplified interface for Aave V3 Pool - only functions we need
 */
interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external payable;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

/**
 * @title IAToken
 * @notice Interface for Aave aTokens (interest-bearing tokens)
 */
interface IAToken {
    function balanceOf(address account) external view returns (uint256);
}
