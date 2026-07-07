// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {IoTDataStorageFull} from "../src/IoTDataStorageFull.sol";

contract DeployIoTDataStorageFull is Script {
    function run() external returns (IoTDataStorageFull) {
        vm.startBroadcast();

        IoTDataStorageFull iotDataStorage = new IoTDataStorageFull();

        vm.stopBroadcast();

        return iotDataStorage;
    }
}
