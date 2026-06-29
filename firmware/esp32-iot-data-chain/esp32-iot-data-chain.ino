// invio misura ogni 20 secondi al server Node.js

#include <HTTPClient.h>
#include <WiFi.h>
#include <string.h>
#include <time.h>  // funzioni per gestire l'orologio dell'ESP32 dopo sincronizzazione NTP

// librerie per creare hash e firmare la misura
extern "C" {
#include "sha3.h"
}
#include "secrets.h"
#include "uECC.h"

const char* NTP_SERVER_1 = "pool.ntp.org";
const char* NTP_SERVER_2 = "time.nist.gov";
const long GMT_OFFSET_SEC = 0;  // non ci interessa avere ora locale italiana
const int DAYLIGHT_OFFSET_SEC = 0;

const int LIGHT_SENSOR_PIN = 34;

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
const unsigned long SEND_INTERVAL_MS = 20000;  // 20 secondi

unsigned long lastSendTime = 0;

// evita che misurazione valida con firma valida venga inviata più volte:
// il contratto salverà ultimo nonce accettato e rifiuterà quelli vecchi
uint64_t measurementNonce = 0;

// memorizza l'esito della sincronizzazione NTP
bool timeSynchronized = false;

// memorizza esito sincronizzazione nonce
bool nonceSynchronized = false;

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

  nonceSynchronized = synchronizeNonceFromServer();  // chiedo nonce

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

    if (!nonceSynchronized) {
      nonceSynchronized = synchronizeNonceFromServer();

      if (!nonceSynchronized) {
        Serial.println("Nonce non sincronizzato. Salto invio misura.");
        return;
      }
    }

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
  int lightValue = analogRead(LIGHT_SENSOR_PIN);

  Serial.print("Luminosita letta: ");
  Serial.println(lightValue);

  return lightValue;
}

bool synchronizeNonceFromServer() {
  HTTPClient http;

  Serial.println("Sincronizzazione nonce dal middleware...");
  Serial.println(NONCE_URL);

  if (!http.begin(NONCE_URL)) {
    Serial.println("Errore inizializzazione HTTP per nonce.");
    return false;
  }

  http.addHeader("X-API-Key", DEVICE_API_KEY);

  int statusCode = http.GET();

  Serial.print("HTTP nonce status code: ");
  Serial.println(statusCode);

  if (statusCode != 200) {
    String response = http.getString();

    Serial.print("Errore sincronizzazione nonce: ");
    Serial.println(response);

    http.end();
    return false;
  }

  String response = http.getString();

  Serial.print("Risposta nonce: ");
  Serial.println(response);

  uint64_t nextNonce = 0;

  if (!extractUint64JsonField(response, "nextNonce", nextNonce)) {
    Serial.println("Errore parsing nextNonce");
    http.end();
    return false;
  }

  if (nextNonce == 0) {
    Serial.println("nextNonce non valido");
    http.end();
    return false;
  }

  measurementNonce = nextNonce - 1;

  Serial.print("Nonce sincronizzato. Ultimo nonce noto: ");
  Serial.println(String(measurementNonce));

  http.end();
  return true;
}

bool extractUint64JsonField(const String& json, const char* fieldName,
                            uint64_t& value) {
  String marker = "\"";
  marker += fieldName;
  marker += "\":\"";

  int start = json.indexOf(marker);

  if (start < 0) {
    return false;
  }

  start += marker.length();

  int end = json.indexOf("\"", start);

  if (end < 0) {
    return false;
  }

  String numberText = json.substring(start, end);

  if (numberText.length() == 0) {
    return false;
  }

  uint64_t parsedValue = 0;

  for (int i = 0; i < numberText.length(); i++) {
    char c = numberText.charAt(i);

    if (c < '0' || c > '9') {
      return false;
    }

    parsedValue = parsedValue * 10 + (uint64_t)(c - '0');
  }

  value = parsedValue;
  return true;
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
