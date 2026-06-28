// invio misura ogni 10 secondi al server Node.js

#include <HTTPClient.h>
#include <WiFi.h>
#include <string.h>
#include <time.h>  // funzioni per gestire l'orologio dell'ESP32 dopo sincronizzazione NTP

// librerie per creare hash e firmare la misura
extern "C" {
#include "sha3.h"
}
#include "uECC.h"

// =======================
// CONFIGURAZIONE WIFI
// =======================

const char* WIFI_SSID = "iPhoneFranci";
const char* WIFI_PASSWORD = "cicciodb";

const char* NTP_SERVER_1 = "pool.ntp.org";
const char* NTP_SERVER_2 = "time.nist.gov";
const long GMT_OFFSET_SEC = 0;  // non ci interessa avere ora locale italiana
const int DAYLIGHT_OFFSET_SEC = 0;

// usa IP locale del Mac, tipo: http://192.168.1.50:3000/api/measurements
const char* SERVER_URL = "http://172.20.10.4:3000/api/measurements";

const char* CONTRACT_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

// indirizzo pubblico derivato dalla chiave privata che userà il dispositivo per
// firmare
const char* DEVICE_ADDRESS = "0xc2E770A8460ac16C83285225FBB175EFf65Ab186";

// ATTENZIONE: per demo va bene, ma non committare mai una private key reale.
// Meglio spostarla poi in un secrets.h ignorato da Git.
const char* DEVICE_PRIVATE_KEY = "0xINSERISCI_PRIVATE_KEY_DEL_DEVICE";

// id della chain: viene incluso nel payload per evitare firme valide su chain
// diverse
const uint64_t CHAIN_ID = 31337;  // Anvil

// Token semplice per evitare che chiunque mandi dati al server, eventualmente
// intasandolo. Per demo va bene, non è sicurezza "forte", è un filtro leggero
const char* DEVICE_API_KEY = "dev-secret-esp32-1";

const size_t PACKED_BUFFER_SIZE = 168;

const size_t HASH_SIZE = 32;
const size_t SIGNATURE_RS_SIZE = 64;
const size_t HEX_PREFIX_SIZE = 2;
const size_t NULL_TERMINATOR_SIZE = 1;

const size_t HASH_HEX_STRING_SIZE =
    HEX_PREFIX_SIZE + HASH_SIZE * 2 + NULL_TERMINATOR_SIZE;

const size_t SIGNATURE_RS_HEX_STRING_SIZE =
    HEX_PREFIX_SIZE + SIGNATURE_RS_SIZE * 2 + NULL_TERMINATOR_SIZE;

// Ogni quanto inviare misura
const unsigned long SEND_INTERVAL_MS = 10000;  // 10 secondi

unsigned long lastSendTime = 0;

// evita che misurazione valida con firma valida venga inviata più volte:
// il contratto salverà ultimo nonce accettato e rifiuterà quelli vecchi
uint64_t measurementNonce = 0;

// memorizza l'esito della sincronizzazione NTP
bool timeSynchronized = false;

// =======================
// SETUP
// =======================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("Avvio ESP32 IoT Data Chain...");

  uECC_set_rng(fillRandomBytes);

  connectToWiFi();  // connetto al WiFi

  timeSynchronized = synchronizeTime();  // chiedo l'orario

  randomSeed(analogRead(34));  // rendo casuale la simulazione della misura
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnesso. Riprovo la connessione...");
    connectToWiFi();

    if (!timeSynchronized) {
      timeSynchronized = synchronizeTime();
    }
  }

  unsigned long currentTime = millis();  // tempo da quando la scheda è connessa

  if (currentTime - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = currentTime;

    int measurementValue = readMeasurement();

    Serial.println("Misura letta: ");
    Serial.println(measurementValue);

    // Ogni volta che ESP32 invia una misura, aumenta il numero progressivo.
    measurementNonce++;
    sendMeasurement(measurementValue, measurementNonce);
  }
}

// =======================
// CONNESSIONE WIFI
// =======================

void connectToWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.println("Connessione a WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connesso!");
  Serial.println("IP ESP32: ");
  Serial.println(WiFi.localIP());
}

// =======================
// SINCRONIZZAZIONE ORARIO
// =======================

bool synchronizeTime() {
  Serial.println("Sincronizzazione ora via NTP...");

  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2);

  struct tm timeinfo;

  if (!getLocalTime(&timeinfo)) {
    Serial.println("Errore: NTP non sincronizzato.");
    return false;
  }

  Serial.println("Ora sincronizzata tramite NTP.");
  return true;
}

// =======================
// LOGICA TIMESTAMP
// =======================

// Torna un timestamp Unix reale se NTP è disponibile.
// Se NTP non è disponibile, usa millis() / 1000 solo come fallback demo.
uint64_t getDeviceTimestamp() {
  if (!timeSynchronized) {
    Serial.println("Ora non sincronizzata, uso millis() come fallback demo.");
    return millis() / 1000;
  }

  return (uint64_t)time(nullptr);
}

