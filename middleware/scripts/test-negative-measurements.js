import "dotenv/config";

import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const DEVICE_API_KEY = process.env.DEVICE_API_KEY;
const DEVICE_PRIVATE_KEY = process.env.DEVICE_PRIVATE_KEY;
const MIDDLEWARE_URL =
    process.env.MIDDLEWARE_URL ?? "http://localhost:3000/api/measurements";

const IOT_DATA_STORAGE_ABI = [
    "function getDevice(address deviceAddress) view returns (tuple(bool isRegistered, string metadataURI, uint256 registeredAt))",
    "function getLastNonce(address deviceAddress) view returns (uint256)",
];

validateEnvironment();

const contractAddress = ethers.getAddress(CONTRACT_ADDRESS);

const provider = new ethers.JsonRpcProvider(RPC_URL);

const deviceWallet = new ethers.Wallet(DEVICE_PRIVATE_KEY, provider);

const iotDataStorage = new ethers.Contract(
    contractAddress,
    IOT_DATA_STORAGE_ABI,
    provider,
);

async function main() {
    const deviceAddress = await deviceWallet.getAddress();

    console.log("Device simulato:", deviceAddress);

    await assertDeviceIsRegistered(deviceAddress);

    const lastNonce = await iotDataStorage.getLastNonce(deviceAddress);
    const nextNonce = lastNonce + 1n;

    console.log("Ultimo nonce on-chain:", lastNonce.toString());
    console.log("Nonce usato nei test:", nextNonce.toString());
    console.log("");

    const validPayload = await buildSignedPayload({
        deviceAddress,
        value: 25n,
        deviceTimestamp: BigInt(Math.floor(Date.now() / 1000)),
        nonce: nextNonce,
    });

    await runExpectedFailureTest({
        title: "Test 1 - API key sbagliata",
        payload: validPayload,
        apiKey: "api-key-sbagliata",
        expectedStatus: 401,
    });

    const tamperedValuePayload = {
        ...validPayload,
        value: "99",
    };

    await runExpectedFailureTest({
        title: "Test 2 - Valore alterato dopo la firma",
        payload: tamperedValuePayload,
        apiKey: DEVICE_API_KEY,
        expectedStatus: 400,
    });

    const tamperedTimestampPayload = {
        ...validPayload,
        deviceTimestamp: (BigInt(validPayload.deviceTimestamp) + 60n).toString(),
    };

    await runExpectedFailureTest({
        title: "Test 3 - Timestamp alterato dopo la firma",
        payload: tamperedTimestampPayload,
        apiKey: DEVICE_API_KEY,
        expectedStatus: 400,
    });

    const tamperedNoncePayload = {
        ...validPayload,
        nonce: (BigInt(validPayload.nonce) + 1n).toString(),
    };

    await runExpectedFailureTest({
        title: "Test 4 - Nonce alterato dopo la firma",
        payload: tamperedNoncePayload,
        apiKey: DEVICE_API_KEY,
        expectedStatus: 400,
    });

    await runExpectedSuccessTest({
        title: "Test 5 - Misura valida",
        payload: validPayload,
        apiKey: DEVICE_API_KEY,
    });

    await runExpectedFailureTest({
        title: "Test 6 - Replay della stessa misura",
        payload: validPayload,
        apiKey: DEVICE_API_KEY,
        expectedStatus: 409,
    });

    console.log("");
    console.log("Test negativi completati.");
}

async function buildSignedPayload({ deviceAddress, value, deviceTimestamp, nonce }) {
    const dataHash = await getMeasurementHashLocal(
        deviceAddress,
        value,
        deviceTimestamp,
        nonce,
    );

    const signature = await deviceWallet.signMessage(ethers.getBytes(dataHash));

    return {
        deviceAddress,
        value: value.toString(),
        deviceTimestamp: deviceTimestamp.toString(),
        nonce: nonce.toString(),
        signature,
    };
}

async function runExpectedFailureTest({ title, payload, apiKey, expectedStatus }) {
    console.log(title);

    const response = await postMeasurement(payload, apiKey);
    const responseBody = await readJsonOrText(response);

    if (response.status !== expectedStatus) {
        throw new Error(
            `Test fallito. Status atteso: ${expectedStatus}, status ricevuto: ${response.status}. Risposta: ${JSON.stringify(responseBody)}`,
        );
    }

    console.log("Esito atteso: richiesta rifiutata");
    console.log("Status:", response.status);
    console.log("Risposta:", responseBody);
    console.log("");
}

async function runExpectedSuccessTest({ title, payload, apiKey }) {
    console.log(title);

    const response = await postMeasurement(payload, apiKey);
    const responseBody = await readJsonOrText(response);

    if (!response.ok) {
        throw new Error(
            `Test fallito. La misura valida è stata rifiutata. Status: ${response.status}. Risposta: ${JSON.stringify(responseBody)}`,
        );
    }

    console.log("Esito atteso: misura registrata");
    console.log("Status:", response.status);
    console.log("Risposta:", responseBody);
    console.log("");
}

async function postMeasurement(payload, apiKey) {
    return fetch(MIDDLEWARE_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
        },
        body: JSON.stringify(payload),
    });
}

async function readJsonOrText(response) {
    const text = await response.text();

    try {
        return JSON.parse(text);
    } catch {
        return text;
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