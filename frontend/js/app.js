var provider;
var signer;
var contract;
var recentMeasurementsLimit = 20n;

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

    contract
        .getStorageMode()
        .then(configureStorageMode)
        .catch(showStorageModeError);
}

function configureStorageMode(storageMode) {
    document.getElementById("fullStorageMeasurements").hidden =
        storageMode !== "full-storage";
}

function showStorageModeError(error) {
    console.log(error);

    document.getElementById("fullStorageMeasurements").hidden = true;
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

function getRecentMeasurements() {
    var status = document.getElementById("recentMeasurementsStatus");
    var tableContainer = document.getElementById("measurementsTableContainer");
    var tableBody = document.getElementById("recentMeasurementsBody");

    if (contract === undefined) {
        status.textContent = "Connetti prima MetaMask";
        return;
    }

    var deviceAddress = document.getElementById("deviceAddressInput").value;

    if (deviceAddress === "") {
        status.textContent = "Inserisci un address";
        return;
    }

    status.textContent = "Lettura delle misurazioni in corso...";
    tableContainer.hidden = true;
    tableBody.replaceChildren();

    contract
        .getMeasurementCount(deviceAddress)
        .then(function (measurementCount) {
            var firstIndex =
                measurementCount > recentMeasurementsLimit
                    ? measurementCount - recentMeasurementsLimit
                    : 0n;
            var measurementRequests = [];

            for (var index = measurementCount; index > firstIndex; index--) {
                measurementRequests.push(
                    contract.getMeasurement(deviceAddress, index - 1n)
                );
            }

            return Promise.all(measurementRequests).then(function (measurements) {
                return {
                    measurements: measurements,
                    totalCount: measurementCount
                };
            });
        })
        .then(showRecentMeasurements)
        .catch(showRecentMeasurementsError);
}

function showRecentMeasurements(result) {
    var status = document.getElementById("recentMeasurementsStatus");
    var tableContainer = document.getElementById("measurementsTableContainer");
    var tableBody = document.getElementById("recentMeasurementsBody");
    var measurements = result.measurements;

    if (measurements.length === 0) {
        status.textContent = "Nessuna misurazione disponibile";
        tableContainer.hidden = true;
        return;
    }

    measurements.forEach(function (measurement) {
        var row = document.createElement("tr");
        var dataHash = measurement[4];

        appendMeasurementCell(row, measurement[0].toString());
        appendMeasurementCell(row, formatTimestamp(measurement[1]));
        appendMeasurementCell(row, formatTimestamp(measurement[2]));
        appendMeasurementCell(row, measurement[3].toString());
        appendMeasurementCell(row, abbreviateHash(dataHash), dataHash);

        tableBody.appendChild(row);
    });

    status.textContent =
        "Mostrate " +
        measurements.length +
        " misurazioni su " +
        result.totalCount.toString() +
        ", dalla più recente.";
    tableContainer.hidden = false;
}

function appendMeasurementCell(row, text, title) {
    var cell = document.createElement("td");

    cell.textContent = text;

    if (title !== undefined) {
        cell.title = title;
    }

    row.appendChild(cell);
}

function formatTimestamp(timestamp) {
    var timestampNumber = Number(timestamp);

    if (timestampNumber === 0) {
        return "-";
    }

    return new Date(timestampNumber * 1000).toLocaleString("it-IT");
}

function abbreviateHash(dataHash) {
    return dataHash.slice(0, 10) + "..." + dataHash.slice(-6);
}

function showRecentMeasurementsError(error) {
    console.log(error);

    document.getElementById("recentMeasurementsStatus").textContent =
        "Errore durante la lettura delle misurazioni";
    document.getElementById("measurementsTableContainer").hidden = true;
    document.getElementById("recentMeasurementsBody").replaceChildren();
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

document
    .getElementById("getRecentMeasurementsButton")
    .addEventListener("click", getRecentMeasurements);