// =======================
// LETTURA MISURAZIONE
// =======================

int readMeasurement() {
  // Versione demo: genera valori casuali tra 20 e 30 compresi.
  // Esempio: temperatura simulata in gradi Celsius.
  int simulatedValue = random(20, 31);

  return simulatedValue;
}

// =======================
// INVIO AL SERVER NODE.JS
// =======================

void sendMeasurement(int value, uint64_t nonce) {
  HTTPClient http;

  Serial.println("Invio POST a: ");
  Serial.println(SERVER_URL);

  uint64_t deviceTimestamp = getDeviceTimestamp();

  uint8_t packedBuffer[PACKED_BUFFER_SIZE];

  if (!buildPackedMeasurementBuffer(packedBuffer, value, deviceTimestamp,
                                    nonce)) {
    Serial.println("Errore costruzione packed buffer");
    return;
  }

  uint8_t dataHash[HASH_SIZE];

  if (!keccak256Buffer(packedBuffer, PACKED_BUFFER_SIZE, dataHash)) {
    Serial.println("Errore calcolo Keccak-256 del packed buffer");
    return;
  }

  char dataHashHex[HASH_HEX_STRING_SIZE];
  bytesToHexString(dataHash, HASH_SIZE, dataHashHex);

  Serial.print("Data hash: ");
  Serial.println(dataHashHex);

  uint8_t signatureRs[SIGNATURE_RS_SIZE];

  if (!signDataHash(dataHash, signatureRs)) {
    Serial.println("Errore firma dataHash");
    return;
  }

  char signatureHex[SIGNATURE_RS_HEX_STRING_SIZE];
  bytesToHexString(signatureRs, SIGNATURE_RS_SIZE, signatureHex);

  Serial.print("Signature r||s: ");
  Serial.println(signatureHex);

  if (!http.begin(SERVER_URL)) {
    Serial.println("Errore inizializzazione HTTP.");
    return;
  }

  // costruisco Header della POST
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Address", DEVICE_ADDRESS);
  http.addHeader("X-API-Key", DEVICE_API_KEY);

  // costruisco il body della POST
  String body = "{";
  body += "\"deviceAddress\":\"";
  body += DEVICE_ADDRESS;
  body += "\",";
  body += "\"value\":\"";
  body += String(value);
  body += "\",";
  body += "\"deviceTimestamp\":\"";
  body += String(deviceTimestamp);
  body += "\",";
  body += "\"nonce\":\"";
  body += String(nonce);
  body += "\",";
  body += "\"signature\":\"";
  body += signatureHex;
  body += "\"";
  body += "}";

  Serial.print("Body JSON: ");
  Serial.println(body);

  // invio la POST
  int statusCode = http.POST(body);

  Serial.print("HTTP status code: ");
  Serial.println(statusCode);

  if (statusCode > 0) {
    String response = http.getString();

    Serial.print("Risposta server: ");
    Serial.println(response);
  } else {
    Serial.print("Errore HTTP: ");
    Serial.println(http.errorToString(statusCode));
  }

  http.end();  // chiude la connessione
}

// =======================
// FUNZIONI PER CODIFICA PAYLOAD COMPATIBILE CON abi.encodePacked DI SOLIDITY
// =======================

int hexValue(char c) {
  if (c >= '0' && c <= '9') {
    return c - '0';
  }

  if (c >= 'a' && c <= 'f') {
    return c - 'a' + 10;
  }

  if (c >= 'A' && c <= 'F') {
    return c - 'A' + 10;
  }

  return -1;
}

// converto address esadecimale in binario
bool appendAddress(uint8_t* buffer, size_t& offset, const char* address) {
  if (strlen(address) != 42) {
    return false;
  }

  if (address[0] != '0' || (address[1] != 'x' && address[1] != 'X')) {
    return false;
  }

  for (int i = 0; i < 20; i++) {
    int high = hexValue(address[2 + i * 2]);
    int low = hexValue(address[3 + i * 2]);

    if (high < 0 || low < 0) {
      return false;
    }

    // Due caratteri hex, ad esempio "5b", diventano un byte: 0x5b.
    buffer[offset] = (uint8_t)((high << 4) | low);
    offset++;
  }

  return true;
}

// converto un uint64_t in 32 byte compatibili con uint256 Solidity
void appendUint256(uint8_t* buffer, size_t& offset, uint64_t value) {
  // metto 32 byte a zero
  for (int i = 0; i < 32; i++) {
    buffer[offset + i] = 0;
  }

  // scrivo il valore negli ultimi 8 byte, in big-endian
  for (int i = 31; i >= 24; i--) {
    buffer[offset + i] = value & 0xff;
    value >>= 8;
  }

  offset += 32;
}

