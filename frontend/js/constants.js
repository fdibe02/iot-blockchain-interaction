// File generato dall artifact Foundry.
// Contiene l ABI del contratto IoTDataStorage.

var abi = [
    {
        "type": "constructor",
        "inputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "getDevice",
        "inputs": [
            {
                "name": "deviceAddress",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "internalType": "struct IoTDataStorage.Device",
                "components": [
                    {
                        "name": "isRegistered",
                        "type": "bool",
                        "internalType": "bool"
                    },
                    {
                        "name": "metadataURI",
                        "type": "string",
                        "internalType": "string"
                    },
                    {
                        "name": "registeredAt",
                        "type": "uint256",
                        "internalType": "uint256"
                    }
                ]
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getLatestMeasurement",
        "inputs": [
            {
                "name": "deviceAddress",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "internalType": "struct IoTDataStorage.Measurement",
                "components": [
                    {
                        "name": "value",
                        "type": "int256",
                        "internalType": "int256"
                    },
                    {
                        "name": "timestamp",
                        "type": "uint256",
                        "internalType": "uint256"
                    }
                ]
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getMeasurement",
        "inputs": [
            {
                "name": "deviceAddress",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "index",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "internalType": "struct IoTDataStorage.Measurement",
                "components": [
                    {
                        "name": "value",
                        "type": "int256",
                        "internalType": "int256"
                    },
                    {
                        "name": "timestamp",
                        "type": "uint256",
                        "internalType": "uint256"
                    }
                ]
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getMeasurementCount",
        "inputs": [
            {
                "name": "deviceAddress",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getOwner",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "recordMeasurement",
        "inputs": [
            {
                "name": "value",
                "type": "int256",
                "internalType": "int256"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "registerDevice",
        "inputs": [
            {
                "name": "deviceAddress",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "metadataURI",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "event",
        "name": "DeviceRegistered",
        "inputs": [
            {
                "name": "deviceAddress",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "metadataURI",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "MeasurementRecorded",
        "inputs": [
            {
                "name": "deviceAddress",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "value",
                "type": "int256",
                "indexed": false,
                "internalType": "int256"
            },
            {
                "name": "timestamp",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "error",
        "name": "IoTDataStorage__DeviceAlreadyRegistered",
        "inputs": []
    },
    {
        "type": "error",
        "name": "IoTDataStorage__DeviceNotRegistered",
        "inputs": []
    },
    {
        "type": "error",
        "name": "IoTDataStorage__NoMeasurements",
        "inputs": []
    },
    {
        "type": "error",
        "name": "IoTDataStorage__NotOwner",
        "inputs": []
    }
];
