// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {ECDSA} from "openzeppelin/utils/cryptography/ECDSA.sol";

contract IoTDataStorageLatest {
    using ECDSA for bytes32;

    error IoTDataStorage__NotOwner();
    error IoTDataStorage__DeviceAlreadyRegistered();
    error IoTDataStorage__DeviceNotRegistered();
    error IoTDataStorage__NoMeasurements();
    error IoTDataStorage__InvalidSignature(); // firma falsa o fatta da un altro wallet
    error IoTDataStorage__InvalidNonce(); // nonce già usato

    struct Device {
        //rappresenta un dispositivo IoT
        bool isRegistered;
        string metadataURI; //stringa libera per info su dispositivo
        uint256 registeredAt; //timestamp di registrazione, qui salveremo block.timestamp
    }

    struct Measurement {
        //rappresenta una misurazione
        int256 value; // dato misurato
        uint256 deviceTimestamp; // timestamp genrato dal dispositivo
        uint256 blockchainTimestamp; // quando ralayer ha scritto in blockchain
        uint256 nonce; // numero progressivo anti replay
        bytes32 dataHash; // hash esatto dei dati firmati
    }

    address private immutable i_owner;

    // Mapping dei dispositivi
    mapping(address deviceAddress => Device device) private s_devices;

    // Mapping delle misurazioni
    mapping(address deviceAddress => Measurement measurement) private s_latestMeasurement;

    // Mapping per controllo presenza effettiva misurazione (e non struct default)
    mapping(address deviceAddress => bool hasMeasurement) private s_hasMeasurement;

    mapping(address deviceAddress => uint256 lastNonce) private s_lastNonce; // salva ultimo nonce accettato per ogni dispositivo

    // con indexed posso filtrare gli event per qulla variabile
    event DeviceRegistered(address indexed deviceAddress, string metadataURI);

    event MeasurementRecorded(
        address indexed deviceAddress,
        address indexed relayer,
        int256 value,
        uint256 deviceTimestamp,
        uint256 blockchainTimestamp,
        uint256 nonce,
        bytes32 dataHash
    );
    // relayer è msg.sender. Non è obbligatorio, ma è molto utile perché così sai chi ha pubblicato la misura.

    modifier onlyOwner() {
        if (msg.sender != i_owner) {
            revert IoTDataStorage__NotOwner();
        }

        _;
    }

    modifier onlyRegisteredDevice(address deviceAddress) {
        if (!s_devices[deviceAddress].isRegistered) {
            revert IoTDataStorage__DeviceNotRegistered();
        }

        _;
    }

    constructor() {
        i_owner = msg.sender; // salviamo come owner l'indirizzo di chi ha deployato il contratto
    }

    function registerDevice(address deviceAddress, string calldata metadataURI) external onlyOwner {
        // usiamo calldata perchè piu efficiente, non viene copiata inutilmente in meoria
        // external cosi la funzione puo essere chiamata dall'esterno del contratto
        // solo l'Owner può registrare i dispositivi

        if (s_devices[deviceAddress].isRegistered) {
            revert IoTDataStorage__DeviceAlreadyRegistered();
        }

        s_devices[deviceAddress] = Device({isRegistered: true, metadataURI: metadataURI, registeredAt: block.timestamp});

        emit DeviceRegistered(deviceAddress, metadataURI);
    }

    function recordSignedMeasurement(
        address deviceAddress,
        int256 value,
        uint256 deviceTimestamp,
        uint256 nonce,
        bytes calldata signature
    ) external onlyRegisteredDevice(deviceAddress) {
        // per ora mettiamo solo una valore numerico. poi potremmo aggiungere di verse grandezze misurate
        if (nonce <= s_lastNonce[deviceAddress]) {
            revert IoTDataStorage__InvalidNonce();
        }

        bytes32 dataHash = getMeasurementHash(deviceAddress, value, deviceTimestamp, nonce);

        address signer = dataHash.toEthSignedMessageHash().recover(signature);

        if (signer != deviceAddress) {
            revert IoTDataStorage__InvalidSignature();
        }

        s_lastNonce[deviceAddress] = nonce;

        s_latestMeasurement[deviceAddress] = Measurement({
            value: value,
            deviceTimestamp: deviceTimestamp,
            blockchainTimestamp: block.timestamp,
            nonce: nonce,
            dataHash: dataHash
        });

        s_hasMeasurement[deviceAddress] = true;

        emit MeasurementRecorded(deviceAddress, msg.sender, value, deviceTimestamp, block.timestamp, nonce, dataHash);
    }
    // msg.sender identifica chi ha inviato la transazione

    // GETTERS

    function getDevice(address deviceAddress) external view returns (Device memory) {
        return s_devices[deviceAddress];
    }

    function getLatestMeasurement(address deviceAddress)
        external
        view
        onlyRegisteredDevice(deviceAddress)
        returns (Measurement memory)
    {
        if (!s_hasMeasurement[deviceAddress]) {
            revert IoTDataStorage__NoMeasurements();
        }

        return s_latestMeasurement[deviceAddress];
    }

    function getMeasurementCount(address deviceAddress) external view returns (uint256) {
        if (s_hasMeasurement[deviceAddress]) {
            return 1;
        }

        return 0;
    }

    function getOwner() external view returns (address) {
        return i_owner;
    }

    function getStorageMode() external pure returns (string memory) {
        return "latest-storage";
    }

    function getMeasurementHash(address deviceAddress, int256 value, uint256 deviceTimestamp, uint256 nonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(address(this), block.chainid, deviceAddress, value, deviceTimestamp, nonce));
    }

    function getLastNonce(address deviceAddress) external view returns (uint256) {
        return s_lastNonce[deviceAddress];
    }

    // address(this) evita che la stessa firma sia riutilizzabile su un altro contratto.
    // block.chainid evita che la stessa firma sia riutilizzabile su un'altra blockchain.
    // abi.encodePacked è usato per mantenere lo stesso formato binario ricostruito dal firmware ESP32.
}
