## Obiettivo
Realizzare un sistema ioT-blockchain in cui un ESP32 raccoglie misurazioni ambientali, le invia ad un middleware Node.js, che registra i dati su uno smart contract. Una web app permette all'utente di registrare un microcontrollore tramite Metamask e leggere l emisurazioni della blockchain

## Architettura
ESP32 -> Node.js -> Smart Contract -> Web App

## Componenti principali
Firmware ESP32: raccoglie o simula misurazioni e le invia al server tramite richiesta HTTP.
Middleware Node.js: riceve le misurazioni dal dispositivo e le registra sulla blockchain.
Smart contract: gestisce la registrazione dei dispositivi e la memorizzazione delle misurazioni.
Web app: permette all'utente di collegare MetaMask, registrare/configurare un dispositivo e leggere i dati salvati sulla blockchain.


## Parte Web3
- Metamask per registrare/configurare il dispositivo
- Lettura dati da blockchain tramite provider RPC
