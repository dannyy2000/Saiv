// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IAave.sol";

/**
 * @title AavePoolMock
 * @dev Mock implementation of Aave Pool for testing
 */
contract AavePoolMock is IAavePool {
    mapping(address => address) public assetToAToken;
    mapping(address => uint256) public totalSupplied;

    event Supply(address indexed asset, uint256 amount, address indexed onBehalfOf, uint16 referralCode);
    event Withdraw(address indexed asset, uint256 amount, address indexed to);

    function setAToken(address asset, address aToken) external {
        assetToAToken[asset] = aToken;
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external payable override {
        require(assetToAToken[asset] != address(0), "Asset not supported");

        if (asset == address(0)) {
            // ETH supply - contract should have received ETH
            require(msg.value >= amount, "Insufficient ETH sent");
        } else {
            // ERC20 supply
            IERC20(asset).transferFrom(msg.sender, address(this), amount);
        }

        // Mint aTokens to the supplier
        address aToken = assetToAToken[asset];
        IERC20(aToken).transfer(onBehalfOf, amount);

        totalSupplied[asset] += amount;

        emit Supply(asset, amount, onBehalfOf, referralCode);
    }

    function withdraw(address asset, uint256 amount, address to) external override returns (uint256) {
        require(assetToAToken[asset] != address(0), "Asset not supported");

        address aToken = assetToAToken[asset];

        // Burn aTokens from the withdrawer
        IERC20(aToken).transferFrom(msg.sender, address(this), amount);

        if (asset == address(0)) {
            // ETH withdrawal
            payable(to).transfer(amount);
        } else {
            // ERC20 withdrawal
            IERC20(asset).transfer(to, amount);
        }

        totalSupplied[asset] -= amount;

        emit Withdraw(asset, amount, to);

        return amount;
    }

    // Allow contract to receive ETH
    receive() external payable {}
}