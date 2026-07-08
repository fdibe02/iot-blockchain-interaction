# Esperimenti

Questa cartella raccoglie i dati sperimentali usati per valutare il prototipo IoT + Blockchain.

L'obiettivo degli esperimenti non e' stimare prestazioni assolute della rete Ethereum, ma confrontare in modo ripetibile le alternative implementate nel progetto:

- esecuzione locale su Anvil rispetto a Sepolia;
- diverse strategie di storage nello smart contract;
- costo ordinario di registrazione di una misura firmata;
- impatto della prima scrittura su storage vuoto;
- confronto preliminare tra invio singolo e batch.

## Nota sui branch sperimentali

Questa cartella contiene il livello comune di analisi sperimentale. I CSV normalizzati, gli script di ricostruzione e plotting, i grafici PNG e i riepiloghi sono pensati per essere presenti e confrontabili nei branch sperimentali.

Le differenze tra branch riguardano principalmente smart contract, ABI e middleware: ad esempio strategie di storage, calldata e logica di inoltro delle misurazioni. Il firmware ESP32 resta invece stabile nel formato del payload firmato (`deviceAddress`, `value`, `deviceTimestamp`, `nonce`, `signature`); cambiano solo parametri di configurazione necessari a puntare al contratto, alla rete o al middleware corretti.

## File principali

| File | Contenuto |
| --- | --- |
| `data/performance-anvil.csv` | Baseline locale su Anvil. |
| `data/performance-sepolia.csv` | Baseline su Sepolia. |
| `data/performance-baseline-anvil-vs-sepolia.csv` | Dataset combinato per confronto Anvil/Sepolia. |
| `data/performance-storage-modes.csv` | Confronto tra modalita' `full-storage`, `latest-storage` e `hash-uri-storage` su Sepolia. |
| `data/performance-batch-vs-single.csv` | Confronto tra invio singolo e batch, ricostruito dai log ESP32/middleware e dai receipt Sepolia. |
| `results/performance_measurements.csv` | File predisposto per raccolte successive con schema comune. |
| `results/performance_measurements.backup.csv` | Esempio/backup di raccolta con schema comune. |
| `raw/` | Receipt e transazioni JSON usati per ricostruire alcune metriche. |
| `logs/batch-vs-single/` | Log ESP32 e middleware relativi al confronto tra invio singolo e batch. |
| `scripts/` | Script di normalizzazione, ricostruzione dati e plotting. |
| `schema.md` | Descrizione dello schema CSV comune. |

## Schema dati

Tutti i CSV di performance usano lo schema documentato in [`schema.md`](schema.md).

Le colonne piu' importanti per l'analisi quantitativa sono:

- `gasUsed`
- `effectiveGasPriceWei`
- `feeWei`
- `feeEth`
- `calldataBytes`
- `logsCount`
- `txType`
- `isInitializationTx`

Le colonne relative alle latenze e alle dimensioni HTTP possono essere vuote in alcuni esperimenti quando il dato non e' stato raccolto dal middleware o non e' ricostruibile dai receipt on-chain.

## Transazioni ordinarie e inizializzazione

Nei confronti principali bisogna distinguere tra:

- transazioni ordinarie di registrazione misura;
- transazioni che includono un costo iniziale dello scenario.

Nei CSV attuali la prima registrazione di misura di ogni scenario e' marcata come:

```csv
txType=storageInitialization,isInitializationTx=true
```

Queste righe sono comunque chiamate a `recordSignedMeasurement`, ma includono il costo iniziale di scrittura su storage vuoto. Le transazioni successive dello stesso scenario sono marcate come:

```csv
txType=recordSingle,isInitializationTx=false
```

Nei confronti quantitativi principali sono escluse le righe con `isInitializationTx=true`. Queste transazioni sono conservate nei CSV per documentare il costo iniziale dello scenario, ma non rappresentano il costo ordinario a regime di registrazione di una misura.

## Ripetizioni disponibili

I dataset attuali contengono:

