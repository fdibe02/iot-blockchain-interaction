# IoT Data Chain

## Obiettivo finale

Realizzare un sistema IoT-blockchain in cui un ESP32 raccoglie o simula misurazioni ambientali, firma digitalmente i dati prodotti e li invia a un middleware Node.js.

Il middleware riceve le misurazioni firmate, le valida preventivamente, le inoltra a uno smart contract e paga il gas della transazione tramite un wallet relayer.

Una web app permette all'utente di collegare MetaMask, registrare/configurare un dispositivo e leggere le misurazioni salvate sulla blockchain.

Il caso d'uso di riferimento è il monitoraggio della catena del freddo: il dispositivo rappresenta un nodo IoT installato, ad esempio, su un contenitore, un magazzino o un mezzo di trasporto refrigerato, e registra misurazioni di temperatura utili a ricostruire lo storico delle condizioni ambientali. La blockchain viene usata come registro condiviso e verificabile delle misurazioni, mentre la firma del dispositivo serve a dimostrare che il dato è stato prodotto dal nodo registrato e non modificato dal middleware.

## Architettura

Flusso finale previsto:

```text
ESP32 -> Node.js middleware -> Smart Contract -> Web App
```

Il progetto usa un'architettura con middleware/relayer:

* il dispositivo produce una misurazione;
* il dispositivo firma i dati della misurazione con una chiave privata associata al proprio address Ethereum;
* il middleware riceve la misurazione firmata tramite API HTTP;
* il middleware effettua controlli preventivi off-chain;
* il middleware invia la transazione allo smart contract usando il wallet relayer;
* lo smart contract verifica on-chain registrazione del dispositivo, nonce e firma;
* la web app legge i dati salvati on-chain.

In questo modello il middleware non è considerato la fonte fidata del dato: il suo ruolo principale è inoltrare la misurazione alla blockchain e pagare il gas. La validità del dato dipende dalla firma del dispositivo e dalla verifica effettuata dallo smart contract.

## Stato attuale dell'integrazione

Il flusso firmato completo oggi è verificabile usando uno script Node.js che simula il comportamento logico del dispositivo:

```text
simulate-device.js -> Node.js middleware -> Smart Contract -> Web App
```

Il firmware ESP32 attuale invia già una richiesta HTTP con i campi principali della misura, ma non genera ancora la firma crittografica richiesta dal middleware. Per questo motivo, in questa fase, lo script `middleware/scripts/simulate-device.js` viene usato per simulare il dispositivo firmante finale.

| Componente         | Stato attuale                                                                                           | Obiettivo finale                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Smart contract     | Registra dispositivi, verifica firme e nonce, salva misurazioni firmate.                                | Restare il punto di verità on-chain del sistema.               |
| Middleware         | Riceve payload firmati, verifica API key, formato, registrazione, nonce e firma prima di inviare la tx. | Fare da gateway/relayer per dispositivi reali.                 |
| Simulatore Node.js | Simula un dispositivo firmante e permette di testare il flusso completo.                                | Essere sostituito dal firmware ESP32 firmante.                 |
| Firmware ESP32     | Simula misure, usa WiFi/HTTP/NTP e invia i campi principali della misura.                               | Firmare la misura e inviare il payload completo al middleware. |
| Frontend           | Permette connessione MetaMask, registrazione device e lettura dati on-chain.                            | Restare interfaccia di configurazione e consultazione.         |

## Componenti principali

### Firmware ESP32

Contiene il codice eseguito dal microcontrollore.

Obiettivo finale del firmware:

* raccogliere o simulare misurazioni ambientali, in particolare valori di temperatura nel caso d'uso della catena del freddo;
* costruire il messaggio da inviare;
* firmare la misurazione con la chiave privata del dispositivo;
* inviare i dati firmati al middleware tramite richiesta HTTP.

Stato attuale:

* genera valori simulati;
* sincronizza l'orario tramite NTP quando disponibile;
* invia richieste HTTP al middleware;
* include `deviceAddress`, `value`, `deviceTimestamp` e `nonce`;
* non include ancora `signature` nel payload.

Il payload finale atteso dal middleware ha questa struttura:

```json
{
  "deviceAddress": "0x...",
  "value": "25",
  "deviceTimestamp": "1780000000",
  "nonce": "1",
  "signature": "0x..."
}
```

Dove:

* `deviceAddress` è l'indirizzo Ethereum associato al dispositivo;
* `value` è il valore misurato o simulato, ad esempio la temperatura rilevata nel caso d'uso della catena del freddo;
* `deviceTimestamp` è il timestamp prodotto dal dispositivo;
* `nonce` serve a distinguere le misurazioni e a ridurre il rischio di replay;
* `signature` è la firma digitale dei dati della misurazione.

### Middleware Node.js

Il middleware riceve le misurazioni firmate dal dispositivo, effettua controlli preliminari e interagisce con lo smart contract tramite `ethers.js`.

Il middleware:

