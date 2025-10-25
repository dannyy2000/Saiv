// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import {UserWallet} from "./UserWallet.sol";
import {GroupPool} from "./GroupPool.sol";

contract AddressManager {
    // UserWallet implementation contract
    address public immutable walletImplementation;

    // GroupPool implementation contract
    address public immutable groupPoolImplementation;

    // Mapping from user identifier to their main wallet address
    mapping(address => address) public userToMainWallet;

    // Mapping from user identifier to their savings wallet address
    mapping(address => address) public userToSavingsWallet;

    // Mapping from wallet address to user identifier
    mapping(address => address) public walletToUser;

    // Mapping from identifier hash to main wallet (for email users)
    mapping(bytes32 => address) public emailHashToMainWallet;

    // Mapping from identifier hash to savings wallet (for email users)
    mapping(bytes32 => address) public emailHashToSavingsWallet;

    // Array of all created wallets
    address[] public allWallets;

    // Mapping from group identifier to group pool address
    mapping(string => address) public groupToPool;

    // Mapping from pool address to group identifier
    mapping(address => string) public poolToGroup;

    // Array of all created group pools
    address[] public allGroupPools;

    // Owner of the contract
    address public owner;

    // System treasury for collecting fees
    address public systemTreasury;

    // Events
    event UserWalletsCreated(
        address indexed identifier,
        address indexed mainWallet,
        address indexed savingsWallet
    );

    event EmailUserWalletsCreated(
        bytes32 indexed emailHash,
        address indexed mainWallet,
        address indexed savingsWallet
    );

    event WalletDeployed(address indexed wallet, address indexed owner, string walletType);

    event GroupPoolCreated(
        string indexed groupIdentifier,
        address indexed poolAddress,
        address indexed owner
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor() {
        owner = msg.sender;
        systemTreasury = msg.sender; // Initially set treasury to owner

        // Deploy the UserWallet implementation contract
        walletImplementation = address(new UserWallet());

        // Deploy the GroupPool implementation contract
        groupPoolImplementation = address(new GroupPool());
    }

    /**
     * @dev Create wallets for a user using EOA address (Gasless - called by backend)
     * @param userIdentifier User's EOA address
     * @return mainWallet Address of created main wallet
     * @return savingsWallet Address of created savings wallet
     */
    function createUserWallets(address userIdentifier)
        external
        returns (address mainWallet, address savingsWallet)
    {
        require(userIdentifier != address(0), "Invalid user identifier");
        require(userToMainWallet[userIdentifier] == address(0), "Wallets already exist");

        // Create main wallet
        bytes32 mainSalt = keccak256(abi.encodePacked(userIdentifier, "main", block.timestamp));
        mainWallet = Clones.cloneDeterministic(walletImplementation, mainSalt);
        UserWallet(payable(mainWallet)).initialize(userIdentifier, address(this));

        // Create savings wallet
        bytes32 savingsSalt = keccak256(abi.encodePacked(userIdentifier, "savings", block.timestamp));
        savingsWallet = Clones.cloneDeterministic(walletImplementation, savingsSalt);
        UserWallet(payable(savingsWallet)).initialize(userIdentifier, address(this));

        // Store mappings
        userToMainWallet[userIdentifier] = mainWallet;
        userToSavingsWallet[userIdentifier] = savingsWallet;
        walletToUser[mainWallet] = userIdentifier;
        walletToUser[savingsWallet] = userIdentifier;

        // Add to wallets array
        allWallets.push(mainWallet);
        allWallets.push(savingsWallet);

        emit UserWalletsCreated(userIdentifier, mainWallet, savingsWallet);
        emit WalletDeployed(mainWallet, userIdentifier, "main");
        emit WalletDeployed(savingsWallet, userIdentifier, "savings");

        return (mainWallet, savingsWallet);
    }

    /**
     * @dev Create wallets for email user using email hash (Gasless - called by backend)
     * @param emailHash Hash of user's email
     * @param userIdentifier User identifier for ownership
     * @return mainWallet Address of created main wallet
     * @return savingsWallet Address of created savings wallet
     */
    function createEmailUserWallets(bytes32 emailHash, address userIdentifier)
        external
        returns (address mainWallet, address savingsWallet)
    {
        require(emailHash != bytes32(0), "Invalid email hash");
        require(userIdentifier != address(0), "Invalid user identifier");
        require(emailHashToMainWallet[emailHash] == address(0), "Wallets already exist");

        // Create main wallet
        bytes32 mainSalt = keccak256(abi.encodePacked(emailHash, "main", block.timestamp));
        mainWallet = Clones.cloneDeterministic(walletImplementation, mainSalt);
        UserWallet(payable(mainWallet)).initialize(userIdentifier, address(this));

        // Create savings wallet
        bytes32 savingsSalt = keccak256(abi.encodePacked(emailHash, "savings", block.timestamp));
        savingsWallet = Clones.cloneDeterministic(walletImplementation, savingsSalt);
        UserWallet(payable(savingsWallet)).initialize(userIdentifier, address(this));

        // Store mappings
        emailHashToMainWallet[emailHash] = mainWallet;
        emailHashToSavingsWallet[emailHash] = savingsWallet;
        walletToUser[mainWallet] = userIdentifier;
        walletToUser[savingsWallet] = userIdentifier;

        // Add to wallets array
        allWallets.push(mainWallet);
        allWallets.push(savingsWallet);

        emit EmailUserWalletsCreated(emailHash, mainWallet, savingsWallet);
        emit WalletDeployed(mainWallet, userIdentifier, "main");
        emit WalletDeployed(savingsWallet, userIdentifier, "savings");

        return (mainWallet, savingsWallet);
    }

    /**
     * @dev Generate a deterministic main wallet address preview
     * @param identifier The user identifier
     * @return The predicted main wallet address
     */
    function predictMainWalletAddress(address identifier, uint256 timestamp)
        external
        view
        returns (address)
    {
        bytes32 salt = keccak256(abi.encodePacked(identifier, "main", timestamp));
        return Clones.predictDeterministicAddress(walletImplementation, salt);
    }

    /**
     * @dev Generate a deterministic savings wallet address preview
     * @param identifier The user identifier
     * @return The predicted savings wallet address
     */
    function predictSavingsWalletAddress(address identifier, uint256 timestamp)
        external
        view
        returns (address)
    {
        bytes32 salt = keccak256(abi.encodePacked(identifier, "savings", timestamp));
        return Clones.predictDeterministicAddress(walletImplementation, salt);
    }

    /**
     * @dev Get user's main wallet address
     * @param userIdentifier User's identifier
     * @return User's main wallet address
     */
    function getUserMainWallet(address userIdentifier)
        external
        view
        returns (address)
    {
        return userToMainWallet[userIdentifier];
    }

    /**
     * @dev Get user's savings wallet address
     * @param userIdentifier User's identifier
     * @return User's savings wallet address
     */
    function getUserSavingsWallet(address userIdentifier)
        external
        view
        returns (address)
    {
        return userToSavingsWallet[userIdentifier];
    }

    /**
     * @dev Get email user's main wallet address
     * @param emailHash Hash of user's email
     * @return User's main wallet address
     */
    function getEmailUserMainWallet(bytes32 emailHash)
        external
        view
        returns (address)
    {
        return emailHashToMainWallet[emailHash];
    }

    /**
     * @dev Get email user's savings wallet address
     * @param emailHash Hash of user's email
     * @return User's savings wallet address
     */
    function getEmailUserSavingsWallet(bytes32 emailHash)
        external
        view
        returns (address)
    {
        return emailHashToSavingsWallet[emailHash];
    }

    /**
     * @dev Get wallet owner
     * @param walletAddr Wallet address
     * @return Owner's identifier
     */
    function getWalletOwner(address walletAddr)
        external
        view
        returns (address)
    {
        return walletToUser[walletAddr];
    }

    /**
     * @dev Get total number of wallets created
     * @return Total wallet count
     */
    function getTotalWallets() external view returns (uint256) {
        return allWallets.length;
    }

    /**
     * @dev Get wallet at index
     * @param index Index in wallets array
     * @return Wallet address
     */
    function getWalletAtIndex(uint256 index) external view returns (address) {
        require(index < allWallets.length, "Index out of bounds");
        return allWallets[index];
    }

    /**
     * @dev Add supported token to a wallet
     * @param walletAddr Wallet address
     * @param token Token contract address
     */
    function addSupportedTokenToWallet(address walletAddr, address token)
        external
        onlyOwner
    {
        require(walletAddr != address(0), "Invalid wallet address");
        require(token != address(0), "Invalid token address");

        UserWallet(payable(walletAddr)).addSupportedToken(token);
    }

    /**
     * @dev Add supported token to all wallets
     * @param token Token contract address
     */
    function addSupportedTokenToAllWallets(address token)
        external
        onlyOwner
    {
        require(token != address(0), "Invalid token address");

        for (uint256 i = 0; i < allWallets.length; i++) {
            try UserWallet(payable(allWallets[i])).addSupportedToken(token) {
                // Token added successfully
            } catch {
                // Skip if token already supported or other error
            }
        }
    }

    /**
     * @dev Create a group pool contract (Gasless - backend pays gas)
     * @param groupIdentifier Unique identifier for the group
     * @param groupOwner Owner of the group
     * @param groupName Name of the group
     * @param paymentWindowDuration Duration of each payment window in seconds
     * @param minContribution Minimum contribution amount
     * @param maxMembers Maximum number of members
     * @return poolAddress Address of the created group pool
     */
    function createGroupPool(
        string memory groupIdentifier,
        address groupOwner,
        string memory groupName,
        uint256 paymentWindowDuration,
        uint256 minContribution,
        uint256 maxMembers
    ) external returns (address poolAddress) {
        require(bytes(groupIdentifier).length > 0, "Invalid group identifier");
        require(groupOwner != address(0), "Invalid group owner");
        require(groupToPool[groupIdentifier] == address(0), "Group pool already exists");
        require(paymentWindowDuration > 0, "Invalid payment window duration");

        // Create group pool using clones
        bytes32 salt = keccak256(abi.encodePacked(groupIdentifier, block.timestamp));
        poolAddress = Clones.cloneDeterministic(groupPoolImplementation, salt);

        // Initialize the group pool
        GroupPool(payable(poolAddress)).initialize(
            groupOwner,
            address(this),
            groupName,
            paymentWindowDuration,
            minContribution,
            maxMembers,
            30 days, // Default lock period of 30 days
            systemTreasury // System treasury for fees
        );

        // Store mappings
        groupToPool[groupIdentifier] = poolAddress;
        poolToGroup[poolAddress] = groupIdentifier;

        // Add to pools array
        allGroupPools.push(poolAddress);

        emit GroupPoolCreated(groupIdentifier, poolAddress, groupOwner);

        return poolAddress;
    }

    /**
     * @dev Get group pool address by group identifier
     * @param groupIdentifier Group identifier
     * @return Pool address
     */
    function getGroupPool(string memory groupIdentifier) external view returns (address) {
        return groupToPool[groupIdentifier];
    }

    /**
     * @dev Get group identifier by pool address
     * @param poolAddress Pool address
     * @return Group identifier
     */
    function getGroupIdentifier(address poolAddress) external view returns (string memory) {
        return poolToGroup[poolAddress];
    }

    /**
     * @dev Get total number of group pools created
     * @return Total pool count
     */
    function getTotalGroupPools() external view returns (uint256) {
        return allGroupPools.length;
    }

    /**
     * @dev Get group pool at index
     * @param index Index in pools array
     * @return Pool address
     */
    function getGroupPoolAtIndex(uint256 index) external view returns (address) {
        require(index < allGroupPools.length, "Index out of bounds");
        return allGroupPools[index];
    }

    /**
     * @dev Add member to group pool
     * @param poolAddress Pool address
     * @param member Member address
     */
    function addMemberToGroupPool(address poolAddress, address member) external onlyOwner {
        require(poolAddress != address(0), "Invalid pool address");
        require(member != address(0), "Invalid member address");

        GroupPool(payable(poolAddress)).addMember(member);
    }

    /**
     * @dev Remove member from group pool
     * @param poolAddress Pool address
     * @param member Member address
     */
    function removeMemberFromGroupPool(address poolAddress, address member) external onlyOwner {
        require(poolAddress != address(0), "Invalid pool address");
        require(member != address(0), "Invalid member address");

        GroupPool(payable(poolAddress)).removeMember(member);
    }

    /**
     * @dev Add supported token to group pool
     * @param poolAddress Pool address
     * @param tokenAddress Token address
     */
    function addSupportedTokenToGroupPool(address poolAddress, address tokenAddress) external onlyOwner {
        require(poolAddress != address(0), "Invalid pool address");
        require(tokenAddress != address(0), "Invalid token address");

        GroupPool(payable(poolAddress)).addSupportedToken(tokenAddress);
    }

    /**
     * @dev Transfer ownership of the contract
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        owner = newOwner;
    }

    /**
     * @dev Set system treasury address for fee collection
     * @param newTreasury Address of the new system treasury
     */
    function setSystemTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Treasury cannot be zero address");
        systemTreasury = newTreasury;
    }

    /**
     * @dev Emergency function to interact with wallets
     * @param walletAddr Wallet address
     * @param data Call data
     */
    function emergencyCall(address walletAddr, bytes calldata data)
        external
        onlyOwner
        returns (bytes memory)
    {
        require(walletAddr != address(0), "Invalid wallet address");
        (bool success, bytes memory result) = walletAddr.call(data);
        require(success, "Emergency call failed");
        return result;
    }
}