#!/usr/bin/env python3

import csv
import os
import statistics
import tempfile
from collections import defaultdict
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
EXPERIMENTS_DIR = REPO_ROOT / "experiments"
DATA_DIR = EXPERIMENTS_DIR / "data"
PLOTS_DIR = EXPERIMENTS_DIR / "plots"
RESULTS_DIR = EXPERIMENTS_DIR / "results"

BASELINE_CSV = DATA_DIR / "performance-baseline-anvil-vs-sepolia.csv"
STORAGE_CSV = DATA_DIR / "performance-storage-modes.csv"
BATCH_CANDIDATES = [
    DATA_DIR / "performance-batch-vs-single.csv",
    DATA_DIR / "batch-vs-single.csv",
    RESULTS_DIR / "performance-batch-vs-single.csv",
]

NUMERIC_COLUMNS = [
    "gasUsed",
    "feeEth",
    "calldataBytes",
    "confirmationLatencyMs",
    "txSubmitLatencyMs",
    "middlewareTotalLatencyMs",
    "deviceToBlockLatencySeconds",
    "batchSize",
]

REQUIRED_COLUMNS = {
    "experiment",
    "network",
    "storageMode",
    "batchSize",
    "measurementIndex",
    "txType",
    "isInitializationTx",
    "gasUsed",
    "feeEth",
    "calldataBytes",
}


def main():
    configure_matplotlib_cache()
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    PLOTS_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    summary_rows = []

    baseline_rows = load_normalized_csv(BASELINE_CSV)
    storage_rows = load_normalized_csv(STORAGE_CSV)
    batch_file = find_batch_csv()
    batch_rows = load_normalized_csv(batch_file) if batch_file else []

    ordinary_baseline_rows = filter_ordinary_rows(baseline_rows)
    ordinary_storage_rows = filter_ordinary_rows(storage_rows)
    ordinary_batch_rows = filter_ordinary_rows(batch_rows)

    print_dataset_status("baseline", BASELINE_CSV, baseline_rows, ordinary_baseline_rows)
    print_dataset_status("storage modes", STORAGE_CSV, storage_rows, ordinary_storage_rows)
    if batch_file:
        print_dataset_status("batch-vs-single", batch_file, batch_rows, ordinary_batch_rows)
    else:
        print("Batch-vs-single: nessun CSV normalizzato trovato, grafici batch saltati.")

    plot_bar_mean(
        plt=plt,
        rows=ordinary_baseline_rows,
        group_column="network",
        metric_column="gasUsed",
        output_file=PLOTS_DIR / "gas-used-by-network.png",
        title="Gas medio per rete",
        xlabel="Rete",
        ylabel="Gas usato",
        summary_rows=summary_rows,
        dataset="baseline-by-network",
    )
    plot_bar_mean(
        plt=plt,
        rows=ordinary_baseline_rows,
        group_column="network",
        metric_column="feeEth",
        output_file=PLOTS_DIR / "fee-eth-by-network.png",
        title="Fee media per rete",
        xlabel="Rete",
        ylabel="Fee media (ETH)",
        summary_rows=summary_rows,
        dataset="baseline-by-network",
    )
    plot_bar_mean(
        plt=plt,
        rows=ordinary_storage_rows,
        group_column="storageMode",
        metric_column="gasUsed",
        output_file=PLOTS_DIR / "gas-used-by-storage-mode.png",
        title="Gas medio per modalita' di storage",
        xlabel="Modalita' di storage",
        ylabel="Gas usato",
        summary_rows=summary_rows,
        dataset="storage-modes",
    )
    plot_bar_mean(
        plt=plt,
        rows=ordinary_storage_rows,
        group_column="storageMode",
        metric_column="feeEth",
        output_file=PLOTS_DIR / "fee-eth-by-storage-mode.png",
        title="Fee media per modalita' di storage",
        xlabel="Modalita' di storage",
        ylabel="Fee media (ETH)",
        summary_rows=summary_rows,
        dataset="storage-modes",
    )
    plot_bar_mean(
        plt=plt,
        rows=ordinary_storage_rows,
        group_column="storageMode",
        metric_column="calldataBytes",
        output_file=PLOTS_DIR / "calldata-by-storage-mode.png",
        title="Calldata media per modalita' di storage",
        xlabel="Modalita' di storage",
        ylabel="Calldata (byte)",
        summary_rows=summary_rows,
        dataset="storage-modes",
    )

    plot_latency_by_network(plt, ordinary_baseline_rows, summary_rows)

    if ordinary_batch_rows:
        add_derived_per_measurement_metrics(ordinary_batch_rows)
        plot_bar_mean(
            plt=plt,
            rows=ordinary_batch_rows,
            group_column="batchSize",
            metric_column="gasPerMeasurement",
            output_file=PLOTS_DIR / "gas-per-measurement-batch-vs-single.png",
            title="Gas medio per misura: single vs batch",
            xlabel="Batch size",
            ylabel="Gas per misura",
            summary_rows=summary_rows,
            dataset="batch-vs-single",
        )
        plot_bar_mean(
            plt=plt,
            rows=ordinary_batch_rows,
            group_column="batchSize",
            metric_column="feeEthPerMeasurement",
            output_file=PLOTS_DIR / "fee-per-measurement-batch-vs-single.png",
            title="Fee media per misura: single vs batch",
            xlabel="Batch size",
            ylabel="Fee per misura (ETH)",
            summary_rows=summary_rows,
            dataset="batch-vs-single",
        )
        plot_bar_mean(
            plt=plt,
            rows=ordinary_batch_rows,
            group_column="batchSize",
            metric_column="deviceToBlockLatencySeconds",
            output_file=PLOTS_DIR / "device-to-block-latency-batch-vs-single.png",
            title="Latenza device-to-block: single vs batch",
            xlabel="Batch size",
            ylabel="Secondi",
            summary_rows=summary_rows,
            dataset="batch-vs-single",
        )

    write_summary(summary_rows, RESULTS_DIR / "summary.md")
    print(f"Riepilogo scritto in {RESULTS_DIR / 'summary.md'}")


