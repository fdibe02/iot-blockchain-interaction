SHELL := /bin/bash

ANVIL_ENV := middleware/.env.anvil
SEPOLIA_ENV := middleware/.env.sepolia

VALUE ?=

.PHONY: deploy-anvil start-middleware-anvil simulate-device-anvil verify-hash-anvil test-negative-anvil show-address

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

show-address:
	@cat frontend/js/contract-address.js
	