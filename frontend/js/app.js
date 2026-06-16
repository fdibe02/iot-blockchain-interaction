var provider;
var signer;
var contract;

function connectWallet() {
    if (typeof window.ethereum === "undefined") {
        document.getElementById("connectionStatus").innerHTML = "MetaMask non trovato";
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

    document.getElementById("connectionStatus").innerHTML = "Connesso";
    document.getElementById("connectedAccount").innerHTML = account;
}

function showConnectionError(error) {
    console.log(error);

    document.getElementById("connectionStatus").innerHTML = "Errore durante la connessione";
}

function getOwner() {
    if (contract === undefined) {
        document.getElementById("ownerAddress").innerHTML =
            "Connetti prima MetaMask";
        return;
    }

    contract
        .getOwner()
        .then(showOwner)
        .catch(showOwnerError);
}

function showOwner(owner) {
    document.getElementById("ownerAddress").innerHTML = owner;
}

function showOwnerError(error) {
    console.log(error);

    document.getElementById("ownerAddress").innerHTML =
        "Errore durante la lettura dell'owner";
}

function registerDevice() {
    if (contract === undefined) {
        document.getElementById("registerDeviceStatus").innerHTML =
            "Connetti prima MetaMask";
        return;
    }

    var deviceAddress = document.getElementById("registerDeviceAddressInput").value;
    var metadataURI = document.getElementById("registerDeviceMetadataInput").value;

    if (deviceAddress === "") {
        document.getElementById("registerDeviceStatus").innerHTML =
            "Inserisci l'address del dispositivo";
        return;
    }

    if (metadataURI === "") {
        document.getElementById("registerDeviceStatus").innerHTML =
            "Inserisci il metadata URI";
        return;
    }

    document.getElementById("registerDeviceStatus").innerHTML =
        "Transazione in attesa di conferma su MetaMask";

    contract
        .registerDevice(deviceAddress, metadataURI)
        .then(waitRegisterDeviceTransaction)
        .then(showRegisterDeviceSuccess)
        .catch(showRegisterDeviceError);
}

function waitRegisterDeviceTransaction(transactionResponse) {
    document.getElementById("registerDeviceStatus").innerHTML =
        "Transazione inviata. Attendo conferma sulla blockchain...";

    return transactionResponse.wait(1);
}

function showRegisterDeviceSuccess(receipt) {
    console.log(receipt);

    document.getElementById("registerDeviceStatus").innerHTML =
        "Dispositivo registrato correttamente";
}

function showRegisterDeviceError(error) {
    console.log(error);

    document.getElementById("registerDeviceStatus").innerHTML =
        "Errore durante la registrazione del dispositivo";
}

function getDevice() {
    if (contract === undefined) {
        document.getElementById("deviceRegistered").innerHTML =
            "Connetti prima MetaMask";
        return;
    }

    var deviceAddress = document.getElementById("deviceAddressInput").value;

    if (deviceAddress === "") {
        document.getElementById("deviceRegistered").innerHTML =
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

    document.getElementById("deviceRegistered").innerHTML = registered;
    document.getElementById("deviceMetadata").innerHTML = metadataURI;

    if (registeredAt === 0) {
        document.getElementById("deviceRegisteredAt").innerHTML = "-";
    } else {
        document.getElementById("deviceRegisteredAt").innerHTML =
            new Date(registeredAt * 1000).toLocaleString("it-IT");
    }
}

function showDeviceError(error) {
    console.log(error);

    document.getElementById("deviceRegistered").innerHTML =
        "Errore durante la lettura del dispositivo";
}

function getLatestMeasurement() {
    if (contract === undefined) {
        document.getElementById("latestMeasurementValue").innerHTML =
            "Connetti prima MetaMask";
        return;
    }

    var deviceAddress = document.getElementById("deviceAddressInput").value;

    if (deviceAddress === "") {
        document.getElementById("latestMeasurementValue").innerHTML =
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
    var timestamp = Number(measurement[1]);

    document.getElementById("latestMeasurementValue").innerHTML = value;

    if (timestamp === 0) {
        document.getElementById("latestMeasurementTimestamp").innerHTML = "-";
    } else {
        document.getElementById("latestMeasurementTimestamp").innerHTML =
            new Date(timestamp * 1000).toLocaleString("it-IT");
    }
}

function showLatestMeasurementError(error) {
    console.log(error);

    document.getElementById("latestMeasurementValue").innerHTML =
        "Errore durante la lettura della misurazione";
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




