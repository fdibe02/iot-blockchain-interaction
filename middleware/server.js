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

// per normalizzare la parte s della signature
const SECP256K1_N =
    0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

const SECP256K1_HALF_N = SECP256K1_N / 2n;

const UINT256_MASK =
    0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;

const IOT_DATA_STORAGE_ABI = [
    "function getDevice(address deviceAddress) view returns (tuple(bool isRegistered, string metadataURI, uint256 registeredAt))",
    "function getLastNonce(address deviceAddress) view returns (uint256)",
    "function getMeasurementHash(address deviceAddress, int256 value, uint256 deviceTimestamp, uint256 nonce) view returns (bytes32)",
    "function recordSignedMeasurement(address deviceAddress, int256 value, uint256 deviceTimestamp, uint256 nonce, bytes signature)",
];

const INT256_MIN = -(1n << 255n);
const INT256_MAX = (1n << 255n) - 1n;
const UINT256_MAX = UINT256_MASK;

const pendingLastNonceByDevice = new Map();

// classe per errori HTTP
class HttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}

validateEnvironment();

const contractAddress = ethers.getAddress(CONTRACT_ADDRESS);

const app = express();

app.use(express.json({ limit: "16kb" }));

const provider = new ethers.JsonRpcProvider(RPC_URL);

const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

const iotDataStorage = new ethers.Contract(contractAddress, IOT_DATA_STORAGE_ABI, relayerWallet);

// 2. Routes

app.get("/health", handleHealthCheck);

app.post("/api/measurements", authenticateDeviceRequest, recordMeasurement);

app.get("/api/devices/:deviceAddress/nonce", authenticateDeviceRequest, getDeviceNonce);

// 3. Middleware errori

app.use(notFoundHandler);

app.use(errorHandler);

// 4. Avvio server
app.listen(PORT, onServerStart);

