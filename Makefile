SHELL := /bin/bash

ANVIL_ENV := middleware/.env.anvil
SEPOLIA_ENV := middleware/.env.sepolia
FOUNDRY_DIR := foundry-iot-data-chain
FIRMWARE_DIR := firmware/esp32-iot-data-chain
FQBN ?= esp32:esp32:esp32
PORT ?= /dev/cu.usbserial-0001
FRONTEND_PORT ?= 8000

VALUE ?=
BATCH ?= 3
BATCH_FLUSH_MS ?= 0
DEVICE_ADDRESS ?=
METADATA_URI ?= esp32-laboratorio

.PHONY: install check check-js check-scripts build-contract test-contract fmt-contract fmt-contract-check deploy-anvil start-middleware-anvil health-anvil register-device-anvil simulate-device-anvil verify-hash-anvil test-negative-anvil show-address deploy-sepolia start-middleware-sepolia health-sepolia register-device-sepolia simulate-device-sepolia verify-hash-sepolia test-negative-sepolia firmware-compile firmware-upload firmware-monitor firmware-flash-monitor simulate-buffered-anvil start-middleware-sepolia-batch simulate-buffered-sepolia 

install:
	@npm --prefix middleware install

check: check-js check-scripts fmt-contract-check test-contract

check-js:
	@node --check middleware/server.js
	@node --check middleware/scripts/check-packed-hash.js
	@node --check middleware/scripts/register-device.js
	@node --check middleware/scripts/simulate-device.js
	@node --check middleware/scripts/test-negative-measurements.js
	@node --check middleware/scripts/verify-hash-consistency.js
	@node --check scripts/update-firmware-config.js
	@node --check middleware/scripts/simulate-buffered-measurements.js

check-scripts:
	@bash -n scripts/deploy-anvil.sh
	@bash -n scripts/deploy-sepolia.sh

build-contract:
	@cd $(FOUNDRY_DIR) && forge build

test-contract:
	@cd $(FOUNDRY_DIR) && forge test

fmt-contract:
	@cd $(FOUNDRY_DIR) && forge fmt

fmt-contract-check:
	@cd $(FOUNDRY_DIR) && forge fmt --check

deploy-anvil:
	@set -a; source $(ANVIL_ENV); set +a; ./scripts/deploy-anvil.sh

start-middleware-anvil:
	@npm --prefix middleware run dev:anvil

health-anvil:
	@curl -sS http://localhost:3000/health

register-device-anvil:
	@DEVICE_ADDRESS="$(DEVICE_ADDRESS)" METADATA_URI="$(METADATA_URI)" npm --prefix middleware run register-device:anvil

simulate-device-anvil:
	@npm --prefix middleware run simulate-device:anvil -- $(VALUE)

verify-hash-anvil:
	@npm --prefix middleware run verify-hash:anvil

test-negative-anvil:
	@npm --prefix middleware run test-negative-measurements:anvil

deploy-sepolia:
	@set -a; source $(SEPOLIA_ENV); set +a; ./scripts/deploy-sepolia.sh

start-middleware-sepolia:
	@npm --prefix middleware run dev:sepolia

start-middleware-sepolia-batch:
	@TX_MODE=batch BATCH_SIZE=$(BATCH) BATCH_FLUSH_MS=$(BATCH_FLUSH_MS) npm --prefix middleware run dev:sepolia

health-sepolia:
	@curl -sS http://localhost:3000/health

register-device-sepolia:
	@DEVICE_ADDRESS="$(DEVICE_ADDRESS)" METADATA_URI="$(METADATA_URI)" npm --prefix middleware run register-device:sepolia

simulate-device-sepolia:
	@npm --prefix middleware run simulate-device:sepolia -- $(VALUE)

simulate-buffered-anvil:
	@MEASUREMENT_VALUE="$(VALUE)" npm --prefix middleware run simulate-buffered:anvil -- $(BATCH)

simulate-buffered-sepolia:
	@MEASUREMENT_VALUE="$(VALUE)" npm --prefix middleware run simulate-buffered:sepolia -- $(BATCH)

verify-hash-sepolia:
	@npm --prefix middleware run verify-hash:sepolia

test-negative-sepolia:
	@npm --prefix middleware run test-negative-measurements:sepolia

show-address:
	@cat frontend/js/contract-address.js

firmware-compile:
	@arduino-cli compile --fqbn $(FQBN) $(FIRMWARE_DIR)

firmware-upload:
	@arduino-cli upload -p $(PORT) --fqbn $(FQBN) $(FIRMWARE_DIR)

firmware-monitor:
	@arduino-cli monitor -p $(PORT) -c baudrate=115200

firmware-flash-monitor: firmware-upload firmware-monitor

start-frontend:
	@python3 -m http.server $(FRONTEND_PORT) -d frontend
