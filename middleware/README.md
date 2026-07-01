# Middleware Node.js

Middleware Node.js che riceve misurazioni firmate da un dispositivo IoT, le valida preventivamente e le registra su smart contract tramite un wallet relayer.

Questo componente espone un'API HTTP verso il dispositivo e interagisce con lo smart contract tramite `ethers.js`.

## Ruolo del middleware

Il middleware riceve una misurazione in formato JSON e svolge controlli preliminari prima di inviare una transazione alla blockchain.

In particolare:

1. verifica una API key HTTP;
2. valida il formato del payload ricevuto;
3. controlla che il dispositivo sia registrato nello smart contract;
4. controlla che il nonce non sia già stato usato;
5. verifica off-chain che la firma sia coerente con l'address del dispositivo;
6. invia la transazione allo smart contract tramite un wallet relayer.

La validazione effettuata dal middleware è preventiva: serve a evitare transazioni inutili e quindi gas sprecato. La validazione definitiva resta invece nello smart contract, che verifica on-chain firma, registrazione del dispositivo e nonce.

## Controlli off-chain e on-chain

Il middleware effettua controlli off-chain per intercettare richieste evidentemente non valide prima di spendere gas.

Esempi:

* API key errata;
* payload malformato;
* dispositivo non registrato;
* nonce già usato;
* firma non coerente con il payload.

Questi controlli non sostituiscono quelli dello smart contract. Il contratto resta il punto di verità del sistema: anche se il middleware venisse modificato o bypassato, una misura non valida dovrebbe comunque essere rifiutata on-chain.

Quindi il middleware ha principalmente un ruolo di:

* gateway HTTP;
* filtro preventivo;
* relayer delle transazioni;
* componente di integrazione tra dispositivo e blockchain.

## File principali

```text
middleware/
├── server.js
├── package.json
├── package-lock.json
├── .env.anvil.example
├── .env.sepolia.example
├── README.md
└── scripts/
    ├── register-device.js
    ├── simulate-device.js
    ├── test-negative-measurements.js
    └── verify-hash-consistency.js
```

## Installazione

Dalla cartella `middleware`:

```bash
npm install
```

## Configurazione

Gli script npm usano file di configurazione separati per ambiente.

```bash
cp .env.anvil.example .env.anvil
cp .env.sepolia.example .env.sepolia
```

Esempio di configurazione locale con Anvil:

```env
PORT=3000
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0xINSERISCI_ADDRESS_CONTRATTO
OWNER_PRIVATE_KEY=0xINSERISCI_PRIVATE_KEY_OWNER
RELAYER_PRIVATE_KEY=0xINSERISCI_PRIVATE_KEY_RELAYER
DEVICE_API_KEY=dev-secret-esp32-1
CONFIRMATIONS=1

MIDDLEWARE_URL=http://localhost:3000/api/measurements
DEVICE_PRIVATE_KEY=0xINSERISCI_PRIVATE_KEY_DEVICE
MEASUREMENT_VALUE=25
```

## Variabili d'ambiente

| Variabile             | Descrizione                                                                 |
| --------------------- | --------------------------------------------------------------------------- |
| `PORT`                | Porta HTTP su cui avviare il middleware. Default: `3000`.                   |
| `RPC_URL`             | URL del nodo blockchain, ad esempio Anvil o un provider RPC testnet.        |
| `CONTRACT_ADDRESS`    | Address dello smart contract deployato.                                     |
| `OWNER_PRIVATE_KEY`   | Private key dell'owner, usata per registrare dispositivi.                   |
| `RELAYER_PRIVATE_KEY` | Private key del wallet usato dal middleware per inviare transazioni.        |
| `DEVICE_API_KEY`      | API key HTTP richiesta dal middleware per accettare misure dal dispositivo. |
| `CONFIRMATIONS`       | Numero di conferme da attendere dopo l'invio della transazione.             |
| `MIDDLEWARE_URL`      | URL dell'endpoint HTTP del middleware, usato dagli script di simulazione.   |
| `DEVICE_PRIVATE_KEY`  | Private key del dispositivo simulato negli script Node.js.                  |
| `MEASUREMENT_VALUE`   | Valore di default della misura simulata.                                    |

I file `.env`, `.env.anvil` e `.env.sepolia` non devono essere committati, perché contengono chiavi private e valori sensibili. Devono invece essere committati solo i file `.env*.example`, che contengono placeholder.

## Avvio del server

Per Anvil:

```bash
npm run dev:anvil
```

oppure:

```bash
npm run start:anvil
```

Per Sepolia:

```bash
npm run dev:sepolia
```

oppure:

```bash
npm run start:sepolia
```

I comandi `dev:*` usano `node --watch` e riavviano automaticamente il server quando viene modificato `server.js`.

## Endpoint disponibili

### Health check

```http
GET /health
```

Serve a verificare che il middleware sia avviato e riesca a comunicare con il nodo blockchain.

Esempio:

```bash
curl http://localhost:3000/health
```

Risposta attesa:

```json
{
  "status": "ok",
  "blockNumber": 3,
  "contractAddress": "0x...",
  "relayerAddress": "0x..."
}
```

### Registrazione misurazione

```http
POST /api/measurements
```

Richiede header:

```http
Content-Type: application/json
X-API-Key: dev-secret-esp32-1
```

Payload atteso:

