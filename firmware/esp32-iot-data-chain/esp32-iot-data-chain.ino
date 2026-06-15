// invio misura ogni 10 secondi al server Node.js

#include <HTTPClient.h>
#include <WiFi.h>

// =======================
// CONFIGURAZIONE WIFI
// =======================

const char* WIFI_SSID = "NOME_WIFI";
const char* WIFI_PASSWORD = "PASSWORD_WIFI";

// usa IP locale del Mac, tipo: http://192.168.1.50:3000/api/measurements
const char* SERVER_URL = "http://192.168.1.50:3000/api/measurements";

// Identificativo logico del dispositivo. Deve corrispondere a quello che
// gestisci lato Node.js
const char* DEVICE_ID = "esp32-laboratorio";

// Token sepmlice per evitare che chiunque mandi dati al server. Per demo va
// bene, non è sicurezza "forte"
const char* DEVICE_API_KEY = "dev-secret-esp32-1";

// Ogni quanto inviare misura
const unsigned long SEND_INTERVAL_MS = 10000;  // 10 secondi

unsigned long lastSendTime = 0;

// =======================
// SETUP
// =======================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("Avvio ESP32 IoT Data Chain...");

  connectToWiFi();

  randomSeed(analogRead(34));  // rendo causale la simulaizone della misura
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnesso. Riprovo la connessione...");
    connectToWiFi();
  }

  unsigned long currentTime = millis();  // tempo da quando la scheda è connessa

  if (currentTime - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = currentTime;

    int measurementValue = readMeasurement();

    Serial.println("Misura letta: ");
    Serial.println(measurementValue);

    sendMeasurement(measurementValue);
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
void sendMeasurement(int value) {
  HTTPClient http;

  Serial.println("Invio POST a: ");
  Serial.println(SERVER_URL);

  http.begin(SERVER_URL);

  // costruisco Header della POST
  http.addHeader("Content-type", "application/json");
  http.addHeader("X-device-Id", DEVICE_ID);
  http.addHeader("X-API-Key", DEVICE_API_KEY);

  // costruisco il body della POST
  String body = "{";
  body += "\"deviceId\":\"";
  body += DEVICE_ID;
  body += "\",";
  body += "\"value\":";
  body += String(value);
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
