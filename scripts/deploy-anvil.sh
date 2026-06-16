#!/bin/bash

set -e

# ==========================
# CONFIGURAZIONE
# ==========================

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
CHAIN_ID="31337"

FOUNDRY_DIR="foundry-iot-data-chain"

SCRIPT_FILE="DeployIoTDataStorage.s.sol"
SCRIPT_CONTRACT="DeployIoTDataStorage"
CONTRACT_NAME="IoTDataStorage"

FRONTEND_ADDRESS_FILE="frontend/js/contract-address.js"

# ==========================
# CONTROLLI
# ==========================

if [ -z "$ANVIL_PRIVATE_KEY" ]; then
  echo "Errore: ANVIL_PRIVATE_KEY non è impostata."
  echo ""
  echo "Esempio:"
  echo "export ANVIL_PRIVATE_KEY=0x..."
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

cd "$FOUNDRY_DIR"

forge script "script/$SCRIPT_FILE:$SCRIPT_CONTRACT" \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$ANVIL_PRIVATE_KEY"

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

echo ""
echo "Deploy completato."
echo "Indirizzo contratto:"
echo "$CONTRACT_ADDRESS"
echo ""
echo "File aggiornato:"
echo "$FRONTEND_ADDRESS_FILE"