# IoT Data Chain

## Obiettivo

Realizzare un sistema IoT-blockchain in cui un ESP32 raccoglie o simula misurazioni ambientali, le invia a un middleware Node.js, che registra i dati su uno smart contract.

Una web app permette all'utente di collegare MetaMask, registrare un microcontrollore/dispositivo e leggere le misurazioni salvate sulla blockchain.

## Architettura

```text
ESP32 -> Node.js -> Smart Contract -> Web App
```

## Componenti principali

### Firmware ESP32

Raccoglie o simula misurazioni ambientali e le invia al middleware tramite richieste HTTP.

### Middleware Node.js

Riceve le misurazioni dal dispositivo e le registra sulla blockchain interagendo con lo smart contract.

### Smart contract

Gestisce la registrazione dei dispositivi e la memorizzazione delle misurazioni associate a ciascun device.

### Web app

Permette all'utente di collegare MetaMask, registrare/configurare un dispositivo e leggere i dati salvati sulla blockchain.

## Parte Web3

La parte web3 del progetto include:

* uso di MetaMask per collegare un wallet alla web app;
* registrazione/configurazione di un dispositivo tramite transazione firmata dall'utente;
* lettura dei dati dalla blockchain tramite provider RPC;
* interazione con lo smart contract tramite ethers.js.

## Organizzazione repository

La repository è organizzata in più sottocartelle, ciascuna dedicata a una parte del sistema:

```text
iot-blockchain-interaction/
├── firmware/
├── frontend/
├── foundry-iot-data-chain/
├── scripts/
├── Makefile
└── README.md
```

### `firmware/`

Contiene il codice per ESP32 scritto in ambiente Arduino.

Il firmware ha il compito di raccogliere o simulare misurazioni ambientali e inviarle al middleware tramite richieste HTTP.

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
* configurazione Foundry;
* artifact generati dalla compilazione.

### `scripts/`

Contiene script di supporto usati durante lo sviluppo locale.

Attualmente include lo script per il deploy su Anvil e per l'aggiornamento automatico dell'indirizzo del contratto usato dal frontend.

### `Makefile`

Raccoglie comandi utili per automatizzare operazioni frequenti durante lo sviluppo, come il deploy del contratto e l'invio di misurazioni simulate.

## Automazione sviluppo locale

Per semplificare il lavoro durante lo sviluppo su blockchain locale Anvil, il progetto include un `Makefile` nella root della repository.

Il Makefile permette di automatizzare alcune operazioni ripetitive:

* deploy dello smart contract su Anvil;
* aggiornamento automatico dell'indirizzo del contratto usato dal frontend;
* visualizzazione dell'indirizzo del contratto configurato nel frontend;
* invio di una misurazione simulata da parte di un dispositivo registrato.

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

### Invio di una misurazione simulata

```bash
make record-measurement
```

Invia una misurazione simulata al contratto usando l'account Anvil configurato come dispositivo.

È possibile specificare un valore diverso della misurazione:

```bash
make record-measurement VALUE=28
```

## Flusso di sviluppo locale

Durante lo sviluppo locale, il flusso tipico è:

```text
1. Avviare Anvil
2. Eseguire il deploy del contratto con make deploy
3. Aprire la web app
4. Collegare MetaMask alla rete locale Anvil
5. Registrare un dispositivo dalla web app
6. Inviare una misurazione simulata con make record-measurement
7. Leggere i dati aggiornati dalla web app
```

Nota: dopo ogni riavvio di Anvil, lo stato della blockchain locale viene perso. Di conseguenza è necessario eseguire nuovamente il deploy del contratto e registrare nuovamente il dispositivo prima di inviare nuove misurazioni.
