const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const abi = [
    "function getOwner() view returns (address)",
    "function getDevice(address) view returns (tuple(bool isRegistered, string metadataURI, uint256 registeredAt))",
    "function getLatestMeasurement(address) view returns (int256,uint256)"
];