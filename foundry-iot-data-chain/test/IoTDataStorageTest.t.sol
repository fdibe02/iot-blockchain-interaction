// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {IoTDataStorage} from "../src/IoTDataStorage.sol";

contract IoTDataStorageTest is Test {
    IoTDataStorage private iotDataStorage;

    address private owner = address(1);
    address private device;
    address private user = address(3);

    uint256 private constant DEVICE_PRIVATE_KEY = 2;
    uint256 private constant OTHER_PRIVATE_KEY = 3;

    string private constant METADATA_URI = "esp32-laboratorio";
    int256 private constant MEASUREMENT_VALUE = 25;

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

    function setUp() public {
        device = vm.addr(DEVICE_PRIVATE_KEY);

        vm.prank(owner);
        iotDataStorage = new IoTDataStorage();
    }

    function testOwnerIsDeployer() public view {
        assertEq(iotDataStorage.getOwner(), owner);
    }

    function testOwnerCanRegisterDevice() public {
        vm.prank(owner);
        iotDataStorage.registerDevice(device, METADATA_URI);

        IoTDataStorage.Device memory registeredDevice = iotDataStorage.getDevice(device);

        assertEq(registeredDevice.isRegistered, true);
        assertEq(registeredDevice.metadataURI, METADATA_URI);
        assertGt(registeredDevice.registeredAt, 0); // assert greater than
    }

    function testNonOwnerCannotRegisterDevice() public {
        vm.prank(user);

        vm.expectRevert(IoTDataStorage.IoTDataStorage__NotOwner.selector); // prendo il selector dell'error (come selector funzione)
        iotDataStorage.registerDevice(device, METADATA_URI);
    }

    function testCannotRegisterSameDeviceTwice() public {
        vm.prank(owner);
        iotDataStorage.registerDevice(device, METADATA_URI);

        vm.prank(owner);
        vm.expectRevert(IoTDataStorage.IoTDataStorage__DeviceAlreadyRegistered.selector);
        iotDataStorage.registerDevice(device, METADATA_URI);
    }

    function testRegisteredDeviceCanRecordMeasurement() public {
        vm.prank(owner);
        iotDataStorage.registerDevice(device, METADATA_URI);

        uint256 deviceTimestamp = 1_700_000_000;
        uint256 nonce = 1;

        bytes memory signature = _signMeasurement(DEVICE_PRIVATE_KEY, device, MEASUREMENT_VALUE, deviceTimestamp, nonce);

        vm.prank(user);
        iotDataStorage.recordSignedMeasurement(device, MEASUREMENT_VALUE, deviceTimestamp, nonce, signature);

        uint256 measurementCount = iotDataStorage.getMeasurementCount(device);

        IoTDataStorage.Measurement memory measurement = iotDataStorage.getMeasurement(device, 0);

        assertEq(measurementCount, 1);
        assertEq(measurement.value, MEASUREMENT_VALUE);
        assertEq(measurement.deviceTimestamp, deviceTimestamp);
        assertGt(measurement.blockchainTimestamp, 0);
        assertEq(measurement.nonce, nonce);
        assertEq(
            measurement.dataHash, iotDataStorage.getMeasurementHash(device, MEASUREMENT_VALUE, deviceTimestamp, nonce)
        );
        assertEq(iotDataStorage.getLastNonce(device), nonce);
    }

    function testUnregisteredDeviceCannotRecordMeasurement() public {
        vm.expectRevert(IoTDataStorage.IoTDataStorage__DeviceNotRegistered.selector);

        iotDataStorage.recordSignedMeasurement(device, MEASUREMENT_VALUE, 1_700_000_000, 1, hex"");
    }

    function testCanGetLatestMeasurement() public {
        vm.prank(owner);
        iotDataStorage.registerDevice(device, METADATA_URI);

        uint256 firstTimestamp = 1_700_000_000;
        uint256 secondTimestamp = 1_700_000_100;

        bytes memory firstSignature = _signMeasurement(DEVICE_PRIVATE_KEY, device, 10, firstTimestamp, 1);

        bytes memory secondSignature = _signMeasurement(DEVICE_PRIVATE_KEY, device, 20, secondTimestamp, 2);

        iotDataStorage.recordSignedMeasurement(device, 10, firstTimestamp, 1, firstSignature);

        iotDataStorage.recordSignedMeasurement(device, 20, secondTimestamp, 2, secondSignature);

        IoTDataStorage.Measurement memory latestMeasurement = iotDataStorage.getLatestMeasurement(device);

        assertEq(latestMeasurement.value, 20);
        assertEq(latestMeasurement.nonce, 2);
    }

    // verifica che una furma firmata da un wallet diverso dal device venga rifiutata
    function testCannotRecordMeasurementWithInvalidSignature() public {
        vm.prank(owner);
        iotDataStorage.registerDevice(device, METADATA_URI);

        uint256 deviceTimestamp = 1_700_000_000;
        uint256 nonce = 1;

        bytes memory signature = _signMeasurement(OTHER_PRIVATE_KEY, device, MEASUREMENT_VALUE, deviceTimestamp, nonce);

        vm.prank(user);
        vm.expectRevert(IoTDataStorage.IoTDataStorage__InvalidSignature.selector);

        iotDataStorage.recordSignedMeasurement(device, MEASUREMENT_VALUE, deviceTimestamp, nonce, signature);

        assertEq(iotDataStorage.getMeasurementCount(device), 0);
        assertEq(iotDataStorage.getLastNonce(device), 0);
    }

    // verifica protezione anti-replay: seconda misura deve fallire perchè il contratto accetta solo nonce maggiori dell'ultimo usato
    function testCannotReuseNonce() public {
        vm.prank(owner);
        iotDataStorage.registerDevice(device, METADATA_URI);

        uint256 deviceTimestamp = 1_700_000_000;
        uint256 nonce = 1;

        bytes memory signature = _signMeasurement(DEVICE_PRIVATE_KEY, device, MEASUREMENT_VALUE, deviceTimestamp, nonce);

        vm.prank(user);
        iotDataStorage.recordSignedMeasurement(device, MEASUREMENT_VALUE, deviceTimestamp, nonce, signature);

        vm.prank(user);
        vm.expectRevert(IoTDataStorage.IoTDataStorage__InvalidNonce.selector);

        iotDataStorage.recordSignedMeasurement(device, MEASUREMENT_VALUE, deviceTimestamp, nonce, signature);

        assertEq(iotDataStorage.getMeasurementCount(device), 1);
        assertEq(iotDataStorage.getLastNonce(device), nonce);
    }

    function _signMeasurement(
        uint256 privateKey,
        address deviceAddress,
        int256 value,
        uint256 deviceTimestamp,
        uint256 nonce
    ) private view returns (bytes memory) {
        bytes32 dataHash = iotDataStorage.getMeasurementHash(deviceAddress, value, deviceTimestamp, nonce);

        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, ethSignedMessageHash);

        return abi.encodePacked(r, s, v);
    }

    function testRegisterDeviceEmitsEvent() public {
        vm.prank(owner);

        vm.expectEmit(true, false, false, true);
        emit DeviceRegistered(device, METADATA_URI);

        iotDataStorage.registerDevice(device, METADATA_URI);
    }

    function testRecordMeasurementEmitsEvent() public {
        vm.prank(owner);
        iotDataStorage.registerDevice(device, METADATA_URI);

        uint256 blockchainTimestamp = 123;
        uint256 deviceTimestamp = 1_700_000_000;
        uint256 nonce = 1;

        vm.warp(blockchainTimestamp);

        bytes32 dataHash = iotDataStorage.getMeasurementHash(device, MEASUREMENT_VALUE, deviceTimestamp, nonce);

        bytes memory signature = _signMeasurement(DEVICE_PRIVATE_KEY, device, MEASUREMENT_VALUE, deviceTimestamp, nonce);

        vm.expectEmit(true, false, false, true, address(iotDataStorage)); // controllo device, value e timestamp, e indirizzo contratto che emette l'evento
        emit MeasurementRecorded(device, user, MEASUREMENT_VALUE, deviceTimestamp, blockchainTimestamp, nonce, dataHash);

        vm.prank(user);

        iotDataStorage.recordSignedMeasurement(device, MEASUREMENT_VALUE, deviceTimestamp, nonce, signature);
    }
}
