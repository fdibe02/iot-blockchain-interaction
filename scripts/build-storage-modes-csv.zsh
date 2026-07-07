#!/usr/bin/env zsh

set -euo pipefail

RAW_ROOT="${RAW_ROOT:-experiments/raw/storage-modes}"
CSV_FILE="${CSV_FILE:-experiments/performance-storage-modes.csv}"
EXPERIMENT="${EXPERIMENT:-storage-modes}"
BATCH_SIZE="${BATCH_SIZE:-1}"
SEND_INTERVAL_SECONDS="${SEND_INTERVAL_SECONDS:-}"

node - "$RAW_ROOT" "$CSV_FILE" "$EXPERIMENT" "$BATCH_SIZE" "$SEND_INTERVAL_SECONDS" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [rawRoot, csvFile, experiment, batchSize, sendIntervalSeconds] =
    process.argv.slice(2);

const header = [
    "experiment",
    "network",
    "storageMode",
    "batchSize",
    "sendIntervalSeconds",
    "measurementIndex",
    "txHash",
    "blockNumber",
    "status",
    "gasUsed",
    "effectiveGasPriceWei",
    "feeWei",
    "feeEth",
    "requestBodyBytes",
    "calldataBytes",
    "txSubmitLatencyMs",
    "confirmationLatencyMs",
    "middlewareTotalLatencyMs",
    "deviceToBlockLatencySeconds",
    "logsCount",
];

function main() {
    const rows = [];

    if (!fs.existsSync(rawRoot)) {
        throw new Error(`Raw root non trovata: ${rawRoot}`);
    }

    for (const network of sortedDirectories(rawRoot)) {
        const networkDir = path.join(rawRoot, network);

        for (const storageMode of sortedDirectories(networkDir)) {
            const modeDir = path.join(networkDir, storageMode);
            const receiptsDir = path.join(modeDir, "receipts");
            const txsDir = path.join(modeDir, "txs");

            if (!fs.existsSync(receiptsDir) || !fs.existsSync(txsDir)) {
                continue;
            }

            for (const receiptFileName of sortedJsonFiles(receiptsDir)) {
                const measurementIndex = path.basename(receiptFileName, ".json");
                const receiptPath = path.join(receiptsDir, receiptFileName);
                const txPath = path.join(txsDir, receiptFileName);

                if (!fs.existsSync(txPath)) {
                    console.warn(`TX mancante per receipt: ${receiptPath}`);
                    continue;
                }

                const receipt = readJson(receiptPath);
                const tx = readJson(txPath);

                rows.push(buildRow({
                    network,
                    storageMode,
                    measurementIndex,
                    receipt,
                    tx,
                }));
            }
        }
    }

    rows.sort(compareRows);

    fs.mkdirSync(path.dirname(csvFile), { recursive: true });

    const csv = [
        header.join(","),
        ...rows.map((row) => header.map((column) => csvEscape(row[column] ?? "")).join(",")),
    ].join("\n");

    fs.writeFileSync(csvFile, `${csv}\n`);

    console.log(`CSV aggiornato: ${csvFile}`);
    console.log(`Righe dati scritte: ${rows.length}`);
}

function buildRow({ network, storageMode, measurementIndex, receipt, tx }) {
    const gasUsed = hexToBigInt(receipt.gasUsed);
    const effectiveGasPriceWei = hexToBigInt(
        receipt.effectiveGasPrice ?? tx.gasPrice,
    );
    const feeWei = gasUsed * effectiveGasPriceWei;
    const input = tx.input ?? "";

    return {
        experiment,
        network,
        storageMode,
        batchSize,
        sendIntervalSeconds,
        measurementIndex,
        txHash: receipt.transactionHash ?? tx.hash ?? "",
        blockNumber: hexToDecimalString(receipt.blockNumber ?? tx.blockNumber),
        status: hexToDecimalString(receipt.status),
        gasUsed: gasUsed.toString(),
        effectiveGasPriceWei: effectiveGasPriceWei.toString(),
        feeWei: feeWei.toString(),
        feeEth: formatEther(feeWei),
        requestBodyBytes: "",
        calldataBytes: calldataBytes(input),
        txSubmitLatencyMs: "",
        confirmationLatencyMs: "",
        middlewareTotalLatencyMs: "",
        deviceToBlockLatencySeconds: "",
        logsCount: Array.isArray(receipt.logs) ? String(receipt.logs.length) : "",
    };
}

function sortedDirectories(directory) {
    return fs.readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));
}

function sortedJsonFiles(directory) {
    return fs.readdirSync(directory)
        .filter((fileName) => fileName.endsWith(".json"))
        .sort(compareFileNamesNumerically);
}

function compareFileNamesNumerically(a, b) {
    const aNumber = Number.parseInt(path.basename(a, ".json"), 10);
    const bNumber = Number.parseInt(path.basename(b, ".json"), 10);

    if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
        return aNumber - bNumber;
    }

    return a.localeCompare(b);
}

function compareRows(a, b) {
    return (
        a.network.localeCompare(b.network) ||
        storageModeOrder(a.storageMode) - storageModeOrder(b.storageMode) ||
        Number(a.measurementIndex) - Number(b.measurementIndex)
    );
}

function storageModeOrder(storageMode) {
    return {
        "full-storage": 1,
        "latest-storage": 2,
        "hash-uri-storage": 3,
    }[storageMode] ?? 99;
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function hexToBigInt(value) {
    if (value === undefined || value === null || value === "") {
        return 0n;
    }

    if (typeof value === "bigint") {
        return value;
    }

    if (typeof value === "number") {
        return BigInt(value);
    }

    const stringValue = String(value);

    if (stringValue.startsWith("0x")) {
        return BigInt(stringValue);
    }

    return BigInt(stringValue);
}

function hexToDecimalString(value) {
    if (value === undefined || value === null || value === "") {
        return "";
    }

    return hexToBigInt(value).toString();
}

function calldataBytes(input) {
    if (typeof input !== "string" || !input.startsWith("0x")) {
        return "";
    }

    return String((input.length - 2) / 2);
}

function formatEther(wei) {
    const sign = wei < 0n ? "-" : "";
    const absoluteWei = wei < 0n ? -wei : wei;
    const whole = absoluteWei / 1000000000000000000n;
    const fraction = absoluteWei % 1000000000000000000n;
    const fractionText = fraction.toString().padStart(18, "0").replace(/0+$/, "");

    return fractionText === ""
        ? `${sign}${whole.toString()}`
        : `${sign}${whole.toString()}.${fractionText}`;
}

function csvEscape(value) {
    const stringValue = String(value);

    if (/[",\n\r]/.test(stringValue)) {
        return `"${stringValue.replaceAll('"', '""')}"`;
    }

    return stringValue;
}

main();
NODE
