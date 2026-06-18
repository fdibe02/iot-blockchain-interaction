# IoT Data Chain

## Obiettivo

Realizzare un sistema IoT-blockchain in cui un ESP32 raccoglie o simula misurazioni ambientali, firma digitalmente i dati prodotti e li invia a un middleware Node.js.

Il middleware riceve le misurazioni firmate, le inoltra a uno smart contract e paga il gas della transazione tramite un wallet relayer.

Una web app permette all'utente di collegare MetaMask, registrare/configurare un microcontrollore/dispositivo e leggere le misurazioni salvate sulla blockchain.

## Architettura

```text
ESP32 -> Node.js middleware -> Smart Contract -> Web App
```

Il progetto usa un'architettura con middleware/relayer:

* l'ESP32 produce la misurazione;
* l'ESP32 firma i dati della misurazione con una chiave privata associata al dispositivo;
* il middleware riceve la misurazione firmata;
* il middleware invia la transazione allo smart contract;
* lo smart contract verifica che la firma corrisponda all'indirizzo del dispositivo registrato;
* la web app legge i dati salvati on-chain.

In questo modo il middleware non è considerato la fonte fidata del dato: il suo ruolo principale è inoltrare la misurazione alla blockchain e pagare il gas. La validità del dato dipende invece dalla firma del dispositivo.

## Componenti principali

### Firmware ESP32

Contiene il codice eseguito dal microcontrollore.

Il firmware ha il compito di:

* raccogliere o simulare misurazioni ambientali;
* costruire il messaggio da inviare;
* firmare la misurazione con la chiave privata del dispositivo;
* inviare i dati firmati al middleware tramite richiesta HTTP.

Il payload inviato al middleware ha una struttura simile alla seguente:

```json
{
  "deviceAddress": "0x...",
  "value": 25,
  "deviceTimestamp": 1780000000,
  "nonce": 1,
  "signature": "0x..."
}
```

Dove:

* `deviceAddress` è l'indirizzo Ethereum associato al dispositivo;
* `value` è il valore misurato o simulato;
* `deviceTimestamp` è il timestamp prodotto dal dispositivo;
* `nonce` serve a distinguere le misurazioni e a ridurre il rischio di replay;
* `signature` è la firma digitale dei dati della misurazione.

### Middleware Node.js

Il middleware riceve le misurazioni firmate dal dispositivo e interagisce con lo smart contract.

Il middleware ha il compito di:

* esporre un endpoint HTTP per ricevere le misurazioni;
* accettare richieste `POST /api/measurements`;
* opzionalmente verificare la firma prima di inviare la transazione;
* inviare la misurazione allo smart contract usando il wallet del relayer;
* non modificare `value`, `deviceTimestamp`, `nonce` o `deviceAddress`.

Il middleware usa variabili d'ambiente per la configurazione:

```env
RPC_URL=
CONTRACT_ADDRESS=
RELAYER_PRIVATE_KEY=
PORT=3000
```

Il wallet relayer paga il gas della transazione, ma non deve essere considerato proprietario del dato misurato.

### Smart contract

Lo smart contract gestisce:

* registrazione dei dispositivi;
* associazione tra indirizzo Ethereum e dispositivo fisico/logico;
* verifica della firma della misurazione;
* memorizzazione delle misurazioni;
* lettura dei dati da parte della web app.

La registrazione del dispositivo viene effettuata dall'utente tramite MetaMask.

**La registrazione delle misurazioni viene effettuata dal middleware, ma il contratto deve verificare che i dati siano stati firmati dal dispositivo corretto.**

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

## Parte Web3

La parte web3 del progetto include:

* uso di MetaMask per collegare un wallet alla web app;
* registrazione/configurazione di un dispositivo tramite transazione firmata dall'utente;
* lettura dei dati dalla blockchain tramite provider RPC;
* interazione con lo smart contract tramite ethers.js;
* distinzione tra utente, dispositivo e relayer.

Nel progetto ci sono tre ruoli principali:

| Ruolo              | Descrizione                                                          |
| ------------------ | -------------------------------------------------------------------- |
| Utente             | Usa MetaMask dalla web app per registrare/configurare un dispositivo |
| Dispositivo        | Produce e firma le misurazioni                                       |
| Relayer/middleware | Riceve i dati firmati e invia la transazione allo smart contract     |

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

Il firmware ha il compito di:

* raccogliere o simulare misurazioni ambientali;
* preparare il payload della misurazione;
* firmare i dati del dispositivo;
* inviare la richiesta HTTP al middleware.

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

Contiene il server Node.js che fa da ponte tra ESP32 e blockchain.

Il middleware espone un endpoint HTTP per ricevere le misurazioni firmate e inviarle allo smart contract.

Struttura prevista:

```text
middleware/
├── package.json
├── .env.example
└── src/
    └── server.js
```

Endpoint principale:

```text
POST /api/measurements
```

Payload atteso:

```json
{
  "deviceAddress": "0x...",
  "value": 25,
  "deviceTimestamp": 1780000000,
  "nonce": 1,
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
* invio di misurazioni simulate;
* supporto al testing locale.

## Automazione sviluppo locale

Per semplificare il lavoro durante lo sviluppo su blockchain locale Anvil, il progetto include un `Makefile` nella root della repository.

Il Makefile permette di automatizzare alcune operazioni ripetitive:

* deploy dello smart contract su Anvil;
* aggiornamento automatico dell'indirizzo del contratto usato dal frontend;
* visualizzazione dell'indirizzo del contratto configurato nel frontend;
* invio di una misurazione simulata.

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

Invia una misurazione simulata al contratto.

Durante le prime fasi di sviluppo questo comando può essere usato per testare il contratto senza passare dal firmware ESP32 reale.

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
6. Avviare il middleware Node.js
7. Inviare una misurazione simulata o prodotta dall'ESP32
8. Far inoltrare la misurazione firmata dal middleware allo smart contract
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

Questa scelta permette di evitare che il middleware possa inventare o alterare misurazioni senza che il contratto lo rilevi.

## Stato del progetto

Il progetto è pensato come prototipo didattico/sperimentale per una tesi triennale.

L'obiettivo non è realizzare un sistema IoT industriale completo, ma dimostrare un flusso end-to-end:

```text
misurazione -> firma del dispositivo -> middleware -> smart contract -> lettura da web app
```

Il sistema permette quindi di studiare:

* interazione tra IoT e blockchain;
* uso di smart contract per memorizzare dati;
* uso di MetaMask in una web app;
* uso di un middleware come relayer;
* verifica crittografica dell'origine delle misurazioni;
* limiti pratici di una soluzione on-chain, come costo del gas, frequenza delle scritture e gestione delle chiavi.