* espone `GET /health` per verificare connessione al nodo blockchain;
* espone `POST /api/measurements` per registrare misurazioni;
* richiede l'header `X-API-Key`;
* valida formato del payload;
* controlla che il dispositivo sia registrato;
* controlla che il nonce sia maggiore dell'ultimo nonce accettato;
* verifica off-chain che la firma sia coerente con l'address del dispositivo;
* invia la misurazione allo smart contract usando il wallet del relayer.

Questi controlli off-chain servono a evitare transazioni inutili e gas sprecato. La verifica definitiva resta nello smart contract.

Il middleware usa variabili d'ambiente per la configurazione. Le principali sono:

```env
PORT=3000
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x...
RELAYER_PRIVATE_KEY=0x...
DEVICE_API_KEY=dev-secret-esp32-1
CONFIRMATIONS=1
```

Per la configurazione completa e gli script disponibili vedere `middleware/README.md`.

### Smart contract

Lo smart contract `IoTDataStorage` gestisce:

* owner del contratto;
* registrazione dei dispositivi;
* associazione tra address Ethereum e dispositivo fisico/logico;
* verifica della firma della misurazione;
* protezione anti-replay tramite nonce crescente;
* memorizzazione delle misurazioni;
* lettura dei dati da parte della web app.

La registrazione dei dispositivi è riservata all'owner del contratto.

La registrazione delle misurazioni può essere inviata dal middleware/relayer, ma il contratto accetta la misura solo se:

* il dispositivo è registrato;
* il nonce è maggiore dell'ultimo nonce accettato;
* la firma è stata prodotta dall'address del dispositivo registrato.

L'hash firmato include `address(this)` e `block.chainid`, così la stessa firma non è riutilizzabile su un altro contratto o su un'altra blockchain.

### Web app

La web app permette all'utente di interagire con lo smart contract tramite MetaMask ed ethers.js.

La web app permette di:

* collegare il wallet;
* leggere l'owner del contratto;
* registrare/configurare un dispositivo;
* leggere i dati di un dispositivo registrato;
* leggere l'ultima misurazione associata a un dispositivo;
* verificare il flusso completo tra dispositivo, middleware e blockchain.

La web app non produce direttamente le misurazioni: il suo ruolo è principalmente di configurazione e consultazione.

## Ruoli Web3

Nel progetto ci sono tre ruoli principali:

| Ruolo              | Descrizione                                                                  |
| ------------------ | ---------------------------------------------------------------------------- |
| Utente/owner       | Usa MetaMask dalla web app per registrare/configurare un dispositivo.        |
| Dispositivo        | Produce la misura e, nel flusso finale, firma i dati.                        |
| Relayer/middleware | Riceve dati firmati, paga il gas e invia la transazione allo smart contract. |

La distinzione tra dispositivo e relayer è centrale: il relayer paga la transazione, ma non è il proprietario crittografico della misura.

## Organizzazione repository

La repository è organizzata in più sottocartelle, ciascuna dedicata a una parte del sistema:

```text
iot-blockchain-interaction/
├── firmware/
├── frontend/
├── foundry-iot-data-chain/
├── middleware/
├── scripts/
├── Makefile
└── README.md
```

### `firmware/`

Contiene il codice per ESP32 scritto in ambiente Arduino.

Il firmware attuale:

* genera misurazioni simulate;
* gestisce WiFi e timestamp;
* prepara un payload HTTP;
* invia la richiesta al middleware.

La firma crittografica della misura deve ancora essere portata nel codice del microcontrollore.

### `frontend/`

Contiene la web app utilizzata dall'utente per interagire con lo smart contract tramite MetaMask.

La web app permette di:

* collegare il wallet;
* leggere l'owner del contratto;
* registrare un dispositivo;
* leggere i dati di un dispositivo registrato;
* leggere l'ultima misurazione associata a un dispositivo.

### `foundry-iot-data-chain/`

Contiene il progetto Foundry relativo alla parte blockchain.

Include:

* smart contract;
* script di deploy;
* test automatici;
* configurazione Foundry.

Gli artifact generati dalla compilazione, come `out/`, `cache/` e `broadcast/`, non sono parte del codice sorgente principale e sono esclusi dal versionamento tramite `.gitignore`.

### `middleware/`

Contiene il server Node.js che fa da ponte tra dispositivo e blockchain.

Struttura principale:

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

Endpoint principali:

```text
GET  /health
POST /api/measurements
```

Il payload accettato da `POST /api/measurements` deve contenere:

```json
{
  "deviceAddress": "0x...",
  "value": "25",
  "deviceTimestamp": "1780000000",
  "nonce": "1",
  "signature": "0x..."
}
```

Il middleware non deve inventare né modificare i dati ricevuti dal dispositivo. Deve inoltrarli allo smart contract mantenendo invariati:

* indirizzo del dispositivo;
* valore misurato;
* timestamp del dispositivo;
* nonce;
* firma.

### `scripts/`

Contiene script di supporto usati durante lo sviluppo locale.

Attualmente include script per:

* deploy su Anvil;
* aggiornamento automatico dell'indirizzo del contratto usato dal frontend;
* supporto al flusso di sviluppo locale.

