// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {IoTDataStorage} from "../src/IoTDataStorage.sol";

contract DeployIoTDataStorage is Script {
    function run() external returns (IoTDataStorage) {
        vm.startBroadcast();

        IoTDataStorage iotDataStorage = new IoTDataStorage();

        vm.stopBroadcast();

        return iotDataStorage;
    }
}
