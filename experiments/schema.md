# Schema CSV degli esperimenti

I file CSV sperimentali usano uno schema comune per rendere confrontabili i risultati raccolti in scenari diversi.

Header comune:

```csv
experiment,network,storageMode,batchSize,sendIntervalSeconds,measurementIndex,txType,isInitializationTx,txHash,blockNumber,status,gasUsed,effectiveGasPriceWei,feeWei,feeEth,requestBodyBytes,calldataBytes,txSubmitLatencyMs,confirmationLatencyMs,middlewareTotalLatencyMs,deviceToBlockLatencySeconds,logsCount,notes
```

## Colonne

| Colonna | Significato | Unità / formato | Obbligatoria |
| --- | --- | --- | --- |
| `experiment` | Nome logico dell'esperimento. | Testo | Si |
| `network` | Rete blockchain usata. | `anvil`, `sepolia` | Si |
| `storageMode` | Strategia di salvataggio usata dallo smart contract. | `array`, `full-storage`, `latest-storage`, `hash-uri-storage`, `batch` | Si |
| `batchSize` | Numero di misure incluse nella transazione. | Numero intero | Si |
| `sendIntervalSeconds` | Intervallo teorico tra due invii del dispositivo. | Secondi | No |
| `measurementIndex` | Indice progressivo della transazione nello scenario. | Numero intero | Si |
| `txType` | Tipo logico della transazione. | Vedi valori ammessi | Si |
| `isInitializationTx` | Indica se la transazione va trattata come costo iniziale/setup. | `true`, `false` | Si |
| `txHash` | Hash della transazione. | Hex string `0x...` | Si per transazioni on-chain |
| `blockNumber` | Numero del blocco di inclusione. | Numero intero | Si per transazioni confermate |
| `status` | Esito della transazione. | `1` riuscita, `0` fallita | Si |
| `gasUsed` | Gas consumato dalla transazione. | Gas | Si |
| `effectiveGasPriceWei` | Gas price effettivo applicato. | Wei | Si |
| `feeWei` | Costo totale della transazione. | Wei | Si |
| `feeEth` | Costo totale della transazione. | ETH | Si |
| `requestBodyBytes` | Dimensione del body HTTP ricevuto dal middleware. | Byte | No |
| `calldataBytes` | Dimensione della calldata inviata allo smart contract. | Byte | No |
| `txSubmitLatencyMs` | Tempo di invio della transazione dal middleware al nodo/RPC. | Millisecondi | No |
| `confirmationLatencyMs` | Tempo fino alla conferma della transazione. | Millisecondi | No |
| `middlewareTotalLatencyMs` | Tempo totale lato middleware. | Millisecondi | No |
| `deviceToBlockLatencySeconds` | Tempo tra timestamp firmato dal dispositivo e timestamp del blocco di inclusione. | Secondi | No |
| `logsCount` | Numero di eventi/log emessi dalla transazione. | Numero intero | No |
| `notes` | Annotazioni manuali sul dato. | Testo | No |

## Valori ammessi

`experiment`:

- `baseline`
- `storage-modes`
- `batch-vs-single`

`network`:

- `anvil`
- `sepolia`

`storageMode`:

- `array`
- `full-storage`
- `latest-storage`
- `hash-uri-storage`
- `batch`

`txType`:

- `deploy`
- `registerDevice`
- `storageInitialization`
- `recordSingle`
- `recordBatch`
- `readOnlyCall`
- `other`

`isInitializationTx`:

- `true`: transazione di setup o prima scrittura dello scenario, da escludere dai grafici principali sul costo ordinario;
- `false`: transazione ordinaria dell'esperimento.

## Criterio per `storageInitialization`

Nei CSV attuali la prima transazione di registrazione misura per ogni scenario e' marcata come:

```csv
txType=storageInitialization,isInitializationTx=true
```

La transazione resta una chiamata a `recordSignedMeasurement`, ma include il costo iniziale di scrittura su storage vuoto. Per questo motivo e' utile conservarla nel dataset, ma separarla dai confronti principali sul costo a regime.

Le transazioni successive dello stesso scenario sono marcate come:

```csv
txType=recordSingle,isInitializationTx=false
```

Nel confronto batch-vs-single, le transazioni batch sono marcate come:

```csv
txType=recordBatch,isInitializationTx=false
```

Per queste righe `batchSize` indica il numero di misure incluse nella transazione. Le metriche per misura possono essere ricavate con `gasUsed / batchSize` e `feeEth / batchSize`.

## Criterio di inclusione nei grafici

Nei confronti quantitativi principali sono escluse le righe con:

```csv
isInitializationTx=true
```

Queste righe restano nei CSV per documentare il costo iniziale dello scenario, ma non rappresentano il costo ordinario di registrazione di una misura a regime.

## Metriche blockchain e applicative

Metriche blockchain:

- `gasUsed`
- `effectiveGasPriceWei`
- `feeWei`
- `feeEth`
- `blockNumber`
- `status`
- `confirmationLatencyMs`
- `calldataBytes`
- `logsCount`

Metriche applicative, middleware o dispositivo:

- `requestBodyBytes`
- `txSubmitLatencyMs`
- `middlewareTotalLatencyMs`
- `deviceToBlockLatencySeconds`
- `batchSize`
- `sendIntervalSeconds`
- `measurementIndex`
