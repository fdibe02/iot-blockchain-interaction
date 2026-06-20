SHELL := /bin/bash

RPC_URL ?= http://127.0.0.1:8545

# Account 0 standard di Anvil: deployer / owner
ANVIL_PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Account 1 standard di Anvil: device simulato
DEVICE_PRIVATE_KEY ?= 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

# Valore di default della misurazione
VALUE ?= 25

.PHONY: deploy record-measurement show-address

deploy:
	ANVIL_PRIVATE_KEY=$(ANVIL_PRIVATE_KEY) RPC_URL=$(RPC_URL) ./scripts/deploy-anvil.sh

show-address:
	@cat frontend/js/contract-address.js

record-measurement:
	@CONTRACT_ADDRESS=$$(node -e 'const fs = require("node:fs"); const file = "frontend/js/contract-address.js"; const content = fs.readFileSync(file, "utf8"); const match = content.match(/contractAddress\s*=\s*"(0x[a-fA-F0-9]{40})"/); if (!match) { console.error("Contract address non trovato in " + file); process.exit(1); } console.log(match[1]);'); \
	DEVICE_ADDRESS=$$(cast wallet address "$(DEVICE_PRIVATE_KEY)"); \
	DEVICE_TIMESTAMP=$$(date +%s); \
	LAST_NONCE=$$(cast call "$$CONTRACT_ADDRESS" "getLastNonce(address)(uint256)" "$$DEVICE_ADDRESS" --rpc-url "$(RPC_URL)"); \
	NONCE=$$((LAST_NONCE + 1)); \
	echo "Contratto: $$CONTRACT_ADDRESS"; \
	echo "Device: $$DEVICE_ADDRESS"; \
	echo "Valore: $(VALUE)"; \
	echo "Timestamp device: $$DEVICE_TIMESTAMP"; \
	echo "Last nonce: $$LAST_NONCE"; \
	echo "Nonce: $$NONCE"; \
	HASH=$$(cast call "$$CONTRACT_ADDRESS" "getMeasurementHash(address,int256,uint256,uint256)(bytes32)" "$$DEVICE_ADDRESS" "$(VALUE)" "$$DEVICE_TIMESTAMP" "$$NONCE" --rpc-url "$(RPC_URL)"); \
	echo "Hash dati: $$HASH"; \
	SIGNATURE=$$(cast wallet sign --private-key "$(DEVICE_PRIVATE_KEY)" "$$HASH"); \
	echo "Firma: $$SIGNATURE"; \
	cast send "$$CONTRACT_ADDRESS" "recordSignedMeasurement(address,int256,uint256,uint256,bytes)" "$$DEVICE_ADDRESS" "$(VALUE)" "$$DEVICE_TIMESTAMP" "$$NONCE" "$$SIGNATURE" --rpc-url "$(RPC_URL)" --private-key "$(ANVIL_PRIVATE_KEY)"
	