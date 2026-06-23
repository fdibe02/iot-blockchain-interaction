import "dotenv/config";

import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const DEVICE_API_KEY = process.env.DEVICE_API_KEY;
const DEVICE_PRIVATE_KEY = process.env.DEVICE_PRIVATE_KEY;
const MIDDLEWARE_URL =
    process.env.MIDDLEWARE_URL ?? "http://localhost:3000/api/measurements";

const MEASUREMENT_VALUE = process.argv[2] ?? process.env.MEASUREMENT_VALUE ?? "25";

const IOT_DATA_STORAGE_ABI = [
    "function getDevice(address deviceAddress) view returns (tuple(bool isRegistered, string metadataURI, uint256 registeredAt))",
    "function getLastNonce(address deviceAddress) view returns (uint256)",
    "function getMeasurementHash(address deviceAddress, int256 value, uint256 deviceTimestamp, uint256 nonce) view returns (bytes32)",
];

validateEnvironment();

const provider = new ethers.JsonRpcProvider(RPC_URL);

const deviceWallet = new ethers.Wallet(DEVICE_PRIVATE_KEY, provider);

const iotDataStorage = new ethers.Contract(
    CONTRACT_ADDRESS,
    IOT_DATA_STORAGE_ABI,
    provider,
);

async function main() {
    const deviceAddress = await deviceWallet.getAddress();

    const value = parseInteger(MEASUREMENT_VALUE, "MEASUREMENT_VALUE");
    const deviceTimestamp = BigInt(Math.floor(Date.now() / 1000));

    const lastNonce = await iotDataStorage.getLastNonce(deviceAddress);
    const nonce = lastNonce + 1n;

    await assertDeviceIsRegistered(deviceAddress);

    const dataHash = await iotDataStorage.getMeasurementHash(
        deviceAddress,
        value,
        deviceTimestamp,
        nonce,
    );

    const signature = await deviceWallet.signMessage(ethers.getBytes(dataHash));

    assertSignatureMatchesDevice(dataHash, signature, deviceAddress);

    const payload = {
        deviceAddress,
        value: value.toString(),
        deviceTimestamp: deviceTimestamp.toString(),
        nonce: nonce.toString(),
        signature,
    };

    console.log("Misura simulata:");
    console.log(payload);
    console.log("Data hash:", dataHash);

    const response = await fetch(MIDDLEWARE_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": DEVICE_API_KEY,
        },
        body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
        throw new Error(
            `Middleware ha risposto con errore ${response.status}: ${responseText}`,
        );
    }

    console.log("Risposta middleware:");
    console.log(JSON.parse(responseText));
}

function assertSignatureMatchesDevice(dataHash, signature, deviceAddress) {
    const recoveredAddress = ethers.verifyMessage(
        ethers.getBytes(dataHash),
        signature,
    );

    if (recoveredAddress !== deviceAddress) {
        throw new Error(
            `Firma non valida: recovered=${recoveredAddress}, expected=${deviceAddress}`,
        );
    }
}

async function assertDeviceIsRegistered(deviceAddress) {
    const device = await iotDataStorage.getDevice(deviceAddress);

    if (!device.isRegistered) {
        throw new Error(
            `Device non registrato: ${deviceAddress}. Registralo prima nel contratto.`,
        );
    }
}

function parseInteger(value, variableName) {
    const stringValue = String(value);

    if (!/^-?\d+$/.test(stringValue)) {
        throw new Error(`${variableName} deve essere un intero`);
    }

    return BigInt(stringValue);
}

function validateEnvironment() {
    const missingVariables = [];

    if (!RPC_URL) {
        missingVariables.push("RPC_URL");
    }

    if (!CONTRACT_ADDRESS) {
        missingVariables.push("CONTRACT_ADDRESS");
    }

    if (!DEVICE_API_KEY) {
        missingVariables.push("DEVICE_API_KEY");
    }

    if (!DEVICE_PRIVATE_KEY) {
        missingVariables.push("DEVICE_PRIVATE_KEY");
    }

    if (missingVariables.length > 0) {
        throw new Error(
            `Variabili d'ambiente mancanti: ${missingVariables.join(", ")}`,
        );
    }

    if (!ethers.isAddress(CONTRACT_ADDRESS)) {
        throw new Error("CONTRACT_ADDRESS non è un address Ethereum valido");
    }

    if (!ethers.isHexString(DEVICE_PRIVATE_KEY, 32)) {
        throw new Error(
            "DEVICE_PRIVATE_KEY deve essere una private key esadecimale da 32 byte",
        );
    }
}

main().catch(function onError(error) {
    console.error(error);
    process.exitCode = 1;
});