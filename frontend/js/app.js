var provider;
var signer;
var contract;

function connectWallet() {
    if (typeof window.ethereum === "undefined") {
        document.getElementById("connectionStatus").textContent = "MetaMask non trovato";
        return;
    }

    provider = new ethers.BrowserProvider(window.ethereum);

    provider
        .send("eth_requestAccounts", [])
        .then(getSelectedSigner)
        .then(saveSignerAndGetAddress)
        .then(showConnectedAccount)
        .catch(showConnectionError);
}

function getSelectedSigner() {
    return provider.getSigner();
}

function saveSignerAndGetAddress(selectedSigner) {
    signer = selectedSigner;

    return signer.getAddress();
}

function showConnectedAccount(account) {
    contract = new ethers.Contract(contractAddress, abi, signer);

    document.getElementById("connectionStatus").textContent = "Connesso";
    document.getElementById("connectedAccount").textContent = account;
}

function showConnectionError(error) {
    console.log(error);

    document.getElementById("connectionStatus").textContent = "Errore durante la connessione";
}

function getOwner() {
    if (contract === undefined) {
        document.getElementById("ownerAddress").textContent =
            "Connetti prima MetaMask";
        return;
    }

    contract
        .getOwner()
        .then(showOwner)
        .catch(showOwnerError);
}

function showOwner(owner) {
    document.getElementById("ownerAddress").textContent = owner;
}

function showOwnerError(error) {
    console.log(error);

    document.getElementById("ownerAddress").textContent =
        "Errore durante la lettura dell'owner";
}

function registerDevice() {
    if (contract === undefined) {
        document.getElementById("registerDeviceStatus").textContent =
            "Connetti prima MetaMask";
        return;
    }

    var deviceAddress = document.getElementById("registerDeviceAddressInput").value;
    var metadataURI = document.getElementById("registerDeviceMetadataInput").value;

    if (deviceAddress === "") {
        document.getElementById("registerDeviceStatus").textContent =
            "Inserisci l'address del dispositivo";
        return;
    }

    if (metadataURI === "") {
        document.getElementById("registerDeviceStatus").textContent =
            "Inserisci il metadata URI";
        return;
    }

    document.getElementById("registerDeviceStatus").textContent =
        "Transazione in attesa di conferma su MetaMask";

    contract
        .registerDevice(deviceAddress, metadataURI)
        .then(waitRegisterDeviceTransaction)
        .then(showRegisterDeviceSuccess)
        .catch(showRegisterDeviceError);
}

function waitRegisterDeviceTransaction(transactionResponse) {
    document.getElementById("registerDeviceStatus").textContent =
        "Transazione inviata. Attendo conferma sulla blockchain...";

    return transactionResponse.wait(1);
}

function showRegisterDeviceSuccess(receipt) {
    console.log(receipt);

    document.getElementById("registerDeviceStatus").textContent =
        "Dispositivo registrato correttamente";
}

function showRegisterDeviceError(error) {
    console.log(error);

    document.getElementById("registerDeviceStatus").textContent =
        "Errore durante la registrazione del dispositivo";
}

function getDevice() {
    if (contract === undefined) {
        document.getElementById("deviceRegistered").textContent =
            "Connetti prima MetaMask";
        return;
    }

    var deviceAddress = document.getElementById("deviceAddressInput").value;

    if (deviceAddress === "") {
        document.getElementById("deviceRegistered").textContent =
            "Inserisci un address";
        return;
    }

    contract
        .getDevice(deviceAddress)
        .then(showDevice)
        .catch(showDeviceError);
}

function showDevice(device) {
    var registered = device[0];
    var metadataURI = device[1];
    var registeredAt = Number(device[2]);

    document.getElementById("deviceRegistered").textContent = registered;
    document.getElementById("deviceMetadata").textContent = metadataURI;

    if (registeredAt === 0) {
        document.getElementById("deviceRegisteredAt").textContent = "-";
    } else {
        document.getElementById("deviceRegisteredAt").textContent =
            new Date(registeredAt * 1000).toLocaleString("it-IT");
    }
}

function showDeviceError(error) {
    console.log(error);

    document.getElementById("deviceRegistered").textContent =
        "Errore durante la lettura del dispositivo";
}

function getLatestMeasurement() {
    if (contract === undefined) {
        document.getElementById("latestMeasurementValue").textContent =
            "Connetti prima MetaMask";
        return;
    }

    var deviceAddress = document.getElementById("deviceAddressInput").value;

    if (deviceAddress === "") {
        document.getElementById("latestMeasurementValue").textContent =
            "Inserisci un address";
        return;
    }

    contract
        .getLatestMeasurement(deviceAddress)
        .then(showLatestMeasurement)
        .catch(showLatestMeasurementError);
}

function showLatestMeasurement(measurement) {
    var value = measurement[0].toString();
    var deviceTimestamp = Number(measurement[1]);
    var blockchainTimestamp = Number(measurement[2]);
    var nonce = measurement[3].toString();
    var dataHash = measurement[4];

    document.getElementById("latestMeasurementValue").textContent = value;
    document.getElementById("latestMeasurementNonce").textContent = nonce;
    document.getElementById("latestMeasurementDataHash").textContent = dataHash;

    if (deviceTimestamp === 0) {
        document.getElementById("latestMeasurementDeviceTimestamp").textContent = "-";
    } else {
        document.getElementById("latestMeasurementDeviceTimestamp").textContent =
            new Date(deviceTimestamp * 1000).toLocaleString("it-IT");
    }

    if (blockchainTimestamp === 0) {
        document.getElementById("latestMeasurementBlockchainTimestamp").textContent = "-";
    } else {
        document.getElementById("latestMeasurementBlockchainTimestamp").textContent =
            new Date(blockchainTimestamp * 1000).toLocaleString("it-IT");
    }
}

function showLatestMeasurementError(error) {
    console.log(error);

    document.getElementById("latestMeasurementValue").textContent =
        "Errore durante la lettura della misurazione";
    document.getElementById("latestMeasurementDeviceTimestamp").textContent = "-";
    document.getElementById("latestMeasurementBlockchainTimestamp").textContent = "-";
    document.getElementById("latestMeasurementNonce").textContent = "-";
    document.getElementById("latestMeasurementDataHash").textContent = "-";
}


document
    .getElementById("connectButton")
    .addEventListener("click", connectWallet);


document
    .getElementById("registerDeviceButton")
    .addEventListener("click", registerDevice);

document
    .getElementById("getOwnerButton")
    .addEventListener("click", getOwner);

document
    .getElementById("getDeviceButton")
    .addEventListener("click", getDevice);

document
    .getElementById("getLatestMeasurementButton")
    .addEventListener("click", getLatestMeasurement);



