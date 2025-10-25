// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IAave.sol";

/**
 * @title MockAavePool
 * @dev Mock implementation of Aave Pool for testing
 */
contract MockAavePool is IAavePool {
    mapping(address => mapping(address => uint256)) public userSupplied;

    event Supply(address indexed asset, uint256 amount, address indexed onBehalfOf, uint16 referralCode);
    event Withdraw(address indexed asset, uint256 amount, address indexed to);

    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external payable override {
        userSupplied[onBehalfOf][asset] += amount;
        emit Supply(asset, amount, onBehalfOf, referralCode);
    }

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external override returns (uint256) {
        // Simulate withdrawal - return the amount requested
        emit Withdraw(asset, amount, to);
        return amount;
    }

    // Helper function to check supplied amounts
    function getSuppliedAmount(address user, address asset) external view returns (uint256) {
        return userSupplied[user][asset];
    }
}