- 10 transazioni baseline su Anvil;
- 10 transazioni baseline su Sepolia;
- 10 transazioni per ciascuna modalita' di storage su Sepolia;
- 7 transazioni single e 3 transazioni batch nel confronto batch-vs-single.

Dopo l'esclusione delle righe `storageInitialization`, restano 9 transazioni ordinarie per ogni scenario principale gia' normalizzato.

## Workflow riproducibile

La pipeline sperimentale e' divisa in due fasi:

1. costruzione o ricostruzione dei CSV normalizzati;
2. generazione di grafici e riepiloghi a partire dai CSV.

Questa separazione evita di mescolare la raccolta dei dati con l'analisi. Gli script che costruiscono CSV possono leggere log, receipt o RPC; lo script di plotting invece lavora solo su CSV gia' normalizzati.

### 1. Raccolta txHash, log e raw data

Durante l'esecuzione degli esperimenti bisogna conservare almeno:

- hash delle transazioni inviate;
- receipt delle transazioni, se gia' disponibili;
- dettagli delle transazioni, per calcolare la dimensione della calldata;
- eventuali log ESP32/middleware, se servono metriche applicative o timestamp del dispositivo.

Per gli esperimenti gia' presenti nella repository:

- i dati baseline e storage modes sono conservati nei CSV e in `experiments/raw/`;
- il confronto batch-vs-single parte dai log in `experiments/logs/batch-vs-single/` e ricostruisce i dati on-chain via RPC Sepolia.

### 2. Ricostruzione metriche on-chain

Le metriche on-chain minime sono:

- `gasUsed`, dalla transaction receipt;
- `effectiveGasPriceWei`, dalla transaction receipt;
- `feeWei = gasUsed * effectiveGasPriceWei`;
- `feeEth`, conversione di `feeWei`;
- `calldataBytes`, dalla lunghezza del campo `input` della transazione;
- `logsCount`, dal numero di log nella receipt.

Quando sono disponibili timestamp del dispositivo e timestamp del blocco, viene calcolata anche:

```text
deviceToBlockLatencySeconds = blockTimestamp - deviceTimestamp
```

Questa metrica misura il tempo tra produzione firmata della misura e inclusione in un blocco. Non va confusa con `txSubmitLatencyMs`, `confirmationLatencyMs` o `middlewareTotalLatencyMs`, che richiedono timestamp espliciti lato middleware.

### 3. Normalizzazione CSV

Tutti i risultati quantitativi devono finire in un CSV con lo schema comune documentato in [`schema.md`](schema.md).

Regola metodologica principale:

```text
nei grafici principali vengono escluse le righe con isInitializationTx=true
```

Nel dataset attuale queste righe rappresentano la prima scrittura dello scenario su storage vuoto.

### 4. Script disponibili

| Fase | Script | Input | Output | Usa rete |
| --- | --- | --- | --- | --- |
| Ricostruzione storage modes | `experiments/scripts/build-storage-modes-csv.zsh` | `experiments/raw/storage-modes/` | `experiments/data/performance-storage-modes.csv` | No |
| Ricostruzione batch-vs-single | `experiments/scripts/build-batch-vs-single-csv.py` | `experiments/logs/batch-vs-single/`, `middleware/.env.sepolia` | `experiments/data/performance-batch-vs-single.csv`, `experiments/raw/batch-vs-single/sepolia/` | Si |
| Grafici e riepilogo | `experiments/scripts/plot-experiments.py` | CSV normalizzati in `experiments/data/` | `experiments/plots/`, `experiments/results/summary.md` | No |

Per rigenerare il CSV storage modes:

```bash
experiments/scripts/build-storage-modes-csv.zsh
```

Per rigenerare il CSV batch-vs-single dai log e dai dati on-chain Sepolia:

```bash
python3 experiments/scripts/build-batch-vs-single-csv.py
```

Questo script legge gli hash dai log, recupera receipt, transazioni e timestamp dei blocchi tramite l'RPC Sepolia configurato in `middleware/.env.sepolia`, salva i JSON raw in `experiments/raw/batch-vs-single/sepolia/` e aggiorna `experiments/data/performance-batch-vs-single.csv`.

