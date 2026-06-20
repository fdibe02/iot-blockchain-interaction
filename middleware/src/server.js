import "dotenv/config"; // carica file.enc, con RPC_URL, CONTRACT_ADDRESS, RELAYER_PRIVATE_KEY, ecc. tramite process.env

import express from "express";
import { ethers } from "ethers";

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

