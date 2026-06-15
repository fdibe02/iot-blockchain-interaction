# Firmware ESP32

## Obiettivo

Questo firmware rappresenta la componente IoT del progetto.  
L'ESP32 raccoglie periodicamente una misurazione e la invia a un server Node.js tramite richiesta HTTP POST.

## Architettura

ESP32 → server Node.js → smart contract → frontend web3

L'ESP32 non comunica direttamente con la blockchain.  
La chiamata allo smart contract viene gestita dal server Node.js, evitando di inserire chiavi private Ethereum nel firmware.

## File principale

Il codice principale si trova in:

firmware/esp32-iot-data-chain/esp32-iot-data-chain.ino

## Librerie utilizzate

- WiFi.h
- HTTPClient.h

## Configurazione

Nel firmware devono essere configurati:

- SSID della rete WiFi
- password della rete WiFi
- URL del server Node.js
- identificativo logico del dispositivo
- API key del dispositivo

Esempio:

const char* SERVER_URL = "http://192.168.1.50:3000/api/measurements";

Nota: se il server Node.js gira sul Mac, non bisogna usare localhost, ma l'indirizzo IP locale del Mac.

## Compilazione

La compilazione è stata verificata tramite Arduino CLI:

arduino-cli compile \
  --fqbn esp32:esp32:esp32 \
  firmware/esp32-iot-data-chain

Output ottenuto:

Sketch uses 1038679 bytes (79%) of program storage space.
Global variables use 48584 bytes (14%) of dynamic memory.

## Stato attuale

Il firmware compila correttamente per ESP32.

Non sono ancora stati verificati:

- upload sulla board fisica
- connessione WiFi reale
- comunicazione seriale
- invio effettivo della richiesta HTTP al server Node.js
- integrazione con sensore reale

## Prossimi passi

- Collegare l'ESP32 tramite USB
- Caricare il firmware sulla board
- Avviare il server Node.js in rete locale
- Verificare l'arrivo delle misurazioni sul backend
- Collegare eventualmente un sensore reale al posto della misura simulata