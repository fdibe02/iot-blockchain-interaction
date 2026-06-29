#pragma once

// clang-format off
const char* WIFI_SSID = "INSERISCI_WIFI";
const char* WIFI_PASSWORD = "INSERISCI_PASSWORD";

const char* DEVICE_PRIVATE_KEY = "0x...";
const char* DEVICE_API_KEY = "dev-secret-esp32-1"; // Token semplice per evitare che chiunque mandi dati al server, eventualmente
                                                // intasandolo. Per demo va bene, non è sicurezza "forte", è un filtro leggero

const char* CONTRACT_ADDRESS = "...";
const char* DEVICE_ADDRESS = "...";
const uint64_t CHAIN_ID = 11155111; // id della chain: viene incluso nel payload per evitare firme valide su chain diverse
                                    // qui messo Sepolia come placeholder
const char* SERVER_URL = "http://IP_MAC:3000/api/measurements";
const char* NONCE_URL = "http://IP_MAC:3000/api/devices/DEVICE_ADDRESS/nonce";