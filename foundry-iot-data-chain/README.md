# Foundry IoT Data Chain

Modulo Foundry del progetto di tesi.

Questa cartella contiene la parte smart contract del progetto: contratti Solidity, test e script di deploy.

Il contratto principale `IoTDataStorage` supporta sia la registrazione di una singola misura firmata, tramite `recordSignedMeasurement(...)`, sia la registrazione batch di più misure firmate nella stessa transazione, tramite `recordSignedMeasurements(...)`.

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

Gli script eseguono il deploy del contratto e aggiornano il file con l'indirizzo usato dal frontend. Per Anvil viene aggiornato anche `middleware/.env.anvil`. Se `firmware/esp32-iot-data-chain/secrets.h` esiste, vengono aggiornati anche `CONTRACT_ADDRESS`, `CHAIN_ID` e `NONCE_URL` del firmware.

Comando Foundry equivalente:

```bash
forge script script/DeployIoTDataStorage.s.sol:DeployIoTDataStorage \
  --rpc-url <RPC_URL> \
  --private-key <PRIVATE_KEY> \
  --broadcast
```

## Note

Questo modulo riguarda solo la parte smart contract.

La descrizione generale della tesi, dell’architettura complessiva, dell’integrazione con ESP32 + LM35DZ, middleware e client web3, e dell'esperimento batch vs single su Sepolia si trova nel README principale della repository.