```json
{
  "deviceAddress": "0x...",
  "value": "25",
  "deviceTimestamp": "1782227412",
  "nonce": "1",
  "signature": "0x..."
}
```

Risposta in caso di successo:

```json
{
  "status": "submitted",
  "transactionHash": "0x...",
  "deviceAddress": "0x...",
  "value": "25",
  "deviceTimestamp": "1782227412",
  "nonce": "1",
  "dataHash": "0x..."
}
```

Il middleware risponde con HTTP `202 Accepted`: significa che la transazione è stata inviata alla rete, ma il server non aspetta il mining prima di rispondere al dispositivo. La conferma viene poi registrata nei log del middleware.

### Sincronizzazione nonce

```http
GET /api/devices/:deviceAddress/nonce
```

Richiede header:

```http
X-API-Key: dev-secret-esp32-1
```

Il firmware ESP32 usa questo endpoint per conoscere il prossimo nonce da firmare prima di inviare una misura.

Risposta attesa:

```json
{
  "status": "ok",
  "deviceAddress": "0x...",
  "lastNonce": "0",
  "nextNonce": "1",
  "onChainLastNonce": "0",
  "pendingLastNonce": "0"
}
```

## Script di simulazione

### Registrazione di un dispositivo

Lo script `scripts/register-device.js` registra un dispositivo nello smart contract usando `OWNER_PRIVATE_KEY`.

Se il dispositivo è già registrato, lo script stampa i dati esistenti e non invia una nuova transazione.

Esecuzione su Anvil:

```bash
npm run register-device:anvil
```

Senza argomenti, lo script prova a derivare il device address da `DEVICE_PRIVATE_KEY`. È anche possibile passare address e metadata esplicitamente:

```bash
npm run register-device:anvil -- 0xDEVICE_ADDRESS esp32-laboratorio
```

Esecuzione su Sepolia:

```bash
npm run register-device:sepolia -- 0xDEVICE_ADDRESS esp32-laboratorio
```

Su Sepolia questo comando invia una transazione reale e consuma gas.

### Simulazione di un dispositivo

Lo script `scripts/simulate-device.js` simula il comportamento logico di un dispositivo che invia una misura firmata al middleware.

Lo script:

1. deriva il `deviceAddress` dalla `DEVICE_PRIVATE_KEY`;
2. costruisce una misura simulata;
3. legge il nonce corrente dallo smart contract;
4. calcola localmente l'hash della misura con la stessa logica dello smart contract;
5. firma l'hash con la private key del dispositivo simulato;
6. invia il payload firmato al middleware.

Esecuzione su Anvil:

```bash
npm run simulate-device:anvil
```

È possibile passare un valore personalizzato:

```bash
npm run simulate-device:anvil -- 28
```

Esecuzione su Sepolia:

```bash
npm run simulate-device:sepolia
```

### Scenari negativi

Lo script `scripts/test-negative-measurements.js` esegue verifiche manuali di integrazione sul middleware.

Gli scenari coperti sono:

1. richiesta con API key errata;
2. valore alterato dopo la firma;
3. timestamp alterato dopo la firma;
4. nonce alterato dopo la firma;
5. misura valida;
6. replay della stessa misura.

Esecuzione su Anvil:

```bash
npm run test-negative-measurements:anvil
```

Esecuzione su Sepolia:

```bash
npm run test-negative-measurements:sepolia
```

Esempio di risultati attesi:

```text
Test 1 - API key sbagliata
Status: 401

Test 2 - Valore alterato dopo la firma
Status: 400

Test 3 - Timestamp alterato dopo la firma
Status: 400

Test 4 - Nonce alterato dopo la firma
Status: 400

Test 5 - Misura valida
Status: 202

Test 6 - Replay della stessa misura
Status: 409
```

Questi script non sostituiscono i test Foundry dello smart contract. I test Foundry verificano la sicurezza on-chain del contratto in isolamento, mentre gli script Node.js verificano il comportamento del middleware nel flusso applicativo.

### Verifica coerenza hash

Lo script `scripts/verify-hash-consistency.js` confronta l'hash calcolato localmente dal middleware con quello restituito dallo smart contract.

Esecuzione su Anvil:

```bash
npm run verify-hash:anvil
```

Esecuzione su Sepolia:

```bash
npm run verify-hash:sepolia
```

## Note di sicurezza

Il middleware non deve possedere la private key del dispositivo reale. La private key del dispositivo deve restare nel nodo IoT, mentre il middleware deve possedere solo la private key del relayer.

La distinzione è:

```text
DEVICE_PRIVATE_KEY  -> firma il contenuto della misura
RELAYER_PRIVATE_KEY -> paga il gas e invia la transazione
```

In questo modo il middleware non è il produttore fiduciario della misura: può solo inoltrare dati firmati dal dispositivo. Se modifica `value`, `deviceTimestamp` o `nonce`, la firma non risulta più valida.

## Stato attuale

Il middleware è configurabile tramite profili separati per Anvil e Sepolia. Una misura firmata da un dispositivo simulato può essere inviata al middleware, registrata sullo smart contract e letta dal frontend Web3.

Il firmware ESP32 attuale costruisce il payload firmato e può inviarlo al middleware. Lo script `simulate-device.js` resta comunque utile per testare il flusso completo senza dipendere dalla board fisica, dal WiFi o dal sensore.
