# Firmware ESP32

## Obiettivo

Questo firmware rappresenta la componente IoT del progetto.  
L'ESP32 raccoglie periodicamente una misurazione reale di temperatura da un sensore LM35DZ, costruisce il messaggio da firmare, genera una firma ECDSA secp256k1 e invia il payload firmato a un server Node.js tramite richiesta HTTP POST.

## Architettura

ESP32 + LM35DZ → server Node.js → smart contract → frontend web3

L'ESP32 non comunica direttamente con la blockchain.  
La chiamata allo smart contract viene gestita dal server Node.js, che agisce da relayer e paga il gas della transazione.

La private key del dispositivo è invece presente nel firmware del prototipo perché serve a firmare le misure. Per una tesi triennale e una demo controllata è una scelta ragionevole; in un sistema reale andrebbe protetta con meccanismi hardware più robusti.

## File principale

Il codice principale si trova in:

firmware/esp32-iot-data-chain/esp32-iot-data-chain.ino

## Librerie utilizzate

- WiFi.h
- HTTPClient.h
- time.h
- sha3
- micro-ecc / uECC

## Sensore LM35DZ

Il firmware legge il sensore LM35DZ dal pin analogico configurato in `TEMPERATURE_SENSOR_PIN`.

La lettura attuale:

- usa risoluzione ADC a 12 bit;
- imposta l'attenuazione del pin a `ADC_0db`;
- esegue 20 letture con `analogReadMilliVolts(...)`;
- calcola la media dei millivolt letti;
- converte la tensione in gradi Celsius usando la relazione del sensore LM35DZ, cioè 10 mV per 1 °C;
- arrotonda la temperatura a intero prima di inserirla nel payload firmato.

## Configurazione

Nel firmware devono essere configurati:

- SSID della rete WiFi
- password della rete WiFi
- URL del server Node.js
- URL per sincronizzare il nonce dal middleware
- address Ethereum del dispositivo
- address dello smart contract
- chain id della rete usata
- private key del dispositivo
- API key del dispositivo

Esempio:

const char* SERVER_URL = "http://192.168.1.50:3000/api/measurements";
const char* NONCE_URL = "http://192.168.1.50:3000/api/devices/0xDEVICE_ADDRESS/nonce";

Nota: se il server Node.js gira sul Mac, non bisogna usare localhost, ma l'indirizzo IP locale del Mac.

Dopo un deploy tramite `make deploy-anvil` o `make deploy-sepolia`, lo script di deploy aggiorna automaticamente in `secrets.h` solo i valori pubblici/operativi:

- `CONTRACT_ADDRESS`
- `CHAIN_ID`
- `NONCE_URL`

Le variabili sensibili, come password WiFi, API key e private key del dispositivo, restano da configurare manualmente.

## Compilazione

La compilazione è stata verificata tramite Arduino CLI:

```bash
arduino-cli compile \
  --fqbn esp32:esp32:esp32 \
  firmware/esp32-iot-data-chain
```

Output ottenuto:

```text
Sketch uses 1038679 bytes (79%) of program storage space.
Global variables use 48584 bytes (14%) of dynamic memory.
```

Dal Makefile della root si possono usare comandi più brevi:

```bash
make firmware-compile
make firmware-upload PORT=/dev/cu.usbserial-0001
make firmware-monitor PORT=/dev/cu.usbserial-0001
make firmware-flash-monitor PORT=/dev/cu.usbserial-0001
```

`firmware-flash-monitor` esegue upload e monitor seriale in sequenza. Se la board usa una porta diversa, sostituire il valore di `PORT`.

## Stato attuale

Il firmware compila correttamente per ESP32 ed è stato verificato nel flusso reale con board fisica, rete WiFi, middleware, smart contract e rete Sepolia.

Il firmware attuale:

- si connette al WiFi;
- sincronizza l'orario tramite NTP quando disponibile;
- legge la temperatura reale dal sensore LM35DZ;
- calcola la media delle letture in millivolt, converte in °C e arrotonda a intero;
- sincronizza il nonce dal middleware;
- costruisce il buffer binario compatibile con `abi.encodePacked(...)`;
- calcola il `dataHash` con Keccak-256;
- firma l'hash con ECDSA secp256k1;
- invia al middleware `deviceAddress`, `value`, `deviceTimestamp`, `nonce` e `signature`.

## Verifiche eseguite

- upload sulla board fisica;
- connessione WiFi reale;
- comunicazione seriale;
- lettura del sensore LM35DZ;
- invio effettivo della richiesta HTTP al server Node.js;
- registrazione end-to-end della misura firmata prodotta dalla board;
- pubblicazione delle misure su smart contract in rete Sepolia.
