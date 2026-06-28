# Firmware test packed buffer + dataHash

Versione temporanea del firmware usata per verificare localmente:

1. la costruzione del buffer binario compatibile con `abi.encodePacked(...)`;
2. il calcolo del `dataHash` tramite Keccak-256 sul buffer packed.

In questa fase non viene ancora generata la firma ECDSA e non viene inviato nulla al middleware.

## Parti di rete commentate

Per questo test non servono WiFi, NTP o invio HTTP al middleware.
La parte di rete è quindi lasciata commentata nel firmware.

```cpp
// #include <HTTPClient.h>
// #include <WiFi.h>
// #include <time.h>

// const char* WIFI_SSID = "INSERISCI_NOME_WIFI";
// const char* WIFI_PASSWORD = "INSERISCI_PASSWORD_WIFI";

// const char* NTP_SERVER_1 = "pool.ntp.org";
// const char* NTP_SERVER_2 = "time.nist.gov";
// const long GMT_OFFSET_SEC = 0;
// const int DAYLIGHT_OFFSET_SEC = 0;

// const char* SERVER_URL = "http://INSERISCI_IP_MAC:3000/api/measurements";
// const char* DEVICE_API_KEY = "dev-secret-esp32-1";
```

## Parti aggiunte/modificate

```cpp
extern "C" {
#include "sha3.h"  // libreria C per calcolo hash Keccak-256
}
```

```cpp
const char* CONTRACT_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

const char* DEVICE_ADDRESS = "0xc2E770A8460ac16C83285225FBB175EFf65Ab186";

const uint64_t CHAIN_ID = 31337;  // Anvil

const size_t PACKED_BUFFER_SIZE = 168;
const size_t DATA_HASH_SIZE = 32;
```

## Test temporaneo in `setup()`

```cpp
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("Test locale packed buffer + dataHash");

  const int64_t testValue = 25;
  const uint64_t testDeviceTimestamp = 1700000000ULL;
  const uint64_t testNonce = 1ULL;

  uint8_t packedBuffer[PACKED_BUFFER_SIZE];

  bool ok = buildPackedMeasurementBuffer(
      packedBuffer,
      testValue,
      testDeviceTimestamp,
      testNonce);

  if (!ok) {
    Serial.println("Errore costruzione packed buffer");
    return;
  }

  Serial.print("Packed length: ");
  Serial.println(PACKED_BUFFER_SIZE);

  Serial.print("Packed hex: 0x");
  printHex(packedBuffer, PACKED_BUFFER_SIZE);

  uint8_t dataHash[DATA_HASH_SIZE];

  bool hashOk = computeDataHashFromPackedBuffer(packedBuffer, dataHash);

  if (!hashOk) {
    Serial.println("Errore calcolo dataHash");
    return;
  }

  Serial.print("Data hash: 0x");
  printHex(dataHash, DATA_HASH_SIZE);
}

void loop() {
  // Test locale statico:
  // nessuna misura periodica, nessun WiFi, nessun invio HTTP.
}
```

## Funzioni aggiunte per costruzione packed buffer

```cpp
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
```

```cpp
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

    buffer[offset] = (uint8_t)((high << 4) | low);
    offset++;
  }

  return true;
}
```

```cpp
void appendUint256(uint8_t* buffer, size_t& offset, uint64_t value) {
  for (int i = 0; i < 32; i++) {
    buffer[offset + i] = 0;
  }

  for (int i = 31; i >= 24; i--) {
    buffer[offset + i] = value & 0xff;
    value >>= 8;
  }

  offset += 32;
}
```

```cpp
void appendInt256(uint8_t* buffer, size_t& offset, int64_t value) {
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
```

```cpp
bool buildPackedMeasurementBuffer(
    uint8_t* buffer,
    int64_t value,
    uint64_t deviceTimestamp,
    uint64_t nonce) {
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
```

## Funzione aggiunta per calcolo `dataHash`

Il `dataHash` viene calcolato facendo Keccak-256 del buffer packed già costruito.

```cpp
bool computeDataHashFromPackedBuffer(const uint8_t* packedBuffer,
                                     uint8_t* dataHash) {
  sha3_return_t result =
      sha3_HashBuffer(256, SHA3_FLAGS_KECCAK, packedBuffer, PACKED_BUFFER_SIZE,
                      dataHash, DATA_HASH_SIZE);

  if (result != SHA3_RETURN_OK) {
    Serial.println("Errore calcolo Keccak-256");
    return false;
  }

  return true;
}
```

## Funzione di stampa esadecimale

```cpp
void printHex(const uint8_t* buffer, size_t length) {
  const char* hex = "0123456789abcdef";

  for (size_t i = 0; i < length; i++) {
    Serial.print(hex[buffer[i] >> 4]);
    Serial.print(hex[buffer[i] & 0x0f]);
  }

  Serial.println();
}
```

## Output atteso del test

Con i valori fissi:

```cpp
value = 25;
deviceTimestamp = 1700000000ULL;
nonce = 1ULL;
```

il firmware deve stampare:

```text
Packed length: 168
Packed hex: 0x5fbdb2315678afecb367f032d93f642f64180aa30000000000000000000000000000000000000000000000000000000000007a69c2e770a8460ac16c83285225fbb175eff65ab1860000000000000000000000000000000000000000000000000000000000000019000000000000000000000000000000000000000000000000000000006553f1000000000000000000000000000000000000000000000000000000000000000001
Data hash: 0x0290701a94d70439ce77507be8ee982615cd35cf32a9332ba96602d99e690fad
```
