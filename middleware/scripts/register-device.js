import "dotenv/config";

import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
const DEVICE_PRIVATE_KEY = process.env.DEVICE_PRIVATE_KEY;
const DEVICE_ADDRESS = process.argv[2] ?? process.env.DEVICE_ADDRESS;
const METADATA_URI =
    process.argv[3] ?? process.env.METADATA_URI ?? "esp32-laboratorio";

const IOT_DATA_STORAGE_ABI = [
    "function getDevice(address deviceAddress) view returns (tuple(bool isRegistered, string metadataURI, uint256 registeredAt))",
    "function getOwner() view returns (address)",
    "function registerDevice(address deviceAddress, string metadataURI)",
];

validateEnvironment();

const provider = new ethers.JsonRpcProvider(RPC_URL);
const ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
const contractAddress = ethers.getAddress(CONTRACT_ADDRESS);
const iotDataStorage = new ethers.Contract(
    contractAddress,
    IOT_DATA_STORAGE_ABI,
    ownerWallet,
);

async function main() {
    const deviceAddress = getDeviceAddress();
    const ownerOnChain = await iotDataStorage.getOwner();

    if (ethers.getAddress(ownerOnChain) !== ethers.getAddress(ownerWallet.address)) {
        throw new Error(
            `OWNER_PRIVATE_KEY non corrisponde all'owner del contratto. Owner on-chain: ${ownerOnChain}, wallet configurato: ${ownerWallet.address}`,
        );
    }

    const device = await iotDataStorage.getDevice(deviceAddress);

    if (device.isRegistered) {
        console.log("Device già registrato.");
        console.log("Contratto:", contractAddress);
        console.log("Device:", deviceAddress);
        console.log("Metadata URI:", device.metadataURI);
        console.log("Registered at:", device.registeredAt.toString());
        return;
    }

    console.log("Registro device...");
    console.log("Contratto:", contractAddress);
    console.log("Owner:", ownerWallet.address);
    console.log("Device:", deviceAddress);
    console.log("Metadata URI:", METADATA_URI);

    const transactionResponse = await iotDataStorage.registerDevice(
        deviceAddress,
        METADATA_URI,
    );

    console.log("Transazione inviata:", transactionResponse.hash);

    const receipt = await transactionResponse.wait(1);

    console.log("Device registrato.");
    console.log("Block:", receipt?.blockNumber ?? "n/d");
}

function getDeviceAddress() {
    if (DEVICE_ADDRESS) {
        return ethers.getAddress(DEVICE_ADDRESS);
    }

    if (DEVICE_PRIVATE_KEY) {
        return new ethers.Wallet(DEVICE_PRIVATE_KEY).address;
    }

    throw new Error(
        "DEVICE_ADDRESS mancante. Passalo come argomento o configura DEVICE_PRIVATE_KEY per derivarlo.",
    );
}

function validateEnvironment() {
    const missingVariables = [];

    if (!RPC_URL) {
        missingVariables.push("RPC_URL");
    }

    if (!CONTRACT_ADDRESS) {
        missingVariables.push("CONTRACT_ADDRESS");
    }

    if (!OWNER_PRIVATE_KEY) {
        missingVariables.push("OWNER_PRIVATE_KEY");
    }

    if (missingVariables.length > 0) {
        throw new Error(
            `Variabili d'ambiente mancanti: ${missingVariables.join(", ")}`,
        );
    }

    if (!ethers.isAddress(CONTRACT_ADDRESS)) {
        throw new Error("CONTRACT_ADDRESS non è un address Ethereum valido");
    }

    if (!ethers.isHexString(OWNER_PRIVATE_KEY, 32)) {
        throw new Error(
            "OWNER_PRIVATE_KEY deve essere una private key esadecimale da 32 byte",
        );
    }
}

main().catch(function onError(error) {
    console.error(error);
    process.exitCode = 1;
});
