import "dotenv/config";

import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const DEVICE_PRIVATE_KEY = process.env.DEVICE_PRIVATE_KEY;

const IOT_DATA_STORAGE_ABI = [
    "function getLastNonce(address deviceAddress) view returns (uint256)",
    "function getMeasurementHash(address deviceAddress, int256 value, uint256 deviceTimestamp, uint256 nonce) view returns (bytes32)",
];

validateEnvironment();

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contractAddress = ethers.getAddress(CONTRACT_ADDRESS);
const deviceWallet = new ethers.Wallet(DEVICE_PRIVATE_KEY, provider);

const iotDataStorage = new ethers.Contract(
    contractAddress,
    IOT_DATA_STORAGE_ABI,
    provider
);

async function main() {
    const deviceAddress = await deviceWallet.getAddress();
    const lastNonce = await iotDataStorage.getLastNonce(deviceAddress);
    const nextNonce = lastNonce + 1n;

    const measurement = {
        deviceAddress,
        value: 25n,
        deviceTimestamp: BigInt(Math.floor(Date.now() / 1000)),
        nonce: nextNonce,
    };

    const localHash = await getMeasurementHashLocal(measurement);

    const contractHash = await iotDataStorage.getMeasurementHash(
        measurement.deviceAddress,
        measurement.value,
        measurement.deviceTimestamp,
        measurement.nonce
    );

    console.log("Device:", measurement.deviceAddress);
    console.log("Value:", measurement.value.toString());
    console.log("Timestamp:", measurement.deviceTimestamp.toString());
    console.log("Nonce:", measurement.nonce.toString());
    console.log("");
    console.log("Hash locale:   ", localHash);
    console.log("Hash contratto:", contractHash);

    if (localHash !== contractHash) {
        throw new Error("Hash locale diverso dall'hash del contratto");
    }

    console.log("");
    console.log("OK: hash locale e hash del contratto coincidono");
}

async function getMeasurementHashLocal({
    deviceAddress,
    value,
    deviceTimestamp,
    nonce,
}) {
    const network = await provider.getNetwork();

    return ethers.solidityPackedKeccak256(
        ["address", "uint256", "address", "int256", "uint256", "uint256"],
        [
            contractAddress,
            network.chainId,
            deviceAddress,
            value,
            deviceTimestamp,
            nonce,
        ]
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

    if (!DEVICE_PRIVATE_KEY) {
        missingVariables.push("DEVICE_PRIVATE_KEY");
    }

    if (missingVariables.length > 0) {
        throw new Error(
            `Variabili d'ambiente mancanti: ${missingVariables.join(", ")}`
        );
    }

    if (!ethers.isAddress(CONTRACT_ADDRESS)) {
        throw new Error("CONTRACT_ADDRESS non è un address Ethereum valido");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});