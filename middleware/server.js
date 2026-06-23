import "dotenv/config"; // carica file .env, con RPC_URL, CONTRACT_ADDRESS, RELAYER_PRIVATE_KEY, ecc. tramite process.env

import express from "express";
import { ethers } from "ethers";

// 1. Configurazione iniziale
const PORT = Number(process.env.PORT ?? 3000);
const RPC_URL = process.env.RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const DEVICE_API_KEY = process.env.DEVICE_API_KEY;
const CONFIRMATIONS = Number(process.env.CONFIRMATIONS ?? 1);

const IOT_DATA_STORAGE_ABI = [
    "function getDevice(address deviceAddress) view returns (tuple(bool isRegistered, string metadataURI, uint256 registeredAt))",
    "function getLastNonce(address deviceAddress) view returns (uint256)",
    "function getMeasurementHash(address deviceAddress, int256 value, uint256 deviceTimestamp, uint256 nonce) view returns (bytes32)",
    "function recordSignedMeasurement(address deviceAddress, int256 value, uint256 deviceTimestamp, uint256 nonce, bytes signature)",
];

// classe per errori HTTP
class HttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}

validateEnvironment();

const app = express();

app.use(express.json({ limit: "16kb" }));

const provider = new ethers.JsonRpcProvider(RPC_URL);

const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

const iotDataStorage = new ethers.Contract(CONTRACT_ADDRESS, IOT_DATA_STORAGE_ABI, relayerWallet);

// 2. Routes

app.get("/health", handleHealthCheck);

app.post("/api/measurements", authenticateDeviceRequest, recordMeasurement);

// 3. Middleware errori

app.use(notFoundHandler);

app.use(errorHandler);

// 4. Avvio server
app.listen(PORT, onServerStart);

function onServerStart() {
    console.log(`Middleware avviato su http://localhost:${PORT}`);
    console.log(`Contratto: ${CONTRACT_ADDRESS}`);
    console.log(`Relayer: ${relayerWallet.address}`);
}

// 5. Funzioni usate dalle routes e dai middleware

// endopint per verificare durante sviluppo per fare controllo rapido su funzionamento server 
async function handleHealthCheck(req, res, next) {
    try {
        const blockNumber = await provider.getBlockNumber();
        const relayerAddress = await relayerWallet.getAddress();

        res.json({
            status: "ok",
            blockNumber: blockNumber,
            contractAddress: CONTRACT_ADDRESS,
            relayerAddress: relayerAddress,
        });
    } catch (error) {
        next(error); // gestisco errori con funzione next
    }
}

// all'interno ci sono controlli che servono per evitare di inviare tx blockchain inutili che farebbero comunque spendere gas
async function recordMeasurement(req, res, next) {
    try {
        // Prima valido e normalizzo il payload ricevuto dall'ESP32.
        // Poi controllo device registrato e nonce, così evito transazioni inutili.        const measurement = parseMeasurementRequest(req);
        const measurement = parseMeasurementRequest(req);

        await assertDeviceIsRegistered(measurement.deviceAddress);
        await assertNonceIsFresh(measurement.deviceAddress, measurement.nonce);

        // superati "primi controlli", adesso controllo che hash e firma corrispondono all'address del dispositivo
        const dataHash = await iotDataStorage.getMeasurementHash(
            measurement.deviceAddress,
            measurement.value,
            measurement.deviceTimestamp,
            measurement.nonce,
        );

        assertSignatureMatchesDevice(
            dataHash,
            measurement.signature,
            measurement.deviceAddress,
        );

        // registro misurazione
        const transactionResponse = await iotDataStorage.recordSignedMeasurement(
            measurement.deviceAddress,
            measurement.value,
            measurement.deviceTimestamp,
            measurement.nonce,
            measurement.signature,
        );

        const receipt = await transactionResponse.wait(CONFIRMATIONS);

        res.status(201).json({
            status: "recorded",
            transactionHash: transactionResponse.hash,
            blockNumber: receipt?.blockNumber ?? null,
            deviceAddress: measurement.deviceAddress,
            value: measurement.value.toString(),
            deviceTimestamp: measurement.deviceTimestamp.toString(),
            nonce: measurement.nonce.toString(),
            dataHash,
        });
    } catch (error) {
        next(error);
    }
}