function onServerStart() {
    console.log(`Middleware avviato su http://localhost:${PORT}`);
    console.log(`Contratto: ${contractAddress}`);
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

async function getDeviceNonce(req, res, next) {
    try {
        const { deviceAddress } = req.params;

        if (!ethers.isAddress(deviceAddress)) {
            throw new HttpError(400, "deviceAddress non valido");
        }

        const normalizedDeviceAddress = ethers.getAddress(deviceAddress);

        await assertDeviceIsRegistered(normalizedDeviceAddress);

        const lastNonceOnChain = await iotDataStorage.getLastNonce(
            normalizedDeviceAddress,
        );

        const pendingLastNonce =
            pendingLastNonceByDevice.get(normalizedDeviceAddress) ?? 0n;

        const effectiveLastNonce =
            lastNonceOnChain > pendingLastNonce
                ? lastNonceOnChain
                : pendingLastNonce;

        const nextNonce = effectiveLastNonce + 1n;

        res.json({
            status: "ok",
            deviceAddress: normalizedDeviceAddress,

            // Valore usato davvero dal firmware per calcolare nextNonce.
            lastNonce: effectiveLastNonce.toString(),
            nextNonce: nextNonce.toString(),

            // Campi utili solo per debug/log.
            onChainLastNonce: lastNonceOnChain.toString(),
            pendingLastNonce: pendingLastNonce.toString(),
        });
    } catch (error) {
        next(error);
    }
}

async function recordMeasurement(req, res, next) {
    try {
        // Prima valido e normalizzo il payload ricevuto dall'ESP32.
        // Poi controllo device registrato e nonce, così evito transazioni inutili.
        const measurement = parseMeasurementRequest(req);

        await assertDeviceIsRegistered(measurement.deviceAddress);
        await assertNonceIsFresh(measurement.deviceAddress, measurement.nonce);

        // Calcolo locale dell'hash, senza chiamare getMeasurementHash sul contratto.
        const dataHash = await getMeasurementHashLocal(measurement);

        const signatureForContract = normalizeSignatureForContract(
            dataHash,
            measurement.signature,
            measurement.deviceAddress
        );

        // Invio la transazione alla rete, ma non blocco la risposta HTTP
        // aspettando mining/conferme blockchain.
        const transactionResponse = await iotDataStorage.recordSignedMeasurement(
            measurement.deviceAddress,
            measurement.value,
            measurement.deviceTimestamp,
            measurement.nonce,
            signatureForContract
        );

        rememberPendingNonce(measurement.deviceAddress, measurement.nonce);

        logTransactionConfirmationInBackground(
            transactionResponse,
            measurement,
            dataHash,
        );

        res.status(202).json({
            status: "submitted",
            transactionHash: transactionResponse.hash,
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

function logTransactionConfirmationInBackground(
    transactionResponse,
    measurement,
    dataHash,
) {
    if (CONFIRMATIONS === 0) {
        console.log(
            `Transazione inviata: ${transactionResponse.hash} ` +
            `(nonce misura ${measurement.nonce.toString()})`,
        );
        return;
    }

    transactionResponse
        .wait(CONFIRMATIONS)
        .then((receipt) => {
            forgetPendingNonceIfCurrent(
                measurement.deviceAddress,
                measurement.nonce,
            );

            console.log(
                `Transazione confermata: ${transactionResponse.hash} ` +
                `block=${receipt?.blockNumber ?? "n/d"} ` +
                `device=${measurement.deviceAddress} ` +
                `nonce=${measurement.nonce.toString()} ` +
                `dataHash=${dataHash}`,
            );
        })
        .catch((error) => {
            forgetPendingNonceIfCurrent(
                measurement.deviceAddress,
                measurement.nonce,
            );

            console.error(
                `Errore conferma transazione ${transactionResponse.hash}:`,
                error,
            );
        });
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

    const signatureLength = ethers.dataLength(signature);

    if (signatureLength !== 64 && signatureLength !== 65) {
        throw new HttpError(400, "signature deve essere lunga 64 o 65 byte");
    }

    const parsedValue = BigInt(value);
    const parsedDeviceTimestamp = BigInt(deviceTimestamp);
    const parsedNonce = BigInt(nonce);

    // controlli sui range compatibili con Solidity
    if (parsedValue < INT256_MIN || parsedValue > INT256_MAX) {
        throw new HttpError(400, "value deve rientrare nel range int256");
    }

    if (parsedDeviceTimestamp < 0n || parsedDeviceTimestamp > UINT256_MAX) {
        throw new HttpError(400, "deviceTimestamp deve rientrare nel range uint256");
    }

    if (parsedNonce <= 0n || parsedNonce > UINT256_MAX) {
        throw new HttpError(400, "nonce deve essere un uint256 maggiore di zero");
    }

    return {
        deviceAddress: ethers.getAddress(deviceAddress),
        value: parsedValue,
        deviceTimestamp: parsedDeviceTimestamp,
        nonce: parsedNonce,
        signature,
    };
}

async function getMeasurementHashLocal(measurement) {
    const network = await provider.getNetwork();
    const chainId = network.chainId;

    return ethers.solidityPackedKeccak256(
        ["address", "uint256", "address", "int256", "uint256", "uint256"],
        [
            contractAddress,
            chainId,
            measurement.deviceAddress,
            measurement.value,
            measurement.deviceTimestamp,
            measurement.nonce,
        ]
    );
}

function isIntegerLike(value) {
    if (typeof value === "bigint") {
        return true;
    }

    if (typeof value === "number") {
        return Number.isSafeInteger(value); // così non accetta valori int troppo grandi
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
    const lastNonce = await getEffectiveLastNonce(deviceAddress);

    if (nonce <= lastNonce) {
        throw new HttpError(409, "Nonce già usato o non valido");
    }
}

async function getEffectiveLastNonce(deviceAddress) {
    const lastNonceOnChain = await iotDataStorage.getLastNonce(deviceAddress);
    const pendingLastNonce = pendingLastNonceByDevice.get(deviceAddress) ?? 0n;

    return lastNonceOnChain > pendingLastNonce ? lastNonceOnChain : pendingLastNonce;
}

function rememberPendingNonce(deviceAddress, nonce) {
    const currentPendingNonce = pendingLastNonceByDevice.get(deviceAddress) ?? 0n;

    if (nonce > currentPendingNonce) {
        pendingLastNonceByDevice.set(deviceAddress, nonce);
    }
}

function forgetPendingNonceIfCurrent(deviceAddress, nonce) {
    const currentPendingNonce = pendingLastNonceByDevice.get(deviceAddress);

    if (currentPendingNonce === nonce) {
        pendingLastNonceByDevice.delete(deviceAddress);
    }
}

function normalizeSignatureForContract(dataHash, signature, deviceAddress) {
    const signatureLength = ethers.dataLength(signature);

    if (signatureLength === 65) {
        const normalizedSignature = normalize65ByteSignature(signature);

        assertSignatureMatchesDevice(
            dataHash,
            normalizedSignature,
            deviceAddress,
        );

        return normalizedSignature;
    }

    if (signatureLength === 64) {
        return buildRecoverableSignatureFromRawRs(
            dataHash,
            signature,
            deviceAddress,
        );
    }

    throw new HttpError(400, "signature deve essere lunga 64 o 65 byte");
}

function normalize65ByteSignature(signature) {
    const signatureBytes = ethers.getBytes(signature);

    let v = signatureBytes[64];

    if (v === 0 || v === 1) {
        v += 27;
    }

    if (v !== 27 && v !== 28) {
        throw new HttpError(400, "Valore v della firma non valido");
    }

    const s = bytesToBigInt(signatureBytes.slice(32, 64));

    if (s > SECP256K1_HALF_N) {
        throw new HttpError(400, "Firma non valida: valore s non canonico");
    }

    signatureBytes[64] = v;

    return ethers.hexlify(signatureBytes);
}

function buildRecoverableSignatureFromRawRs(dataHash, rawSignature, deviceAddress) {
    const signatureBytes = ethers.getBytes(rawSignature);

    const rBytes = signatureBytes.slice(0, 32);
    const sBytes = signatureBytes.slice(32, 64);

    const r = ethers.hexlify(rBytes);
    const rawS = bytesToBigInt(sBytes);

    if (rawS <= 0n || rawS >= SECP256K1_N) {
        throw new HttpError(400, "Valore s della firma non valido");
    }

    const candidateSValues = buildCandidateSValues(rawS);

    for (const candidateS of candidateSValues) {
        if (candidateS > SECP256K1_HALF_N) {
            continue;
        }

        const s = uint256ToHex(candidateS);

        for (const v of [27, 28]) {
            const candidateSignature = joinSignatureParts(r, s, v);

            try {
                const recoveredAddress = ethers.verifyMessage(
                    ethers.getBytes(dataHash),
                    candidateSignature,
                );

                if (
                    ethers.getAddress(recoveredAddress) ===
                    ethers.getAddress(deviceAddress)
                ) {
                    return candidateSignature;
                }
            } catch {
                // Provo la prossima combinazione r, s, v.
            }
        }
    }

    throw new HttpError(400, "Firma non coerente con il deviceAddress");
}

function buildCandidateSValues(rawS) {
    const normalizedS = rawS > SECP256K1_HALF_N ? SECP256K1_N - rawS : rawS;

    if (normalizedS === rawS) {
        return [rawS];
    }

    return [normalizedS, rawS];
}

function joinSignatureParts(r, s, v) {
    const vHex = v.toString(16).padStart(2, "0");

    return `0x${r.slice(2)}${s.slice(2)}${vHex}`;
}

function assertSignatureMatchesDevice(dataHash, signature, deviceAddress) {
    const recoveredAddress = recoverAddress(dataHash, signature);

    if (ethers.getAddress(recoveredAddress) !== ethers.getAddress(deviceAddress)) {
        throw new HttpError(400, "Firma non coerente con il deviceAddress");
    }
}

function recoverAddress(dataHash, signature) {
    try {
        return ethers.verifyMessage(ethers.getBytes(dataHash), signature);
    } catch {
        throw new HttpError(400, "Firma non valida");
    }
}

function bytesToBigInt(bytes) {
    return BigInt(ethers.hexlify(bytes));
}

function uint256ToHex(value) {
    return `0x${value.toString(16).padStart(64, "0")}`;
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













