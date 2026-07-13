#!/usr/bin/env python3

import csv
import json
import re
import urllib.error
import urllib.request
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
EXPERIMENTS_DIR = REPO_ROOT / "experiments"
DATA_DIR = EXPERIMENTS_DIR / "data"
BATCH_LOG_DIR = EXPERIMENTS_DIR / "logs" / "batch-vs-single"
RAW_ROOT = EXPERIMENTS_DIR / "raw" / "batch-vs-single" / "sepolia"
OUTPUT_CSV = DATA_DIR / "performance-batch-vs-single.csv"
SEPOLIA_ENV = REPO_ROOT / "middleware" / ".env.sepolia"

SINGLE_ESP32_LOG = BATCH_LOG_DIR / "s1-single-esp32.log"
SINGLE_MIDDLEWARE_LOG = BATCH_LOG_DIR / "s1-single-middleware.log"
BATCH_ESP32_LOG = BATCH_LOG_DIR / "b5-batch-esp32.log"
BATCH_MIDDLEWARE_LOG = BATCH_LOG_DIR / "b5-batch-middleware.log"

SEND_INTERVAL_SECONDS = "10"
MEASUREMENT_RECORDED_TOPIC = (
    "0x1b84affd327a8570c66a7eb2f54ce5068f35e1bff9c47e26ae2e67650a933844"
)

HEADER = [
    "experiment",
    "network",
    "storageMode",
    "batchSize",
    "sendIntervalSeconds",
    "measurementIndex",
    "txType",
    "isInitializationTx",
    "txHash",
    "blockNumber",
    "status",
    "gasUsed",
    "effectiveGasPriceWei",
    "feeWei",
    "feeEth",
    "requestBodyBytes",
    "calldataBytes",
    "txSubmitLatencyMs",
    "confirmationLatencyMs",
    "middlewareTotalLatencyMs",
    "deviceToBlockLatencySeconds",
    "logsCount",
    "notes",
]


def main():
    rpc_url = read_env_value(SEPOLIA_ENV, "RPC_URL")
    if not rpc_url:
        raise SystemExit(f"RPC_URL non trovato in {SEPOLIA_ENV}")

    single_device_timestamps = parse_device_timestamps_by_nonce(SINGLE_ESP32_LOG)
    batch_device_timestamps = parse_device_timestamps_by_nonce(BATCH_ESP32_LOG)
    single_entries = parse_single_confirmations(SINGLE_MIDDLEWARE_LOG)
    batch_entries = parse_batch_confirmations(BATCH_MIDDLEWARE_LOG)

    print(f"Single tx trovate: {len(single_entries)}")
    print(f"Batch tx trovate: {len(batch_entries)}")

    rpc = JsonRpcClient(rpc_url)
    rows = []

    for index, entry in enumerate(single_entries, start=1):
        device_timestamp = single_device_timestamps.get(entry["nonce"])
        rows.append(
            build_row(
                rpc=rpc,
                entry=entry,
                measurement_index=index,
                storage_mode="array",
                batch_size=1,
                tx_type="recordSingle",
                device_timestamp=device_timestamp,
                raw_group="single",
            )
        )

    for index, entry in enumerate(batch_entries, start=1):
        device_timestamp = batch_device_timestamps.get(entry["lastNonce"])
        rows.append(
            build_row(
                rpc=rpc,
                entry=entry,
                measurement_index=index,
                storage_mode="batch",
                batch_size=entry["batchSize"],
                tx_type="recordBatch",
                device_timestamp=device_timestamp,
                raw_group="batch",
            )
        )

    write_csv(rows)
    print(f"CSV scritto: {OUTPUT_CSV}")
    print(f"Raw JSON salvati in: {RAW_ROOT}")


def build_row(
    *,
    rpc,
    entry,
    measurement_index,
    storage_mode,
    batch_size,
    tx_type,
    device_timestamp,
    raw_group,
):
    tx_hash = entry["txHash"]
    receipt = rpc.call("eth_getTransactionReceipt", [tx_hash])
    tx = rpc.call("eth_getTransactionByHash", [tx_hash])

    if receipt is None:
        raise RuntimeError(f"Receipt non trovato per {tx_hash}")
    if tx is None:
        raise RuntimeError(f"Transazione non trovata per {tx_hash}")

    block_number = hex_to_int(receipt.get("blockNumber"))
    block = rpc.call("eth_getBlockByNumber", [receipt.get("blockNumber"), False])
    block_timestamp = hex_to_int(block.get("timestamp")) if block else None

    save_raw_json(raw_group, "receipts", measurement_index, receipt)
    save_raw_json(raw_group, "txs", measurement_index, tx)
    save_raw_json(raw_group, "blocks", measurement_index, block)

    gas_used = hex_to_int(receipt.get("gasUsed"))
    effective_gas_price = hex_to_int(receipt.get("effectiveGasPrice") or tx.get("gasPrice"))
    fee_wei = gas_used * effective_gas_price
    calldata_bytes = get_calldata_bytes(tx.get("input"))
    logs_count = len(receipt.get("logs") or [])
    measurement_latencies = extract_measurement_latencies(receipt)
    device_to_block_latency = ""
    notes = ""

    if measurement_latencies:
        device_to_block_latency = format_decimal(
            sum(measurement_latencies) / len(measurement_latencies)
        )
        if len(measurement_latencies) > 1:
            notes = (
                "latenza device-to-block media delle misure incluse nel batch, "
                "ricavata dagli eventi on-chain"
            )
    elif device_timestamp is not None and block_timestamp is not None:
        device_to_block_latency = str(block_timestamp - device_timestamp)
    else:
        notes = (
            "timestamp non disponibile negli eventi on-chain o nei log ESP32 "
            "per calcolare deviceToBlockLatencySeconds"
        )

    return {
        "experiment": "batch-vs-single",
        "network": "sepolia",
        "storageMode": storage_mode,
        "batchSize": str(batch_size),
        "sendIntervalSeconds": SEND_INTERVAL_SECONDS,
        "measurementIndex": str(measurement_index),
        "txType": tx_type,
        "isInitializationTx": "false",
        "txHash": tx_hash,
        "blockNumber": str(block_number),
        "status": str(hex_to_int(receipt.get("status"))),
        "gasUsed": str(gas_used),
        "effectiveGasPriceWei": str(effective_gas_price),
        "feeWei": str(fee_wei),
        "feeEth": format_ether(fee_wei),
        "requestBodyBytes": "",
        "calldataBytes": str(calldata_bytes),
        "txSubmitLatencyMs": "",
        "confirmationLatencyMs": "",
        "middlewareTotalLatencyMs": "",
        "deviceToBlockLatencySeconds": device_to_block_latency,
        "logsCount": str(logs_count),
        "notes": notes,
    }


