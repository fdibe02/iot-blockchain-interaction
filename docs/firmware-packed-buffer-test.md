# Firmware test packed buffer

Versione temporanea del firmware usata per verificare la costruzione del buffer binario compatibile con `abi.encodePacked(...)`.

## Parti aggiunte/modificate

```cpp
const char* CONTRACT_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

const char* DEVICE_ADDRESS = "0xc2E770A8460ac16C83285225FBB175EFf65Ab186";

const uint64_t CHAIN_ID = 31337;  // Anvil

const size_t PACKED_BUFFER_SIZE = 168;
```

## Test temporaneo in setup()

```cpp
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("Avvio ESP32 IoT Data Chain...");

  connectToWiFi();

  timeSynchronized = synchronizeTime();

  randomSeed(analogRead(34));

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
```

In questa versione l’invio al middleware è stato disattivato temporaneamente:

```cpp
// sendMeasurement(measurementValue, measurementNonce);
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

void printHex(const uint8_t* buffer, size_t length) {
  const char* hex = "0123456789abcdef";

  for (size_t i = 0; i < length; i++) {
    Serial.print(hex[buffer[i] >> 4]);
    Serial.print(hex[buffer[i] & 0x0f]);
  }

  Serial.println();
}
```