### `Makefile`

Raccoglie comandi utili per automatizzare operazioni frequenti durante lo sviluppo, come:

* deploy del contratto;
* visualizzazione dell'indirizzo del contratto;
* invio diretto di misurazioni simulate allo smart contract.

## Automazione sviluppo locale

Per semplificare il lavoro durante lo sviluppo su blockchain locale Anvil, il progetto include un `Makefile` nella root della repository.

Il Makefile permette di automatizzare alcune operazioni ripetitive:

* deploy dello smart contract su Anvil;
* aggiornamento automatico dell'indirizzo del contratto usato dal frontend;
* visualizzazione dell'indirizzo del contratto configurato nel frontend;
* invio diretto di una misurazione simulata al contratto.

## Comandi principali

### Deploy del contratto

```bash
make deploy
```

Esegue il deploy dello smart contract su Anvil e aggiorna automaticamente il file:

```text
frontend/js/contract-address.js
```

In questo modo la web app utilizza sempre l'indirizzo dell'ultimo contratto deployato, senza dover modificare manualmente il codice del frontend.

### Visualizzazione dell'indirizzo del contratto

```bash
make show-address
```

Mostra l'indirizzo del contratto attualmente configurato nel frontend.

### Misura simulata diretta sul contratto

```bash
make record-measurement
```

Invia una misurazione simulata direttamente allo smart contract usando `cast`.

Questo comando è utile per testare rapidamente il contratto, ma bypassa il middleware.

È possibile specificare un valore diverso della misurazione:

```bash
make record-measurement VALUE=28
```

### Misura simulata tramite middleware

Dalla cartella `middleware`:

```bash
npm run simulate-device
```

Questo comando simula un dispositivo che firma la misura e la invia al middleware. È il flusso più vicino all'integrazione finale:

```text
dispositivo simulato -> middleware -> smart contract -> frontend
```

È possibile specificare un valore diverso:

```bash
npm run simulate-device -- 28
```

### Test applicativi del middleware

Dalla cartella `middleware`:

```bash
npm run test-negative-measurements
```

Lo script verifica scenari applicativi come:

* API key errata;
* payload alterato dopo la firma;
* misura valida;
* replay della stessa misura.

Questi test non sostituiscono i test Foundry dello smart contract: servono a verificare il comportamento del middleware nel flusso applicativo.

## Flusso di sviluppo locale

Durante lo sviluppo locale, il flusso tipico è:

```text
1. Avviare Anvil
2. Eseguire il deploy del contratto con make deploy
3. Aprire la web app
4. Collegare MetaMask alla rete locale Anvil
5. Registrare un dispositivo dalla web app
6. Configurare middleware/.env
7. Avviare il middleware Node.js
8. Inviare una misurazione firmata con npm run simulate-device
9. Leggere i dati aggiornati dalla web app
```

Nota: dopo ogni riavvio di Anvil, lo stato della blockchain locale viene perso. Di conseguenza è necessario eseguire nuovamente il deploy del contratto e registrare nuovamente il dispositivo prima di inviare nuove misurazioni.

## Sicurezza e modello di fiducia

Il progetto distingue tra trasporto del dato e autenticità del dato.

Il middleware trasporta il dato verso la blockchain e paga il gas, ma non deve essere considerato una sorgente fidata.

L'autenticità della misurazione è garantita dalla firma digitale del dispositivo:

* il dispositivo firma `deviceAddress`, `value`, `deviceTimestamp` e `nonce`;
* il middleware inoltra questi dati allo smart contract;
* lo smart contract verifica che la firma corrisponda al dispositivo registrato;
* se il middleware modifica anche solo un campo, la firma non risulta più valida.

La private key del dispositivo e la private key del relayer hanno ruoli diversi:

```text
DEVICE_PRIVATE_KEY  -> firma il contenuto della misura
RELAYER_PRIVATE_KEY -> paga il gas e invia la transazione
```

Nel sistema finale il middleware non deve possedere la private key del dispositivo reale.

## Stato del progetto

Il progetto è pensato come prototipo didattico/sperimentale per una tesi triennale, verticalizzato sul caso d'uso del monitoraggio della catena del freddo.

L'obiettivo non è realizzare un sistema IoT industriale completo per logistica refrigerata, ma dimostrare un flusso end-to-end:

```text
misurazione -> firma del dispositivo -> middleware -> smart contract -> lettura da web app
```

Il flusso end-to-end firmato è attualmente dimostrato tramite un dispositivo simulato in Node.js. Il passaggio ancora aperto è portare la generazione della firma crittografica nel firmware ESP32.

Il sistema permette quindi di studiare:

* interazione tra IoT e blockchain;
* uso di smart contract per memorizzare dati;
* uso di MetaMask in una web app;
* uso di un middleware come relayer;
* verifica crittografica dell'origine delle misurazioni;
* limiti pratici di una soluzione on-chain, come costo del gas, frequenza delle scritture e gestione delle chiavi.