def parse_device_timestamps_by_nonce(path):
    timestamps = {}
    body_pattern = re.compile(r"Body JSON:\s*(\{.*\})")

    for line in read_text_lossy(path).splitlines():
        match = body_pattern.search(line)
        if not match:
            continue
        payload = json.loads(match.group(1))
        timestamps[int(payload["nonce"])] = int(payload["deviceTimestamp"])

    return timestamps


def parse_single_confirmations(path):
    pattern = re.compile(
        r"Transazione confermata:\s+"
        r"(?P<txHash>0x[a-fA-F0-9]{64})\s+"
        r"block=(?P<blockNumber>\d+)\s+"
        r"device=(?P<deviceAddress>0x[a-fA-F0-9]{40})\s+"
        r"nonce=(?P<nonce>\d+)"
    )
    entries = []

    for line in read_text_lossy(path).splitlines():
        match = pattern.search(line)
        if not match:
            continue
        entries.append(
            {
                "txHash": match.group("txHash"),
                "blockNumber": int(match.group("blockNumber")),
                "deviceAddress": match.group("deviceAddress"),
                "nonce": int(match.group("nonce")),
            }
        )

    return entries


def parse_batch_confirmations(path):
    pattern = re.compile(
        r"Transazione batch confermata:\s+"
        r"(?P<txHash>0x[a-fA-F0-9]{64})\s+"
        r"block=(?P<blockNumber>\d+)\s+"
        r"device=(?P<deviceAddress>0x[a-fA-F0-9]{40})\s+"
        r"batchSize=(?P<batchSize>\d+)\s+"
        r"firstNonce=(?P<firstNonce>\d+)\s+"
        r"lastNonce=(?P<lastNonce>\d+)"
    )
    entries = []

    for line in read_text_lossy(path).splitlines():
        match = pattern.search(line)
        if not match:
            continue
        entries.append(
            {
                "txHash": match.group("txHash"),
                "blockNumber": int(match.group("blockNumber")),
                "deviceAddress": match.group("deviceAddress"),
                "batchSize": int(match.group("batchSize")),
                "firstNonce": int(match.group("firstNonce")),
                "lastNonce": int(match.group("lastNonce")),
            }
        )

    return entries


class JsonRpcClient:
    def __init__(self, rpc_url):
        self.rpc_url = rpc_url
        self.next_id = 1

    def call(self, method, params):
        request_body = json.dumps(
            {
                "jsonrpc": "2.0",
                "id": self.next_id,
                "method": method,
                "params": params,
            }
        ).encode("utf-8")
        self.next_id += 1

        request = urllib.request.Request(
            self.rpc_url,
            data=request_body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.URLError as error:
            raise RuntimeError("Errore RPC/network durante il recupero dati Sepolia") from error

        if "error" in payload:
            raise RuntimeError(f"Errore RPC {method}: {payload['error']}")

        return payload.get("result")


def read_env_value(path, key):
    if not path.exists():
        return None

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        name, value = stripped.split("=", 1)
        if name == key:
            return value.strip().strip('"').strip("'")

    return None


def read_text_lossy(path):
    return path.read_text(encoding="utf-8", errors="ignore")


def write_csv(rows):
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)

    with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=HEADER)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def save_raw_json(group, kind, index, payload):
    output_dir = RAW_ROOT / group / kind
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / f"{index}.json"
    output_file.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def hex_to_int(value):
    if value is None:
        return 0
    if isinstance(value, int):
        return value
    text = str(value)
    return int(text, 16) if text.startswith("0x") else int(text)


def get_calldata_bytes(input_data):
    if not isinstance(input_data, str) or not input_data.startswith("0x"):
        return 0
    return max((len(input_data) - 2) // 2, 0)


def extract_measurement_latencies(receipt):
    latencies = []

    for log in receipt.get("logs") or []:
        topics = log.get("topics") or []
        if not topics or str(topics[0]).lower() != MEASUREMENT_RECORDED_TOPIC:
            continue

        data = log.get("data")
        if not isinstance(data, str) or not data.startswith("0x"):
            continue

        encoded = data[2:]
        if len(encoded) < 5 * 64:
            continue

        device_timestamp = int(encoded[64:128], 16)
        blockchain_timestamp = int(encoded[128:192], 16)
        latencies.append(blockchain_timestamp - device_timestamp)

    return latencies


def format_decimal(value):
    if float(value).is_integer():
        return str(int(value))
    return f"{value:.10f}".rstrip("0").rstrip(".")


def format_ether(wei):
    whole = wei // 10**18
    fraction = wei % 10**18
    fraction_text = str(fraction).rjust(18, "0").rstrip("0")
    return str(whole) if not fraction_text else f"{whole}.{fraction_text}"


if __name__ == "__main__":
    main()
