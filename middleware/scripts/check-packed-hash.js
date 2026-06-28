import { ethers } from "ethers";

const CONTRACT_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
const CHAIN_ID = 31337n;
const DEVICE_ADDRESS = "0xc2E770A8460ac16C83285225FBB175EFf65Ab186";

const value = 25n;
const deviceTimestamp = 1700000000n;
const nonce = 1n;

const packed = ethers.solidityPacked(
    ["address", "uint256", "address", "int256", "uint256", "uint256"],
    [CONTRACT_ADDRESS, CHAIN_ID, DEVICE_ADDRESS, value, deviceTimestamp, nonce]
);

const dataHash = ethers.keccak256(packed);

console.log("packed:", packed);
console.log("packed length:", packed.slice(2).length);
console.log("dataHash:", dataHash);