// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {IoTDataStorageLatest} from "../src/IoTDataStorageLatest.sol";

contract DeployIoTDataStorageLatest is Script {
    function run() external returns (IoTDataStorageLatest) {
        vm.startBroadcast();

        IoTDataStorageLatest iotDataStorage = new IoTDataStorageLatest();

        vm.stopBroadcast();

        return iotDataStorage;
    }
}