// converto un int64_t in 32 byte compatibili con int256 Solidity
void appendInt256(uint8_t* buffer, size_t& offset, int64_t value) {
  // Se il numero è negativo, Solidity usa complemento a due:
  // i byte iniziali devono essere 0xff.
  // Se è positivo, i byte iniziali sono 0x00.
  uint8_t fillByte = value < 0 ? 0xff : 0x00;

  for (int i = 0; i < 32; i++) {
    buffer[offset + i] = fillByte;
  }

  uint64_t encodedValue = (uint64_t)value;

  for (int i = 31; i >= 24; i--) {
    buffer[offset + i] = encodedValue & 0xff;
    encodedValue >>= 8;
  }

  offset += 32;
}

bool buildPackedMeasurementBuffer(uint8_t* buffer, int64_t value,
                                  uint64_t deviceTimestamp, uint64_t nonce) {
  size_t offset = 0;

  if (!appendAddress(buffer, offset, CONTRACT_ADDRESS)) {
    Serial.println("CONTRACT_ADDRESS non valido");
    return false;
  }

  appendUint256(buffer, offset, CHAIN_ID);

  if (!appendAddress(buffer, offset, DEVICE_ADDRESS)) {
    Serial.println("DEVICE_ADDRESS non valido");
    return false;
  }

  appendInt256(buffer, offset, value);
  appendUint256(buffer, offset, deviceTimestamp);
  appendUint256(buffer, offset, nonce);

  return offset == PACKED_BUFFER_SIZE;
}

// =======================
// FUNZIONI CRYPTO: KECCAK-256 + FIRMA ECDSA SECP256K1
// =======================

int fillRandomBytes(uint8_t* dest, unsigned size) {
  for (unsigned i = 0; i < size; i++) {
    dest[i] = (uint8_t)(esp_random() & 0xff);
  }

  return 1;
}

bool keccak256Buffer(const uint8_t* input, size_t inputLength,
                     uint8_t* outputHash) {
  sha3_return_t result = sha3_HashBuffer(256, SHA3_FLAGS_KECCAK, input,
                                         inputLength, outputHash, HASH_SIZE);

  return result == SHA3_RETURN_OK;
}

bool hexStringToBytes(const char* hexString, uint8_t* output,
                      size_t expectedBytes) {
  size_t expectedLength = 2 + expectedBytes * 2;

  if (strlen(hexString) != expectedLength) {
    return false;
  }

  if (hexString[0] != '0' || (hexString[1] != 'x' && hexString[1] != 'X')) {
    return false;
  }

  for (size_t i = 0; i < expectedBytes; i++) {
    int high = hexValue(hexString[2 + i * 2]);
    int low = hexValue(hexString[3 + i * 2]);

    if (high < 0 || low < 0) {
      return false;
    }

    output[i] = (uint8_t)((high << 4) | low);
  }

  return true;
}

void bytesToHexString(const uint8_t* input, size_t inputLength, char* output) {
  const char* hex = "0123456789abcdef";

  output[0] = '0';
  output[1] = 'x';

  for (size_t i = 0; i < inputLength; i++) {
    output[2 + i * 2] = hex[input[i] >> 4];
    output[3 + i * 2] = hex[input[i] & 0x0f];
  }

  output[2 + inputLength * 2] = '\0';
}

bool buildEthereumSignedMessageHash(const uint8_t* dataHash,
                                    uint8_t* ethSignedMessageHash) {
  const uint8_t prefix[] = {0x19, 'E', 't', 'h', 'e', 'r',  'e', 'u', 'm', ' ',
                            'S',  'i', 'g', 'n', 'e', 'd',  ' ', 'M', 'e', 's',
                            's',  'a', 'g', 'e', ':', '\n', '3', '2'};

  const size_t prefixLength = sizeof(prefix);
  uint8_t message[prefixLength + HASH_SIZE];

  memcpy(message, prefix, prefixLength);
  memcpy(message + prefixLength, dataHash, HASH_SIZE);

  return keccak256Buffer(message, prefixLength + HASH_SIZE,
                         ethSignedMessageHash);
}

bool signDataHash(const uint8_t* dataHash, uint8_t* signatureRs) {
  uint8_t privateKey[32];

  if (!hexStringToBytes(DEVICE_PRIVATE_KEY, privateKey, sizeof(privateKey))) {
    Serial.println("DEVICE_PRIVATE_KEY non valida");
    return false;
  }

  uint8_t ethSignedMessageHash[HASH_SIZE];

  if (!buildEthereumSignedMessageHash(dataHash, ethSignedMessageHash)) {
    Serial.println("Errore calcolo Ethereum Signed Message hash");
    return false;
  }

  uECC_Curve curve = uECC_secp256k1();

  int result = uECC_sign(privateKey, ethSignedMessageHash, HASH_SIZE,
                         signatureRs, curve);

  return result == 1;
}
