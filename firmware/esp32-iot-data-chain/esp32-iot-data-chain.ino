// invio misura ogni 10 secondi al server Node.js

#include <HTTPClient.h>
#include <WiFi.h>
#include <time.h>  // funzioni per gestire l'orologio dell'ESP32 dop sincronizzazone NTP

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

// id della chain, seve anche questo per firmare messaggio
const uint64_t CHAIN_ID = 31337;  // se usiamo anvil

// Token semplice per evitare che chiunque mandi dati al server, eventualmente
// intasandolo. Per demo va bene, non è sicurezza "forte", è un filtro leggero
const char* DEVICE_API_KEY = "dev-secret-esp32-1";

const size_t PACKED_BUFFER_SIZE = 168;

// Ogni quanto inviare misura
const unsigned long SEND_INTERVAL_MS = 10000;  // 10 secondi

unsigned long lastSendTime = 0;

// evita che misurazione valida con firma valida venga inviata più volte:
// contratto salverà ultimo nonce accettato e rifiuta quelli vecchi
uint64_t measurementNonce = 0;

// mmemorizza l'esito della sincronizzazione NTP
bool timeSynchronized = false;
// =======================
// SETUP
// =======================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("Avvio ESP32 IoT Data Chain...");

  connectToWiFi();  // connetto al wifi

  timeSynchronized = synchronizeTime();  // chiedo l'orario

  randomSeed(analogRead(34));  // rendo casuale la simulazione della misura

  Serial.println("Test buffer packed Solidity");

  uint8_t packedBuffer[PACKED_BUFFER_SIZE];

  bool ok = buildPackedMeasurementBuffer(packedBuffer, 25, 1700000000ULL, 1);

  if (!ok) {
    Serial.println("Errore costruzione packed buffer");
  } else {
    Serial.print("Packed length: ");
    Serial.println(PACKED_BUFFER_SIZE);

    Serial.print("Packed hex: 0x");
    printHex(packedBuffer, PACKED_BUFFER_SIZE);
  }
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

    // ogni volta che esp32 invia una misura, aumenta il numero progressivo
    measurementNonce++;  // così incremento anche se invio fallisce
    // sendMeasurement(measurementValue, measurementNonce);
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
  // Versione demo: genera valori casuali tra 20 e 30 compresi
  // Esempio: temperatura simulata in gradi Celsius
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
  body += "\"value\":";
  body += String(value);
  body += ",";
  body += "\"deviceTimestamp\":";
  body += String(deviceTimestamp);
  body += ",";
  body += "\"nonce\":";
  body += String(nonce);
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

// converto Address esadecimale in binario
bool appendAddress(uint8_t* buffer, size_t& offset, const char* address) {
  if (strlen(address) != 42) {
    return false;
  }

  if (address[0] != '0' || (address[1] != 'x' && address[1] != 'X')) {
    return false;
  }

  for (int i = 0; i < 20; i++) {  // un giro di ciclo per ogni byte dell'address
    int high = hexValue(address[2 + i * 2]);
    int low = hexValue(address[3 + i * 2]);

    if (high < 0 || low < 0) {  // verifico che siano cifre esadecimali valide
      return false;
    }

    buffer[offset] =
        (uint8_t)((high << 4) |
                  low);  // "5b" -> 0x5b -> 91, ovvero sposta di 4 bit la cifra
                         // high e fai OR bit a bit con la cifra low
    offset++;  // in ogni posizione del buffer salvo unvalore a 8 bit (1 byte),
               // che deriva da una coppia di cifre esadecimali
  }

  return true;
}

// converto i numeri uint64_t in 32 byte, compatibili quindi con gli uint256
// di Solidity
void appendUint256(uint8_t* buffer, size_t& offset, uint64_t value) {
  // metto 32 byte a zero (inizializzo il buffer)
  for (int i = 0; i < 32; i++) {
    buffer[offset + i] = 0;
  }

  // Scrivo il valore negli ultimi 8 byte, in big-endian
  for (int i = 31; i >= 24; i--) {
    buffer[offset + i] = value & 0xff;
    value >>= 8;
  }

  offset += 32;
}

void appendInt256(uint8_t* buffer, size_t& offset, int64_t value) {
  // se il numero è negativo, Solidity usa complemento a due:
  // i byte iniziali deono essere 0xff.
  // se è positivo, i byte iniziali sono 0x00

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

// stampo il buffer in esadecimale leggibile
void printHex(const uint8_t* buffer, size_t length) {
  const char* hex = "0123456789abcdef";

  for (size_t i = 0; i < length; i++) {
    Serial.print(hex[buffer[i] >> 4]);
    Serial.print(hex[buffer[i] & 0x0f]);
  }

  Serial.println();
}
