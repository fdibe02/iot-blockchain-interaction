#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const [contractAddress, chainId, secretsFileArg] = process.argv.slice(2);

const defaultSecretsFile = path.join(
    "firmware",
    "esp32-iot-data-chain",
    "secrets.h",
);

const secretsFile = secretsFileArg ?? defaultSecretsFile;

if (!contractAddress || !chainId) {
    console.error(
        "Uso: node scripts/update-firmware-config.js <CONTRACT_ADDRESS> <CHAIN_ID> [secrets.h]",
    );
    process.exit(1);
}

if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
    console.error("CONTRACT_ADDRESS non è un address Ethereum valido.");
    process.exit(1);
}

if (!/^\d+$/.test(chainId)) {
    console.error("CHAIN_ID deve essere un intero positivo.");
    process.exit(1);
}

if (!fs.existsSync(secretsFile)) {
    console.log(
        `Firmware secrets non trovato: ${secretsFile}. Salto aggiornamento firmware.`,
    );
    process.exit(0);
}

let content = fs.readFileSync(secretsFile, "utf8");

content = replaceRequired(
    content,
    /(const\s+char\*\s+CONTRACT_ADDRESS\s*=\s*")[^"]*(";)/,
    `$1${contractAddress}$2`,
    "CONTRACT_ADDRESS",
);

content = replaceRequired(
    content,
    /(const\s+uint64_t\s+CHAIN_ID\s*=\s*)\d+(\s*;)/,
    `$1${chainId}$2`,
    "CHAIN_ID",
);

const serverUrl = extractStringConst(content, "SERVER_URL");
const deviceAddress = extractStringConst(content, "DEVICE_ADDRESS");

if (serverUrl && deviceAddress && hasStringConst(content, "NONCE_URL")) {
    const nonceUrl = buildNonceUrl(serverUrl, deviceAddress);

    content = replaceRequired(
        content,
        /(const\s+char\*\s+NONCE_URL\s*=\s*")[^"]*(";)/,
        `$1${nonceUrl}$2`,
        "NONCE_URL",
    );
} else {
    console.log(
        "SERVER_URL, DEVICE_ADDRESS o NONCE_URL non trovato. NONCE_URL non aggiornato.",
    );
}

fs.writeFileSync(secretsFile, content);

console.log(`Firmware secrets aggiornato: ${secretsFile}`);
console.log(`CONTRACT_ADDRESS=${contractAddress}`);
console.log(`CHAIN_ID=${chainId}`);

function replaceRequired(content, pattern, replacement, label) {
    if (!pattern.test(content)) {
        console.error(`${label} non trovato in ${secretsFile}`);
        process.exit(1);
    }

    return content.replace(pattern, replacement);
}

function hasStringConst(content, name) {
    return new RegExp(`const\\s+char\\*\\s+${name}\\s*=\\s*"[^"]*";`).test(
        content,
    );
}

function extractStringConst(content, name) {
    const match = content.match(
        new RegExp(`const\\s+char\\*\\s+${name}\\s*=\\s*"([^"]*)";`),
    );

    return match?.[1] ?? "";
}

function buildNonceUrl(serverUrl, deviceAddress) {
    const normalizedServerUrl = serverUrl.replace(/\/+$/, "");
    const baseUrl = normalizedServerUrl.replace(/\/api\/measurements$/, "");

    return `${baseUrl}/api/devices/${deviceAddress}/nonce`;
}
