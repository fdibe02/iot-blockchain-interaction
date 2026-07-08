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

## Branch sperimentali

La repository usa branch sperimentali per confrontare varianti dell'architettura blockchain/middleware. Tra branch possono cambiare smart contract, ABI e logica middleware, ad esempio per valutare diverse strategie di storage o diverse modalità di invio delle misurazioni.

Il firmware ESP32 resta invece stabile nel formato del payload firmato: continua a produrre e inviare `deviceAddress`, `value`, `deviceTimestamp`, `nonce` e `signature`. Tra branch possono cambiare solo parametri operativi necessari all'esperimento, come indirizzo del contratto, chain id o endpoint del middleware.

La cartella `experiments/` contiene dati, script di ricostruzione/analisi, grafici e riepiloghi mantenuti come livello comune di confronto tra i branch sperimentali.

## Stato attuale dell'integrazione

Il flusso firmato completo oggi è verificabile in due modi:

```text
simulate-device.js -> Node.js middleware -> Smart Contract -> Web App
ESP32 firmware -> Node.js middleware -> Smart Contract -> Web App
```

Lo script `middleware/scripts/simulate-device.js` resta utile per testare rapidamente il flusso senza usare la board fisica. Il firmware ESP32 attuale costruisce invece il buffer compatibile con `abi.encodePacked(...)`, calcola il `dataHash`, genera una firma ECDSA secp256k1 e invia il payload firmato al middleware.

| Componente         | Stato attuale                                                                                           | Obiettivo finale                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Smart contract     | Registra dispositivi, verifica firme e nonce, salva misurazioni firmate.                                | Restare il punto di verità on-chain del sistema.               |
| Middleware         | Riceve payload firmati, verifica API key, formato, registrazione, nonce e firma prima di inviare la tx. | Fare da gateway/relayer per dispositivi reali.                 |
| Simulatore Node.js | Simula un dispositivo firmante e permette di testare il flusso completo senza board fisica.             | Restare uno strumento di test e debug.                         |
| Firmware ESP32     | Legge una misura, usa WiFi/HTTP/NTP, calcola hash, firma e invia il payload completo al middleware.     | Essere verificato end-to-end su board fisica e rete reale.     |
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

* legge valori di temperatura dal pin analogico configurato, pensato per un sensore LM35 nel prototipo attuale;
* sincronizza l'orario tramite NTP quando disponibile;
* sincronizza il nonce dal middleware;
* costruisce il buffer binario coerente con `abi.encodePacked(...)`;
* calcola il `dataHash` con Keccak-256;
* firma il messaggio con ECDSA secp256k1 usando la private key del dispositivo;
* invia al middleware `deviceAddress`, `value`, `deviceTimestamp`, `nonce` e `signature`.

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

Il middleware espone API HTTP verso il dispositivo, valida le richieste prima di spendere gas e invia le transazioni usando il wallet del relayer.

Questi controlli off-chain servono a evitare transazioni inutili e gas sprecato. La verifica definitiva resta nello smart contract.

Il middleware supporta profili di configurazione separati per Anvil e Sepolia. Per endpoint, variabili d'ambiente e script disponibili vedere `middleware/README.md`.

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
├── experiments/
├── firmware/
├── frontend/
├── foundry-iot-data-chain/
├── middleware/
├── scripts/
├── Makefile
└── README.md
```

### `experiments/`

Contiene i dataset sperimentali normalizzati, i dati raw usati per ricostruire alcune metriche, gli script di analisi, i grafici PNG e i riepiloghi dei risultati. Questa cartella rappresenta il livello comune di confronto tra i branch sperimentali; le differenze implementative tra branch restano principalmente in smart contract e middleware.

### `firmware/`

Contiene il codice per ESP32 scritto in ambiente Arduino.

Il firmware attuale:

* genera misurazioni simulate;
* gestisce WiFi e timestamp;
* sincronizza il nonce con il middleware;
* calcola hash e firma della misura;
* prepara e invia il payload HTTP firmato al middleware.

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
├── README.md
└── scripts/
```

Per endpoint, payload, configurazione e script vedere `middleware/README.md`.

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
* avvio del middleware;
* invio di misurazioni simulate tramite middleware;
* compilazione, upload e monitor seriale del firmware;
* controlli rapidi su script, smart contract e pipeline.

## Automazione sviluppo locale

Per semplificare il lavoro durante lo sviluppo su blockchain locale Anvil, il progetto include un `Makefile` nella root della repository.

Il Makefile permette di automatizzare alcune operazioni ripetitive:

* deploy dello smart contract su Anvil;
* aggiornamento automatico dell'indirizzo del contratto usato dal frontend;
* visualizzazione dell'indirizzo del contratto configurato nel frontend;
* registrazione di un dispositivo da console;
* invio di una misurazione simulata tramite middleware;
* compilazione e upload del firmware ESP32;
* test e controlli di sintassi/formattazione.

## Comandi principali

### Installazione dipendenze

```bash
make install
```

Installa le dipendenze del middleware Node.js.

### Controlli generali

```bash
make check
```

Esegue controlli non interattivi su JavaScript, script Bash, formattazione Solidity e test Foundry. Per controlli più mirati:

```bash
make check-js
make check-scripts
make fmt-contract-check
make test-contract
```

Per compilare o formattare i contratti:

```bash
make build-contract
make fmt-contract
```

### Deploy del contratto

```bash
make deploy-anvil
```

Esegue il deploy dello smart contract su Anvil e aggiorna automaticamente:

```text
frontend/js/contract-address.js
middleware/.env.anvil
firmware/esp32-iot-data-chain/secrets.h
```

