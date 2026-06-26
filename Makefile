SHELL := /bin/bash

ANVIL_ENV := middleware/.env.anvil
SEPOLIA_ENV := middleware/.env.sepolia

VALUE ?=

.PHONY: deploy-anvil start-middleware-anvil simulate-device-anvil verify-hash-anvil test-negative-anvil show-address deploy-sepolia start-middleware-sepolia simulate-device-sepolia verify-hash-sepolia test-negative-sepolia

deploy-anvil:
	@set -a; source $(ANVIL_ENV); set +a; ./scripts/deploy-anvil.sh

start-middleware-anvil:
	@npm --prefix middleware run dev:anvil

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

simulate-device-sepolia:
	@npm --prefix middleware run simulate-device:sepolia -- $(VALUE)

verify-hash-sepolia:
	@npm --prefix middleware run verify-hash:sepolia

test-negative-sepolia:
	@npm --prefix middleware run test-negative-measurements:sepolia

show-address:
	@cat frontend/js/contract-address.js



	