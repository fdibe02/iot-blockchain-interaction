// SPDX-License-identifier: MIT

pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {IoTDataStorage} from "../src/IoTDataStorage.sol";

contract IoTDataStorageTest is Test {
    IoTDataStorage private iotDataStorage;

    address private owner = address(1);
    address private device = address(2);
    address private user = address(3);

    string private constant METADATA_URI = "esp32-laboratorio";
    int256 private constant MEASUREMENT_VALUE = 25;

    event DeviceRegistered(address indexed deviceAddress, string metadataURI);

    event MeasurementRecorded(address indexed deviceAddress, int256 value, uint256 timestamp);

    function setUp() public {
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

    function testcannotRegisterSameDeviceTwice() public {
        vm.prank(owner);
        iotDataStorage.registerDevice(device, METADATA_URI);

        vm.prank(owner);
        vm.expectRevert(IoTDataStorage.IoTDataStorage__DeviceAlreadyRegistered.selector);
        iotDataStorage.registerDevice(device, METADATA_URI);
    }

    function testRegisteredDeviceCanRecordMeasurement() public {
        vm.prank(owner);
        iotDataStorage.registerDevice(device, METADATA_URI);

        vm.prank(device);
        iotDataStorage.recordMeasurement(MEASUREMENT_VALUE);

        uint256 measurementCount = iotDataStorage.getMeasurementCount(device);
        IoTDataStorage.Measurement memory measurement = iotDataStorage.getMeasurement(device, 0);

        assertEq(measurementCount, 1);
        assertEq(measurement.value, MEASUREMENT_VALUE);
        assertGt(measurement.timestamp, 0);
    }

    function UnregisteredDeviceCannotRecordMeasurement() public {
        vm.prank(device);

        vm.expectRevert(IoTDataStorage.IoTDataStorage__DeviceNotRegistered.selector);
        iotDataStorage.recordMeasurement(MEASUREMENT_VALUE);
    }

    function testCanGetLatestMeasurement() public {
        vm.prank(owner);
        iotDataStorage.registerDevice(device, METADATA_URI);

        vm.prank(device);
        iotDataStorage.recordMeasurement(10);

        vm.prank(device);
        iotDataStorage.recordMeasurement(20);

        IoTDataStorage.Measurement memory latestMeasurement = iotDataStorage.getLatestMeasurement(device);

        assertEq(latestMeasurement.value, 20);
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

        vm.prank(device);

        vm.expectEmit(true, false, false, false);
        emit MeasurementRecorded(device, MEASUREMENT_VALUE, block.timestamp);

        iotDataStorage.recordMeasurement(MEASUREMENT_VALUE);
    }
}
