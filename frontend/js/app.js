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



document
    .getElementById("connectButton")
    .addEventListener("click", connectWallet);

document
    .getElementById("getOwnerButton")
    .addEventListener("click", getOwner);





