// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {IoTDataStorageHashURI} from "../src/IoTDataStorageHashURI.sol";

contract IoTDataStorageHashURITest is Test {
    IoTDataStorageHashURI private iotDataStorage;

    address private owner = address(1);
    address private device;
    address private user = address(3);

    uint256 private constant DEVICE_PRIVATE_KEY = 2;
    uint256 private constant OTHER_PRIVATE_KEY = 3;

    string private constant METADATA_URI = "esp32-laboratorio";
    int256 private constant MEASUREMENT_VALUE = 25;
    string private constant MEASUREMENT_URI = "offchain://measurement/device/1";
    string private constant SECOND_MEASUREMENT_URI = "offchain://measurement/device/2";

    event DeviceRegistered(address indexed deviceAddress, string metadataURI);

    event MeasurementReferenceRecorded(
        address indexed deviceAddress,
        address indexed relayer,
        bytes32 dataHash,
        string measurementURI,
        uint256 blockchainTimestamp,
        uint256 nonce
    );

    function setUp() public {
        device = vm.addr(DEVICE_PRIVATE_KEY);

        vm.prank(owner);
        iotDataStorage = new IoTDataStorageHashURI();
    }

    function testOwnerIsDeployer() public view {
        assertEq(iotDataStorage.getOwner(), owner);
    }

    function testStorageModeIsHashURIStorage() public view {
        assertEq(iotDataStorage.getStorageMode(), "hash-uri-storage");
    }

    function testOwnerCanRegisterDevice() public {
        vm.prank(owner);
        iotDataStorage.registerDevice(device, METADATA_URI);

        IoTDataStorageHashURI.Device memory registeredDevice = iotDataStorage.getDevice(device);

        assertEq(registeredDevice.isRegistered, true);
        assertEq(registeredDevice.metadataURI, METADATA_URI);
        assertGt(registeredDevice.registeredAt, 0); // assert greater than
    }

    function testNonOwnerCannotRegisterDevice() public {
        vm.prank(user);

        vm.expectRevert(IoTDataStorageHashURI.IoTDataStorage__NotOwner.selector); // prendo il selector dell'error (come selector funzione)
        iotDataStorage.registerDevice(device, METADATA_URI);
    }

    function testCannotRegisterSameDeviceTwice() public {
        vm.prank(owner);
        iotDataStorage.registerDevice(device, METADATA_URI);

        vm.prank(owner);
        vm.expectRevert(IoTDataStorageHashURI.IoTDataStorage__DeviceAlreadyRegistered.selector);
        iotDataStorage.registerDevice(device, METADATA_URI);
    }

    function testRegisteredDeviceCanRecordMeasurementReference() public {
        vm.prank(owner);
        iotDataStorage.registerDevice(device, METADATA_URI);

        uint256 deviceTimestamp = 1_700_000_000;
        uint256 nonce = 1;

        bytes memory signature = _signMeasurement(DEVICE_PRIVATE_KEY, device, MEASUREMENT_VALUE, deviceTimestamp, nonce);

        vm.prank(user);
        iotDataStorage.recordSignedMeasurement(
            device, MEASUREMENT_VALUE, deviceTimestamp, nonce, MEASUREMENT_URI, signature
        );

        IoTDataStorageHashURI.MeasurementReference memory measurementReference =
            iotDataStorage.getMeasurementReference(device, 0);

        assertEq(iotDataStorage.getMeasurementCount(device), 1);
        assertEq(iotDataStorage.getLastNonce(device), nonce);
        assertEq(
            measurementReference.dataHash,
            iotDataStorage.getMeasurementHash(device, MEASUREMENT_VALUE, deviceTimestamp, nonce)
        );
        assertEq(measurementReference.measurementURI, MEASUREMENT_URI);
        assertGt(measurementReference.blockchainTimestamp, 0);
        assertEq(measurementReference.nonce, nonce);
    }

    function testUnregisteredDeviceCannotRecordMeasurement() public {
        vm.expectRevert(IoTDataStorageHashURI.IoTDataStorage__DeviceNotRegistered.selector);

        iotDataStorage.recordSignedMeasurement(device, MEASUREMENT_VALUE, 1_700_000_000, 1, MEASUREMENT_URI, hex"");
    }

    function testMultipleMeasurementReferencesAreStoredInHistory() public {
        vm.prank(owner);
        iotDataStorage.registerDevice(device, METADATA_URI);

        uint256 firstTimestamp = 1_700_000_000;
        uint256 secondTimestamp = 1_700_000_100;

        bytes memory firstSignature = _signMeasurement(DEVICE_PRIVATE_KEY, device, 10, firstTimestamp, 1);
        bytes memory secondSignature = _signMeasurement(DEVICE_PRIVATE_KEY, device, 20, secondTimestamp, 2);

        iotDataStorage.recordSignedMeasurement(device, 10, firstTimestamp, 1, MEASUREMENT_URI, firstSignature);
        iotDataStorage.recordSignedMeasurement(device, 20, secondTimestamp, 2, SECOND_MEASUREMENT_URI, secondSignature);

        IoTDataStorageHashURI.MeasurementReference memory firstReference =
            iotDataStorage.getMeasurementReference(device, 0);

        IoTDataStorageHashURI.MeasurementReference memory latestReference =
            iotDataStorage.getLatestMeasurementReference(device);

        assertEq(iotDataStorage.getMeasurementCount(device), 2);
        assertEq(firstReference.measurementURI, MEASUREMENT_URI);
        assertEq(firstReference.nonce, 1);
        assertEq(latestReference.measurementURI, SECOND_MEASUREMENT_URI);
        assertEq(latestReference.nonce, 2);
    }

    function testCanGetLatestMeasurementReference() public {
        vm.prank(owner);
        iotDataStorage.registerDevice(device, METADATA_URI);

        uint256 firstTimestamp = 1_700_000_000;
        uint256 secondTimestamp = 1_700_000_100;

        bytes memory firstSignature = _signMeasurement(DEVICE_PRIVATE_KEY, device, 10, firstTimestamp, 1);
        bytes memory secondSignature = _signMeasurement(DEVICE_PRIVATE_KEY, device, 20, secondTimestamp, 2);

        iotDataStorage.recordSignedMeasurement(device, 10, firstTimestamp, 1, MEASUREMENT_URI, firstSignature);
        iotDataStorage.recordSignedMeasurement(device, 20, secondTimestamp, 2, SECOND_MEASUREMENT_URI, secondSignature);

        IoTDataStorageHashURI.MeasurementReference memory latestReference =
            iotDataStorage.getLatestMeasurementReference(device);

        assertEq(latestReference.measurementURI, SECOND_MEASUREMENT_URI);
        assertEq(latestReference.nonce, 2);
        assertEq(latestReference.dataHash, iotDataStorage.getMeasurementHash(device, 20, secondTimestamp, 2));
    }

    // verifica che una furma firmata da un wallet diverso dal device venga rifiutata
    function testCannotRecordMeasurementWithInvalidSignature() public {
        vm.prank(owner);
        iotDataStorage.registerDevice(device, METADATA_URI);

        uint256 deviceTimestamp = 1_700_000_000;
        uint256 nonce = 1;

        bytes memory signature = _signMeasurement(OTHER_PRIVATE_KEY, device, MEASUREMENT_VALUE, deviceTimestamp, nonce);

        vm.prank(user);
        vm.expectRevert(IoTDataStorageHashURI.IoTDataStorage__InvalidSignature.selector);

        iotDataStorage.recordSignedMeasurement(
            device, MEASUREMENT_VALUE, deviceTimestamp, nonce, MEASUREMENT_URI, signature
        );

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
        iotDataStorage.recordSignedMeasurement(
            device, MEASUREMENT_VALUE, deviceTimestamp, nonce, MEASUREMENT_URI, signature
        );

        vm.prank(user);
        vm.expectRevert(IoTDataStorageHashURI.IoTDataStorage__InvalidNonce.selector);

        iotDataStorage.recordSignedMeasurement(
            device, MEASUREMENT_VALUE, deviceTimestamp, nonce, MEASUREMENT_URI, signature
        );

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

        vm.expectEmit(true, false, false, true, address(iotDataStorage));
        emit MeasurementReferenceRecorded(device, user, dataHash, MEASUREMENT_URI, blockchainTimestamp, nonce);

        vm.prank(user);
        iotDataStorage.recordSignedMeasurement(
            device, MEASUREMENT_VALUE, deviceTimestamp, nonce, MEASUREMENT_URI, signature
        );
    }
}
