## Obiettivo
Realizzare un sistema ioT-blockchain in cui un ESP32 raccoglie misurazioni ambientali, le invia ad un middleware Node.js, che registra i dati su uno smart contract. Una web app permette all'utente di registrare un microcontrollore tramite Metamask e leggere l emisurazioni della blockchain

## Architettura
ESP32 -> Node.js -> Smart Contract -> Web App

## Parte Web3
- Metamask per registrare/configurare il dispositivo
- Lettura dati da blockchain tramite provider RPC
