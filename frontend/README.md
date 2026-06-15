# Frontend Web3

Questa cartella contiene il frontend della web app usata per interagire con lo smart contract del progetto IoT-Blockchain.

Il frontend permette all’utente di:

- collegare MetaMask;
- registrare un dispositivo IoT sulla blockchain;
- cercare un dispositivo tramite il suo address;
- leggere i dati associati al dispositivo;
- leggere l’ultima misurazione registrata.

## Obiettivo

Il frontend rappresenta il lato client dell’applicazione.

Il suo compito è fornire un’interfaccia semplice per interrogare la blockchain e visualizzare i dati salvati dallo smart contract.

Nel progetto attuale, il dispositivo IoT viene identificato tramite un address Ethereum.  
A partire da questo address, la web app può leggere:

- se il dispositivo è registrato;
- il metadata URI associato;
- il timestamp di registrazione;
- l’ultima misurazione disponibile.

## Tecnologie utilizzate

- HTML
- CSS
- JavaScript vanilla
- ethers.js v6
- MetaMask
- Smart contract Solidity eseguito su rete locale Anvil

## Struttura generale

Il frontend comunica con lo smart contract tramite ethers.js.

MetaMask viene usato come provider Web3 all’interno del browser.  
Quando l’utente collega il wallet, la pagina ottiene un signer e crea un’istanza del contratto.

Flusso semplificato:

```text
Browser
  ↓
MetaMask
  ↓
ethers.js
  ↓
Smart Contract
  ↓
Blockchain locale Anvil