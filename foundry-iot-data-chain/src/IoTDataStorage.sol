// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

contract IoTDataStorage {
    error IoTDataStorage__NotOwner();
    error IoTDataStorage__DeviceAlreadyRegistered();
    error IoTDataStorage__DeviceNotRegistered();
    error IoTDataStorage__NoMeasurements();

    struct Device {
        //rappresenta un dispositivo IoT
        bool isRegistered;
        string metadataURI; //stringa libera per info su dispositivo
        uint256 registeredAt; //timestamp di registrazione, qui salveremo block.timestamp
    }

    struct Measurement {
        //rappresenta una misurazione
        int256 value; // non uint perchè potrebbe essere anche negativa
        uint256 timestamp; //anche qui block.timestamp
    }

    address private immutable i_owner;

    // Mapping dei dispositivi
    mapping(address deviceAddress => Device device) private s_devices;

    // Mapping delle misurazioni
    mapping(address deviceAddress => Measurement[] measurements) private s_measurements;

    // con indexed posso filtrare gli event per qulla variabile

    event DeviceRegistered(address indexed deviceAddress, string metadataURI);

    event MeasurementRecorded(address indexed deviceAddress, int256 value, uint256 timestamp);

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

    function recordMeasurement(int256 value) external onlyRegisteredDevice(msg.sender) {
        // per ora mettiamo solo una valore nuemrico. poi potremmo aggiungere di verse grandezze misurate

        s_measurements[msg.sender].push(Measurement({value: value, timestamp: block.timestamp}));

        emit MeasurementRecorded(msg.sender, value, block.timestamp);
    }

    // GETTERS

    function getDevice(address deviceAddress) external view returns (Device memory) {
        return s_devices[deviceAddress];
    }

    function getMeasurement(address deviceAddress, uint256 index) external view returns (Measurement memory) {
        return s_measurements[deviceAddress][index];
    }

    function getLatestMeasurement(address deviceAddress)
        external
        view
        onlyRegisteredDevice(deviceAddress)
        returns (Measurement memory)
    {
        uint256 measurementsCount = s_measurements[deviceAddress].length;

        if (measurementsCount == 0) {
            revert IoTDataStorage__NoMeasurements();
        }

        return s_measurements[deviceAddress][measurementsCount - 1];
    }

    function getMeasurementCount(address deviceAddress) external view returns (uint256) {
        return s_measurements[deviceAddress].length;
    }

    function getOwner() external view returns (address) {
        return i_owner;
    }
}
