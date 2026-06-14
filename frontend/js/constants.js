const contractAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

const abi = [
    "function getOwner() view returns (address)",
    "function getDevice(address) view returns (bool,string,uint256)",
    "function getLatestMeasurement(address) view returns (int256,uint256)"
];