function authenticateDeviceRequest(req, res, next) {
    const apiKey = req.header("X-API-Key");

    if (apiKey !== DEVICE_API_KEY) {
        next(new HttpError(401, "API key dispositivo non valida"));
        return;
    }

    next();
}

function parseMeasurementRequest(req) {
    const { deviceAddress, value, deviceTimestamp, nonce, signature } = req.body;

    if (!ethers.isAddress(deviceAddress)) {
        throw new HttpError(400, "deviceAddress non valido");
    }

    if (!isIntegerLike(value)) {
        throw new HttpError(400, "value deve essere un intero");
    }

    if (!isIntegerLike(deviceTimestamp)) {
        throw new HttpError(400, "deviceTimestamp deve essere un intero");
    }

    if (!isIntegerLike(nonce)) {
        throw new HttpError(400, "nonce deve essere un intero");
    }

    if (!ethers.isHexString(signature)) {
        throw new HttpError(400, "signature deve essere una stringa esadecimale");
    }

    if (ethers.dataLength(signature) !== 65) {
        throw new HttpError(400, "signature deve essere lunga 65 byte");
    }

    const parsedValue = BigInt(value);
    const parsedDeviceTimestamp = BigInt(deviceTimestamp);
    const parsedNonce = BigInt(nonce);

    if (parsedDeviceTimestamp < 0n) {
        throw new HttpError(400, "deviceTimestamp non può essere negativo");
    }

    if (parsedNonce <= 0n) {
        throw new HttpError(400, "nonce deve essere maggiore di zero");
    }

    return {
        deviceAddress: ethers.getAddress(deviceAddress),
        value: parsedValue,
        deviceTimestamp: parsedDeviceTimestamp,
        nonce: parsedNonce,
        signature,
    };
}

function isIntegerLike(value) {
    if (typeof value === "bigint") {
        return true;
    }

    if (typeof value === "number") {
        return Number.isInteger(value);
    }

    if (typeof value === "string") {
        return /^-?\d+$/.test(value);
    }

    return false;
}

async function assertDeviceIsRegistered(deviceAddress) {
    const device = await iotDataStorage.getDevice(deviceAddress);

    if (!device.isRegistered) {
        throw new HttpError(400, "Dispositivo non registrato");
    }
}

async function assertNonceIsFresh(deviceAddress, nonce) {
    const lastNonce = await iotDataStorage.getLastNonce(deviceAddress);

    if (nonce <= lastNonce) {
        throw new HttpError(409, "Nonce già usato o non valido");
    }
}

function assertSignatureMatchesDevice(dataHash, signature, deviceAddress) {
    const recoveredAddress = ethers.verifyMessage(
        ethers.getBytes(dataHash),
        signature
    );

    if (recoveredAddress !== deviceAddress) {
        throw new HttpError(400, "Firma non coerente con il deviceAddress");
    }
}

function validateEnvironment() {
    const missingVariables = [];

    if (!RPC_URL) {
        missingVariables.push("RPC_URL");
    }

    if (!CONTRACT_ADDRESS) {
        missingVariables.push("CONTRACT_ADDRESS");
    }

    if (!RELAYER_PRIVATE_KEY) {
        missingVariables.push("RELAYER_PRIVATE_KEY");
    }

    if (!DEVICE_API_KEY) {
        missingVariables.push("DEVICE_API_KEY");
    }

    if (missingVariables.length > 0) {
        throw new Error(`Variabili d'ambiente mancanti: ${missingVariables.join(", ")}`
        );
    }

    if (!ethers.isAddress(CONTRACT_ADDRESS)) {
        throw new Error("CONTRACT_ADDRESS non è un address Ethereum valido");
    }

    if (!Number.isInteger(PORT) || PORT <= 0) {
        throw new Error("PORT deve essere un numero intero positivo");
    }

    if (!Number.isInteger(CONFIRMATIONS) || CONFIRMATIONS < 0) {
        throw new Error("CONFIRMATIONS deve essere un intero maggiore o uguale a zero");
    }
}

function notFoundHandler(req, res, next) {
    next(new HttpError(404, `Endpoint non trovato: ${req.method} ${req.originalUrl}`));
}

function errorHandler(error, req, res, next) {
    const statusCode = error.statusCode ?? 500;

    console.error(error);

    res.status(statusCode).json({
        status: "error",
        message: error.message ?? "Errore interno del server",
    });
}













