// File generato dall artifact Foundry.
// Contiene l ABI del contratto IoTDataStorage.

var abi = [
    { "type": "constructor", "inputs": [], "stateMutability": "nonpayable" },
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
                    { "name": "isRegistered", "type": "bool", "internalType": "bool" },
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
        "name": "getLastNonce",
        "inputs": [
            {
                "name": "deviceAddress",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
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
                    { "name": "value", "type": "int256", "internalType": "int256" },
                    {
                        "name": "deviceTimestamp",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    {
                        "name": "blockchainTimestamp",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    { "name": "nonce", "type": "uint256", "internalType": "uint256" },
                    { "name": "dataHash", "type": "bytes32", "internalType": "bytes32" }
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
            { "name": "index", "type": "uint256", "internalType": "uint256" }
        ],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "internalType": "struct IoTDataStorage.Measurement",
                "components": [
                    { "name": "value", "type": "int256", "internalType": "int256" },
                    {
                        "name": "deviceTimestamp",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    {
                        "name": "blockchainTimestamp",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    { "name": "nonce", "type": "uint256", "internalType": "uint256" },
                    { "name": "dataHash", "type": "bytes32", "internalType": "bytes32" }
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
        "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getMeasurementHash",
        "inputs": [
            {
                "name": "deviceAddress",
                "type": "address",
                "internalType": "address"
            },
            { "name": "value", "type": "int256", "internalType": "int256" },
            {
                "name": "deviceTimestamp",
                "type": "uint256",
                "internalType": "uint256"
            },
            { "name": "nonce", "type": "uint256", "internalType": "uint256" }
        ],
        "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getOwner",
        "inputs": [],
        "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getStorageMode",
        "inputs": [],
        "outputs": [{ "name": "", "type": "string", "internalType": "string" }],
        "stateMutability": "pure"
    },
    {
        "type": "function",
        "name": "recordSignedMeasurement",
        "inputs": [
            {
                "name": "deviceAddress",
                "type": "address",
                "internalType": "address"
            },
            { "name": "value", "type": "int256", "internalType": "int256" },
            {
                "name": "deviceTimestamp",
                "type": "uint256",
                "internalType": "uint256"
            },
            { "name": "nonce", "type": "uint256", "internalType": "uint256" },
            { "name": "signature", "type": "bytes", "internalType": "bytes" }
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
            { "name": "metadataURI", "type": "string", "internalType": "string" }
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
                "name": "relayer",
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
                "name": "deviceTimestamp",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "blockchainTimestamp",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "nonce",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "dataHash",
                "type": "bytes32",
                "indexed": false,
                "internalType": "bytes32"
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
    { "type": "error", "name": "IoTDataStorage__InvalidNonce", "inputs": [] },
    {
        "type": "error",
        "name": "IoTDataStorage__InvalidSignature",
        "inputs": []
    },
    { "type": "error", "name": "IoTDataStorage__NoMeasurements", "inputs": [] },
    { "type": "error", "name": "IoTDataStorage__NotOwner", "inputs": [] }
];
