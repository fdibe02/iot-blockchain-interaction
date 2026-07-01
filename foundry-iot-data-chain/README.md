# Foundry IoT Data Chain

Modulo Foundry del progetto di tesi.

Questa cartella contiene la parte smart contract del progetto: contratti Solidity, test e script di deploy.

## Contenuto della cartella

```text
foundry-iot-data-chain/
├── foundry.toml
├── src/        # Smart contract Solidity
├── test/       # Test dei contratti
├── script/     # Script di deploy/interazione
└── lib/        # Dipendenze Foundry
```

## Comandi principali

### Compilazione

```bash
forge build
```

### Test

```bash
forge test
```

### Formattazione

```bash
forge fmt
```

### Avvio blockchain locale

```bash
anvil
```

## Deploy

Il deploy può essere eseguito dalla root della repository usando gli script già collegati al `Makefile`.

Su Anvil:

```bash
make deploy-anvil
```

Su Sepolia:

```bash
make deploy-sepolia
```

Gli script eseguono il deploy del contratto e aggiornano il file con l'indirizzo usato dal frontend. Per Anvil viene aggiornato anche `middleware/.env.anvil`.

Comando Foundry equivalente:

```bash
forge script script/DeployIoTDataStorage.s.sol:DeployIoTDataStorage \
  --rpc-url <RPC_URL> \
  --private-key <PRIVATE_KEY> \
  --broadcast
```

## Note

Questo modulo riguarda solo la parte smart contract.

La descrizione generale della tesi, dell’architettura complessiva e dell’integrazione con ESP32, middleware e client web3 si trova nel README principale della repository.
