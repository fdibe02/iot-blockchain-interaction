// invio misura ogni 10 secondi al server Node.js

#include <HTTPClient.h>
#include <WiFi.h>
#include <time.h>  // funzioni per gestire l'orologio dell'ESP32 dop sincronizzazone NTP

// =======================
// CONFIGURAZIONE WIFI
// =======================

const char* WIFI_SSID = "NOME_WIFI";
const char* WIFI_PASSWORD = "PASSWORD_WIFI";

const char* NTP_SERVER_1 = "pool.ntp.org";
const char* NTP_SERVER_2 = "time.nist.gov";
const long GMT_OFFSET_SEC = 0;  // non ci interessa avere ora locale italiana
const int DAYLIGHT_OFFSET_SEC = 0;

// usa IP locale del Mac, tipo: http://192.168.1.50:3000/api/measurements
const char* SERVER_URL = "http://192.168.1.50:3000/api/measurements";

const char* CONTRACT_ADDRESS = "0xINSERISCI_ADDRESS_CONTRATTO";

// indirizzo pubblico derivato dalla chiave privata che userà il dispositivo per
// firmare
const char* DEVICE_ADDRESS =
    "0xINSERISCI_ADDRESS_DEL_DEVICE";  // placehorder, poi mettero address reale
                                       // generato con Foundry

// id della chain, seve anche questo per firmare messaggio
const uint64_t CHAIN_ID = 31337;  // se usiamo anvil

// Token semplice per evitare che chiunque mandi dati al server, eventualmente
// intasandolo. Per demo va bene, non è sicurezza "forte", è un filtro leggero
const char* DEVICE_API_KEY = "dev-secret-esp32-1";

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
