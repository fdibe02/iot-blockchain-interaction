#!/bin/bash

set -e

# ==========================
# CONFIGURAZIONE
# ==========================

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
CHAIN_ID="31337"

FOUNDRY_DIR="foundry-iot-data-chain"

STORAGE_MODE="${STORAGE_MODE:-legacy}"

case "$STORAGE_MODE" in
  legacy)
  SCRIPT_FILE="DeployIoTDataStorage.s.sol"
  SCRIPT_CONTRACT="DeployIoTDataStorage"
  CONTRACT_NAME="IoTDataStorage"
  ENV_STORAGE_MODE="legacy"
  ;;
full)
  SCRIPT_FILE="DeployIoTDataStorageFull.s.sol"
  SCRIPT_CONTRACT="DeployIoTDataStorageFull"
  CONTRACT_NAME="IoTDataStorageFull"
  ENV_STORAGE_MODE="full-storage"
  ;;
latest)
  SCRIPT_FILE="DeployIoTDataStorageLatest.s.sol"
  SCRIPT_CONTRACT="DeployIoTDataStorageLatest"
  CONTRACT_NAME="IoTDataStorageLatest"
  ENV_STORAGE_MODE="latest-storage"
  ;;
hash-uri)
  SCRIPT_FILE="DeployIoTDataStorageHashURI.s.sol"
  SCRIPT_CONTRACT="DeployIoTDataStorageHashURI"
  CONTRACT_NAME="IoTDataStorageHashURI"
  ENV_STORAGE_MODE="hash-uri-storage"
  ;;
  *)
    echo "Errore: STORAGE_MODE non valido: $STORAGE_MODE"
    echo "Valori ammessi: legacy, full, latest, hash-uri"
    exit 1
    ;;
esac

FRONTEND_ADDRESS_FILE="frontend/js/contract-address.js"
ANVIL_ENV_FILE="middleware/.env.anvil"
FIRMWARE_UPDATE_SCRIPT="scripts/update-firmware-config.js"

# ==========================
# CONTROLLI
# ==========================

if [ -z "$OWNER_PRIVATE_KEY" ]; then
  echo "Errore: OWNER_PRIVATE_KEY non è impostata."
  echo ""
  echo "Esempio:"
  echo "export OWNER_PRIVATE_KEY=0x..."
  exit 1
fi

if [ ! -d "$FOUNDRY_DIR" ]; then
  echo "Errore: cartella $FOUNDRY_DIR non trovata."
  echo "Esegui questo script dalla root della repo."
  exit 1
fi

# ==========================
# DEPLOY
# ==========================

echo "Deploy del contratto su Anvil..."
echo "Env storage mode: $ENV_STORAGE_MODE"
echo "Storage mode: $STORAGE_MODE"
echo "Contract name: $CONTRACT_NAME"

cd "$FOUNDRY_DIR"

forge script "script/$SCRIPT_FILE:$SCRIPT_CONTRACT" \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$OWNER_PRIVATE_KEY"

cd ..

# ==========================
# LETTURA ADDRESS DAL BROADCAST
# ==========================

BROADCAST_FILE="$FOUNDRY_DIR/broadcast/$SCRIPT_FILE/$CHAIN_ID/run-latest.json"

if [ ! -f "$BROADCAST_FILE" ]; then
  echo "Errore: file broadcast non trovato:"
  echo "$BROADCAST_FILE"
  exit 1
fi

echo ""
echo "Lettura indirizzo contratto da:"
echo "$BROADCAST_FILE"

CONTRACT_ADDRESS=$(node -e "
const fs = require('node:fs');

const broadcastFile = process.argv[1];
const contractName = process.argv[2];

const content = fs.readFileSync(broadcastFile, 'utf8');
const broadcast = JSON.parse(content);

const transaction = broadcast.transactions.find(function (transaction) {
  return transaction.contractName === contractName && transaction.contractAddress;
});

if (!transaction) {
  console.error('Contratto non trovato nel broadcast:', contractName);
  process.exit(1);
}

console.log(transaction.contractAddress);
" "$BROADCAST_FILE" "$CONTRACT_NAME")

# ==========================
# SCRITTURA FILE FRONTEND
# ==========================

mkdir -p "$(dirname "$FRONTEND_ADDRESS_FILE")"

cat > "$FRONTEND_ADDRESS_FILE" <<EOF
// File generato automaticamente da scripts/deploy-anvil.sh
// Non modificare a mano.

var contractAddress = "$CONTRACT_ADDRESS";
EOF

if [ ! -f "$ANVIL_ENV_FILE" ]; then
  echo "Errore: file env Anvil non trovato:"
  echo "$ANVIL_ENV_FILE"
  exit 1
fi

node -e "
const fs = require('node:fs');

const storageMode = process.argv[3];

const envFile = process.argv[1];
const contractAddress = process.argv[2];

const content = fs.readFileSync(envFile, 'utf8');

if (!/^CONTRACT_ADDRESS=/m.test(content)) {
  console.error('CONTRACT_ADDRESS non trovato in ' + envFile);
  process.exit(1);
}

let updatedContent = content.replace(
  /^CONTRACT_ADDRESS=.*/m,
  'CONTRACT_ADDRESS=' + contractAddress
);

if (/^STORAGE_MODE=/m.test(updatedContent)) {
  updatedContent = updatedContent.replace(
    /^STORAGE_MODE=.*/m,
    'STORAGE_MODE=' + storageMode
  );
} else {
  updatedContent = updatedContent.trimEnd() + '\nSTORAGE_MODE=' + storageMode + '\n';
}

fs.writeFileSync(envFile, updatedContent);
" "$ANVIL_ENV_FILE" "$CONTRACT_ADDRESS" "$ENV_STORAGE_MODE"

if [ -f "$FIRMWARE_UPDATE_SCRIPT" ]; then
  node "$FIRMWARE_UPDATE_SCRIPT" "$CONTRACT_ADDRESS" "$CHAIN_ID"
else
  echo "Script aggiornamento firmware non trovato: $FIRMWARE_UPDATE_SCRIPT"
fi

echo ""
echo "Deploy completato."
echo "Indirizzo contratto:"
echo "$CONTRACT_ADDRESS"
echo ""
echo "File aggiornato:"
echo "$FRONTEND_ADDRESS_FILE"
echo "Env Anvil aggiornato:"
echo "$ANVIL_ENV_FILE"
echo "Firmware secrets aggiornato se presente:"
echo "firmware/esp32-iot-data-chain/secrets.h"