In questo modo la web app, il middleware e il firmware locale usano l'indirizzo dell'ultimo contratto deployato. Nel firmware vengono aggiornati solo valori pubblici o operativi (`CONTRACT_ADDRESS`, `CHAIN_ID`, `NONCE_URL`); WiFi, API key e private key restano manuali.

Per Sepolia il comando equivalente è:

```bash
make deploy-sepolia
```

### Visualizzazione dell'indirizzo del contratto

```bash
make show-address
```

Mostra l'indirizzo del contratto attualmente configurato nel frontend.

### Misura simulata tramite middleware

```bash
make simulate-device-anvil
```

Invia una misurazione firmata tramite lo script Node.js che simula il dispositivo.

Questo comando è utile per testare il flusso completo:

```text
simulatore -> middleware -> smart contract -> frontend
```

È possibile specificare un valore diverso della misurazione:

```bash
make simulate-device-anvil VALUE=28
```

### Comandi del middleware

Il middleware contiene script npm separati per i profili Anvil e Sepolia. Questi script coprono avvio del server, simulazione di un dispositivo firmante, test applicativi e verifica di coerenza dell'hash.

I dettagli operativi sono documentati in `middleware/README.md`.

Comandi Make utili:

```bash
make start-middleware-anvil
make health-anvil
make register-device-anvil
make verify-hash-anvil
make test-negative-anvil
```

Per Sepolia esistono i target equivalenti:

```bash
make start-middleware-sepolia
make health-sepolia
make register-device-sepolia
make verify-hash-sepolia
make test-negative-sepolia
```

`register-device-*` registra un dispositivo usando `OWNER_PRIVATE_KEY`. Se `DEVICE_ADDRESS` non viene passato, lo script prova a derivare l'address da `DEVICE_PRIVATE_KEY` configurata nell'ambiente:

```bash
make register-device-anvil
make register-device-anvil DEVICE_ADDRESS=0x... METADATA_URI=esp32-laboratorio
```

Su Sepolia il comando invia una transazione reale e consuma gas:

```bash
make register-device-sepolia DEVICE_ADDRESS=0x... METADATA_URI=esp32-laboratorio
```

### Comandi firmware

```bash
make firmware-compile
make firmware-upload PORT=/dev/cu.usbserial-0001
make firmware-monitor PORT=/dev/cu.usbserial-0001
make firmware-flash-monitor PORT=/dev/cu.usbserial-0001
```

Il target `firmware-flash-monitor` carica il firmware sulla board e apre subito il monitor seriale. Il valore di default di `PORT` è `/dev/cu.usbserial-0001`; se la board usa una porta diversa, passarla esplicitamente.

## Flusso di sviluppo locale

Durante lo sviluppo locale, il flusso tipico è:

```text
1. Avviare Anvil
2. Eseguire il deploy del contratto con `make deploy-anvil`
3. Configurare `middleware/.env.anvil` e, se si usa la board, `firmware/esp32-iot-data-chain/secrets.h`
4. Aprire la web app
5. Collegare MetaMask alla rete locale Anvil
6. Registrare il dispositivo dalla web app o con `make register-device-anvil`
7. Avviare il middleware Node.js
8. Inviare una misurazione firmata tramite `make simulate-device-anvil` oppure tramite ESP32
9. Leggere i dati aggiornati dalla web app
```

Nota: dopo ogni riavvio di Anvil, lo stato della blockchain locale viene perso. Di conseguenza è necessario eseguire nuovamente il deploy del contratto e registrare nuovamente il dispositivo prima di inviare nuove misurazioni.

## Risultati sperimentali

La parte sperimentale e' raccolta in `experiments/`.

La cartella contiene:

* CSV normalizzati con schema comune;
* dati raw usati per ricostruire receipt, transazioni e timestamp dei blocchi;
* script per generare grafici e riepiloghi;
* grafici PNG usati per commentare i risultati nella tesi.

I dettagli dello schema dati, dei criteri di esclusione delle transazioni di inizializzazione e dei limiti sperimentali sono documentati in `experiments/README.md` e `experiments/schema.md`.

I grafici possono essere rigenerati con:

```bash
python3 experiments/scripts/plot-experiments.py
```

Il riepilogo numerico viene salvato in:

```text
experiments/results/summary.md
```

Nei grafici principali sono escluse le righe con `isInitializationTx=true`, che rappresentano il costo iniziale della prima scrittura su storage vuoto e non il costo ordinario a regime.

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

Nel sistema finale il middleware non deve possedere la private key del dispositivo reale. Nel prototipo attuale, invece, la private key del dispositivo è configurata nel firmware ESP32 per permettere alla board di firmare le misure. È una scelta accettabile per una demo didattica, ma in un sistema reale la chiave andrebbe protetta meglio, ad esempio tramite secure element o meccanismi hardware dedicati.

## Stato del progetto

Il progetto è pensato come prototipo didattico/sperimentale per una tesi triennale, verticalizzato sul caso d'uso del monitoraggio della catena del freddo.

L'obiettivo non è realizzare un sistema IoT industriale completo per logistica refrigerata, ma dimostrare un flusso end-to-end:

```text
misurazione -> firma del dispositivo -> middleware -> smart contract -> lettura da web app
```

Il flusso end-to-end firmato è dimostrabile tramite dispositivo simulato in Node.js e tramite firmware ESP32 firmante. Il passaggio ancora aperto è completare e documentare i test su board fisica, rete reale e sensore reale.

Il sistema permette quindi di studiare:

* interazione tra IoT e blockchain;
* uso di smart contract per memorizzare dati;
* uso di MetaMask in una web app;
* uso di un middleware come relayer;
* verifica crittografica dell'origine delle misurazioni;
* limiti pratici di una soluzione on-chain, come costo del gas, frequenza delle scritture e gestione delle chiavi.
