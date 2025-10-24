// Thirdweb client and wallets configuration for Saiv
import { createThirdwebClient, defineChain } from "thirdweb";
import { inAppWallet, createWallet } from "thirdweb/wallets";

export const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

export const client = clientId ? createThirdwebClient({ clientId }) : undefined as any;

// Supported networks for the app.
// To change networks later, edit this array. Example: add/remove chains from supportedChains.
// Reference: used by ThirdwebProvider chains prop in Providers component.
/**
 * Best-practice: avoid direct chain imports that can differ across thirdweb versions/bundlers.
 * Define chains explicitly via defineChain(). This removes import fragility and lets you
 * customize RPCs via env vars.
 *
 * To change networks later, edit LISK/LISK_SEPOLIA here and the exported supportedChains array.
 */
export const LISK = defineChain({
  id: 295,
  name: "Lisk",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpc: process.env.NEXT_PUBLIC_RPC_LISK || "https://rpc.lisk.com",
  blockExplorers: [{ name: "Lisk Explorer", url: "https://explorer.lisk.com" }],
});

export const LISK_SEPOLIA = defineChain({
  id: 4202,
  name: "Lisk Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpc: process.env.NEXT_PUBLIC_RPC_LISK_SEPOLIA || "https://sepolia-rpc.lisk.com",
  blockExplorers: [{ name: "Lisk Sepolia Explorer", url: "https://sepolia-explorer.lisk.com" }],
});

export const supportedChains = [LISK, LISK_SEPOLIA];

export const wallets = [
  inAppWallet({
    auth: {
      options: ["google", "email"],
    },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
  createWallet("io.zerion.wallet"),
];