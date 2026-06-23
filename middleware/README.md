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
├── .env.example
├── README.md
└── scripts/
    ├── simulate-device.js
    └── test-negative-measurements.js
```

## Installazione

Dalla cartella `middleware`:

```bash
npm install
```

## Configurazione

Creare il file `.env` partendo dal modello:

```bash
cp .env.example .env
```

Esempio di configurazione locale con Anvil:

```env
PORT=3000
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0xINSERISCI_ADDRESS_CONTRATTO
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
| `RELAYER_PRIVATE_KEY` | Private key del wallet usato dal middleware per inviare transazioni.        |
| `DEVICE_API_KEY`      | API key HTTP richiesta dal middleware per accettare misure dal dispositivo. |
| `CONFIRMATIONS`       | Numero di conferme da attendere dopo l'invio della transazione.             |
| `MIDDLEWARE_URL`      | URL dell'endpoint HTTP del middleware, usato dagli script di simulazione.   |
| `DEVICE_PRIVATE_KEY`  | Private key del dispositivo simulato negli script Node.js.                  |
| `MEASUREMENT_VALUE`   | Valore di default della misura simulata.                                    |

Il file `.env` non deve essere committato, perché contiene chiavi private e valori sensibili. Deve invece essere committato `.env.example`, che contiene solo placeholder.

## Avvio del server

Dalla cartella `middleware`:

```bash
npm run dev
```

oppure:

```bash
npm start
```

Il comando `npm run dev` usa `node --watch` e riavvia automaticamente il server quando viene modificato `server.js`.

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
  "status": "recorded",
  "transactionHash": "0x...",
  "blockNumber": 3,
  "deviceAddress": "0x...",
  "value": "25",
  "deviceTimestamp": "1782227412",
  "nonce": "1",
  "dataHash": "0x..."
}
```

## Script di simulazione

### Simulazione di un dispositivo

Lo script `scripts/simulate-device.js` simula il comportamento logico di un dispositivo che invia una misura firmata al middleware.

Lo script:

1. deriva il `deviceAddress` dalla `DEVICE_PRIVATE_KEY`;
2. costruisce una misura simulata;
3. legge il nonce corrente dallo smart contract;
4. ottiene l'hash della misura tramite la funzione `getMeasurementHash`;
5. firma l'hash con la private key del dispositivo simulato;
6. invia il payload firmato al middleware.

Esecuzione:

```bash
npm run simulate-device
```

È possibile passare un valore personalizzato:

```bash
npm run simulate-device -- 28
```

### Scenari negativi

Lo script `scripts/test-negative-measurements.js` esegue verifiche manuali di integrazione sul middleware.

Gli scenari coperti sono:

1. richiesta con API key errata;
2. payload alterato dopo la firma;
3. misura valida;
4. replay della stessa misura.

Esecuzione:

```bash
npm run test-negative-measurements
```

Esempio di risultati attesi:

```text
Test 1 - API key sbagliata
Status: 401

Test 2 - Payload alterato dopo la firma
Status: 400

Test 3 - Misura valida
Status: 201

Test 4 - Replay della stessa misura
Status: 409
```

Questi script non sostituiscono i test Foundry dello smart contract. I test Foundry verificano la sicurezza on-chain del contratto in isolamento, mentre gli script Node.js verificano il comportamento del middleware nel flusso applicativo.

## Note di sicurezza

Il middleware non deve possedere la private key del dispositivo reale. La private key del dispositivo deve restare nel nodo IoT, mentre il middleware deve possedere solo la private key del relayer.

La distinzione è:

```text
DEVICE_PRIVATE_KEY  -> firma il contenuto della misura
RELAYER_PRIVATE_KEY -> paga il gas e invia la transazione
```

In questo modo il middleware non è il produttore fiduciario della misura: può solo inoltrare dati firmati dal dispositivo. Se modifica `value`, `deviceTimestamp` o `nonce`, la firma non risulta più valida.

## Stato attuale

Il middleware è stato testato localmente con Anvil. Una misura firmata da un dispositivo simulato è stata accettata dal middleware, registrata sullo smart contract e letta correttamente dal frontend Web3.

Il firmware ESP32 attuale invia già i campi principali della misura, ma la generazione della firma crittografica deve ancora essere portata nel codice del microcontrollore. Per questo motivo, in questa fase, lo script `simulate-device.js` viene usato per simulare il comportamento finale atteso del dispositivo.