def configure_matplotlib_cache():
    cache_dir = Path(tempfile.gettempdir()) / "iot-blockchain-matplotlib"
    cache_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("MPLCONFIGDIR", str(cache_dir))


def load_normalized_csv(path):
    if not path or not path.exists():
        return []

    with path.open(newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        fieldnames = set(reader.fieldnames or [])
        missing_columns = REQUIRED_COLUMNS - fieldnames
        if missing_columns:
            print(
                f"{path}: schema non normalizzato, colonne mancanti: "
                f"{', '.join(sorted(missing_columns))}. File saltato."
            )
            return []

        rows = []
        for row in reader:
            normalized_row = dict(row)
            for column in NUMERIC_COLUMNS:
                normalized_row[column] = parse_float(row.get(column))
            rows.append(normalized_row)
        return rows


def find_batch_csv():
    for candidate in BATCH_CANDIDATES:
        if candidate.exists():
            rows = load_normalized_csv(candidate)
            if rows:
                return candidate
    return None


def filter_ordinary_rows(rows):
    return [
        row
        for row in rows
        if str(row.get("isInitializationTx", "")).strip().lower() == "false"
    ]


def parse_float(value):
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def group_numeric_values(rows, group_column, metric_column):
    groups = defaultdict(list)
    for row in rows:
        value = row.get(metric_column)
        group = row.get(group_column)
        if value is None or group is None or str(group).strip() == "":
            continue
        groups[format_group_label(group)].append(value)
    return dict(sorted(groups.items(), key=lambda item: item[0]))


def format_group_label(value):
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def plot_bar_mean(
    *,
    plt,
    rows,
    group_column,
    metric_column,
    output_file,
    title,
    xlabel,
    ylabel,
    summary_rows,
    dataset,
):
    grouped_values = group_numeric_values(rows, group_column, metric_column)
    grouped_values = {
        group: values for group, values in grouped_values.items() if len(values) > 0
    }

    if not grouped_values:
        print(f"{output_file.name}: dati insufficienti per {metric_column}. Grafico saltato.")
        return

    labels = list(grouped_values.keys())
    means = [statistics.mean(grouped_values[label]) for label in labels]

    fig, ax = plt.subplots(figsize=(8, 4.8))
    ax.bar(labels, means, color="#3867d6")
    ax.set_title(title)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.grid(axis="y", linestyle="--", alpha=0.35)
    ax.tick_params(axis="x", rotation=20)
    fig.tight_layout()
    fig.savefig(output_file, dpi=160)
    plt.close(fig)
    print(f"Grafico scritto: {output_file}")

    for group, values in grouped_values.items():
        summary_rows.append(
            {
                "dataset": dataset,
                "group": group,
                "metric": metric_column,
                "count": len(values),
                "mean": statistics.mean(values),
                "min": min(values),
                "max": max(values),
            }
        )


def plot_latency_by_network(plt, rows, summary_rows):
    latency_columns = [
        "txSubmitLatencyMs",
        "confirmationLatencyMs",
        "middlewareTotalLatencyMs",
        "deviceToBlockLatencySeconds",
    ]

    available_columns = []
    for column in latency_columns:
        groups = group_numeric_values(rows, "network", column)
        groups = {group: values for group, values in groups.items() if values}
        if len(groups) >= 2:
            available_columns.append((column, groups))

    if not available_columns:
        print(
            "latency-by-network.png: dati di latenza insufficienti per confrontare "
            "almeno due reti. Grafico saltato."
        )
        return

    labels = sorted({group for _, groups in available_columns for group in groups})
    x_positions = list(range(len(labels)))
    bar_width = 0.8 / len(available_columns)

    fig, ax = plt.subplots(figsize=(9, 5))
    for index, (column, groups) in enumerate(available_columns):
        means = [
            statistics.mean(groups[label]) if label in groups else 0
            for label in labels
        ]
        offsets = [
            position - 0.4 + bar_width / 2 + index * bar_width
            for position in x_positions
        ]
        ax.bar(offsets, means, width=bar_width, label=column)

        for group, values in groups.items():
            summary_rows.append(
                {
                    "dataset": "baseline-latency-by-network",
                    "group": group,
                    "metric": column,
                    "count": len(values),
                    "mean": statistics.mean(values),
                    "min": min(values),
                    "max": max(values),
                }
            )

    ax.set_title("Latenza media per rete")
    ax.set_xlabel("Rete")
    ax.set_ylabel("Latenza")
    ax.set_xticks(x_positions)
    ax.set_xticklabels(labels)
    ax.grid(axis="y", linestyle="--", alpha=0.35)
    ax.legend()
    fig.tight_layout()
    output_file = PLOTS_DIR / "latency-by-network.png"
    fig.savefig(output_file, dpi=160)
    plt.close(fig)
    print(f"Grafico scritto: {output_file}")


def add_derived_per_measurement_metrics(rows):
    for row in rows:
        batch_size = row.get("batchSize") or 1
        if batch_size == 0:
            batch_size = 1
        row["gasPerMeasurement"] = safe_divide(row.get("gasUsed"), batch_size)
        row["feeEthPerMeasurement"] = safe_divide(row.get("feeEth"), batch_size)


def safe_divide(value, divisor):
    if value is None or divisor is None or divisor == 0:
        return None
    return value / divisor


def print_dataset_status(label, path, all_rows, ordinary_rows):
    print(
        f"{label}: {path} - righe totali={len(all_rows)}, "
        f"righe ordinarie usate={len(ordinary_rows)}"
    )


def write_summary(rows, path):
    rows = sorted(
        rows,
        key=lambda row: (row["dataset"], row["metric"], row["group"]),
    )

    with path.open("w", encoding="utf-8") as summary_file:
        summary_file.write("# Riepilogo esperimenti\n\n")
        summary_file.write(
            "I valori seguenti sono calcolati escludendo le righe con "
            "`isInitializationTx=true`.\n\n"
        )
        summary_file.write("| Dataset | Gruppo | Metrica | N | Media | Min | Max |\n")
        summary_file.write("| --- | --- | --- | ---: | ---: | ---: | ---: |\n")
        for row in rows:
            summary_file.write(
                "| {dataset} | {group} | {metric} | {count} | {mean} | {min} | {max} |\n".format(
                    dataset=row["dataset"],
                    group=row["group"],
                    metric=row["metric"],
                    count=row["count"],
                    mean=format_number(row["mean"]),
                    min=format_number(row["min"]),
                    max=format_number(row["max"]),
                )
            )


def format_number(value):
    if value is None:
        return ""
    if abs(value) >= 1000:
        return f"{value:.2f}"
    if value == 0:
        return "0"
    if abs(value) < 0.0001:
        return f"{value:.10f}".rstrip("0").rstrip(".")
    return f"{value:.6f}".rstrip("0").rstrip(".")


if __name__ == "__main__":
    main()
