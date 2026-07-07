// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {IoTDataStorageHashURI} from "../src/IoTDataStorageHashURI.sol";

contract DeployIoTDataStorageHashURI is Script {
    function run() external returns (IoTDataStorageHashURI) {
        vm.startBroadcast();

        IoTDataStorageHashURI iotDataStorage = new IoTDataStorageHashURI();

        vm.stopBroadcast();

        return iotDataStorage;
    }
}