Nel dataset batch-vs-single la latenza disponibile e' `deviceToBlockLatencySeconds`. Per le transazioni batch viene usato il timestamp dell'ultima misura inclusa nel batch, quando disponibile nei log ESP32.

### 5. Generazione grafici e summary

Una volta disponibili i CSV normalizzati, i grafici e il riepilogo si rigenerano con:

```bash
python3 experiments/scripts/plot-experiments.py
```

Lo script:

- legge i CSV principali gia' normalizzati;
- converte le colonne numeriche necessarie;
- esclude dai grafici principali le righe `isInitializationTx=true`;
- genera PNG in `experiments/plots/`;
- aggiorna `experiments/results/summary.md`.

## Grafici

I grafici della parte sperimentale sono generati dallo script:

```text
experiments/scripts/plot-experiments.py
```

Come indicato nel workflow, lo script legge i CSV normalizzati, esclude dai grafici principali le righe con `isInitializationTx=true` e salva i PNG in:

```text
experiments/plots/
```

Con i dati attualmente presenti vengono prodotti:

- `gas-used-by-network.png`
- `fee-eth-by-network.png`
- `gas-used-by-storage-mode.png`
- `fee-eth-by-storage-mode.png`
- `calldata-by-storage-mode.png`
- `gas-per-measurement-batch-vs-single.png`
- `fee-per-measurement-batch-vs-single.png`
- `device-to-block-latency-batch-vs-single.png`

Lo script genera inoltre il riepilogo:

```text
experiments/results/summary.md
```

Il grafico `latency-by-network.png` viene prodotto solo se sono disponibili dati di latenza sufficienti per confrontare almeno due reti. I grafici batch-vs-single vengono prodotti solo se esiste un CSV normalizzato con lo schema comune.

## Ruolo della firma ESP32

Nel sistema sperimentale il middleware non e' considerato la fonte fidata della misura. Il dispositivo ESP32 produce il dato, costruisce il payload, calcola l'hash e firma la misura con ECDSA secp256k1.

Il middleware valida il payload e invia la transazione, ma la verifica definitiva avviene nello smart contract: il contratto controlla che il dispositivo sia registrato, che il nonce sia valido e che la firma corrisponda all'address del dispositivo.

Questo flusso permette di valutare non solo il costo on-chain della registrazione, ma anche la fattibilita' prototipale dell'architettura:

```text
ESP32 -> middleware -> smart contract
```

## Limiti sperimentali

Gli esperimenti hanno valore tecnico-comparativo, non statistico assoluto.

Limiti principali:

- il numero di ripetizioni e' limitato, specialmente su Sepolia per contenere il consumo di SepoliaETH;
- non viene misurato il throughput massimo della blockchain;
- non viene valutata la scalabilita' con molti dispositivi fisici concorrenti;
- non viene misurato il consumo energetico reale dell'ESP32;
- non viene valutata in modo metrologico l'accuratezza del sensore LM35DZ;
- non viene analizzata la sicurezza hardware della chiave privata salvata sul microcontrollore;
- non viene misurata l'affidabilita' su lungo periodo;
- le latenze applicative sono disponibili solo dove raccolte esplicitamente dal middleware o dai log.

Aspetti coperti dagli esperimenti:

- correttezza del flusso firmato ESP32 -> middleware -> smart contract;
- costo gas delle operazioni principali;
- costo per misurazione a regime;
- differenza tra prima scrittura e scritture successive;
- confronto tra strategie di storage;
- confronto tra invio singolo e batch;
- confronto tra ambiente locale Anvil e testnet Sepolia;
- fattibilita' prototipale dell'architettura.

Frase riutilizzabile nella tesi:

```text
Per contenere il consumo di SepoliaETH, ogni scenario e' stato ripetuto un numero limitato di volte. I risultati non hanno valore statistico assoluto, ma permettono un confronto tecnico tra le alternative implementate.
```

## Passi successivi

Per completare ulteriormente la parte sperimentale si potrebbe ampliare il numero di ripetizioni batch-vs-single, specialmente per lo scenario batch.
