from __future__ import annotations

import argparse
import glob
import json
import math
import os
import re
import sys
from typing import Any

import numpy as np
import pandas as pd

TREND_KEYS = {
    "Avg_Latency_ms": "avg",
    "Min_Latency_ms": "min",
    "P50_ms": "med",
    "P90_ms": "p(90)",
    "P95_ms": "p(95)",
    "P99_ms": "p(99)",
    "Max_Latency_ms": "max",
}


def numeric(value: Any) -> float:
    """Convert a finite numeric value to float, otherwise NaN."""
    if value is None or isinstance(value, bool):
        return np.nan
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return np.nan
    return parsed if math.isfinite(parsed) else np.nan


def metric_values(metrics: dict[str, Any], name: str) -> dict[str, Any]:
    metric = metrics.get(name)
    if not isinstance(metric, dict):
        return {}
    values = metric.get("values", {})
    return values if isinstance(values, dict) else {}


def get_stat(metrics: dict[str, Any], metric_name: str, stat: str) -> float:
    return numeric(metric_values(metrics, metric_name).get(stat))


def parse_filename(filename: str) -> tuple[float, float]:
    vus_match = re.search(r"(?:^|[_-])vus[_-]?(\d+)", filename, re.IGNORECASE)
    trial_match = re.search(r"(?:^|[_-])trial[_-]?(\d+)", filename, re.IGNORECASE)
    vus = float(vus_match.group(1)) if vus_match else np.nan
    trial = float(trial_match.group(1)) if trial_match else np.nan
    return vus, trial


def pct(rate: float) -> float:
    return rate * 100 if np.isfinite(rate) else np.nan


def load_result(filepath: str) -> dict[str, Any] | None:
    filename = os.path.basename(filepath)
    if re.search(r"dry[_-]?run|warm[_-]?up|warmup", filename, re.IGNORECASE):
        print(f"[INFO] Excluding pilot/warm-up file: {filename}")
        return None

    try:
        with open(filepath, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"[WARNING] Skipping {filename}: {exc}")
        return None

    if not isinstance(data, dict) or not isinstance(data.get("metrics"), dict):
        print(f"[WARNING] Skipping {filename}: no k6 metrics object")
        return None

    metrics = data["metrics"]
    metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
    filename_vus, filename_trial = parse_filename(filename)

    vus = numeric(metadata.get("configured_vus"))
    if not np.isfinite(vus):
        vus = filename_vus
    trial = numeric(metadata.get("trial"))
    if not np.isfinite(trial):
        trial = filename_trial

    scenario_id = str(metadata.get("scenario_id") or "")
    # Trial 0 is reserved for dry runs/pilots in this project. Exclude it even
    # when the filename itself does not contain "dryrun" or "warmup".
    if re.search(r"dry[_-]?run|warm[_-]?up|warmup", scenario_id, re.IGNORECASE):
        print(f"[INFO] Excluding pilot/warm-up scenario: {filename}")
        return None
    if np.isfinite(trial) and int(trial) == 0:
        print(f"[INFO] Excluding trial 0 (pilot/dry run): {filename}")
        return None

    environment = (
        data.get("environment") if isinstance(data.get("environment"), dict) else {}
    )
    device = (
        environment.get("device") if isinstance(environment.get("device"), dict) else {}
    )
    resource_summary = (
        environment.get("resource_summary")
        if isinstance(environment.get("resource_summary"), dict)
        else {}
    )

    row: dict[str, Any] = {
        "File": filename,
        "Device_Label": device.get("device_label"),
        "OS_System": device.get("os_system"),
        "OS_Release": device.get("os_release"),
        "Architecture": device.get("architecture"),
        "CPU_Model": device.get("cpu_model"),
        "Logical_CPU_Count": numeric(device.get("logical_cpu_count")),
        "Physical_CPU_Count": numeric(device.get("physical_cpu_count")),
        "Total_Memory_bytes": numeric(device.get("total_memory_bytes")),
        "Environment_Sample_Count": numeric(resource_summary.get("sample_count")),
        "System_CPU_Max_Sampled_pct": numeric(
            resource_summary.get("system_cpu_percent_max_sampled")
        ),
        "System_Memory_Max_Sampled_pct": numeric(
            resource_summary.get("system_memory_percent_max_sampled")
        ),
        "K6_Process_CPU_Max_Sampled_pct": numeric(
            resource_summary.get("k6_process_cpu_percent_max_sampled")
        ),
        "K6_Process_RSS_Max_Sampled_bytes": numeric(
            resource_summary.get("k6_process_rss_bytes_max_sampled")
        ),
        "Environment_Sampling_Interval_s": numeric(
            environment.get("sampling_interval_seconds")
        ),
        "Experiment_ID": metadata.get("experiment_id"),
        "Scenario_ID": metadata.get("scenario_id"),
        "VUs": vus,
        "Trial": trial,
        "Run_Started_UTC": metadata.get("run_started_at_utc"),
        "Run_Ended_UTC": metadata.get("run_ended_at_utc"),
        "Measured_Duration_ms": numeric(metadata.get("measured_duration_ms")),
        "Configured_Duration": metadata.get("configured_duration"),
        "Workload_Model": metadata.get("workload_model"),
        "Think_Time_s": numeric(metadata.get("think_time_seconds")),
        "Target_Origin": metadata.get("target_origin"),
        "K6_Version": metadata.get("k6_version"),
        "Git_Commit": metadata.get("git_commit"),
        "Runner": metadata.get("runner"),
        "Run_Exit_Status": metadata.get("run_exit_status"),
    }

    duration = metrics.get("http_req_duration", {})  # noqa: F841
    duration_values = metric_values(metrics, "http_req_duration")
    for column, key in TREND_KEYS.items():
        row[column] = numeric(duration_values.get(key))

    requests = metric_values(metrics, "http_reqs")
    failed = metric_values(metrics, "http_req_failed")
    checks = metric_values(metrics, "checks")
    iterations = metric_values(metrics, "iterations")
    dropped = metric_values(metrics, "dropped_iterations")
    vus_metric = metric_values(metrics, "vus")
    vus_max_metric = metric_values(metrics, "vus_max")

    row.update(
        {
            "Total_Requests": numeric(requests.get("count")),
            "RPS": numeric(requests.get("rate")),
            "HTTP_Failed_Rate_pct": pct(numeric(failed.get("rate"))),
            "HTTP_Success_Rate_pct": pct(1 - numeric(failed.get("rate")))
            if np.isfinite(numeric(failed.get("rate")))
            else np.nan,
            "HTTP_Failed_Count": numeric(failed.get("fails")),
            "HTTP_Passed_Count": numeric(failed.get("passes")),
            "Check_Success_Rate_pct": pct(numeric(checks.get("rate"))),
            "Check_Passed_Count": numeric(checks.get("passes")),
            "Check_Failed_Count": numeric(checks.get("fails")),
            "Iterations": numeric(iterations.get("count")),
            "Iteration_Rate_per_s": numeric(iterations.get("rate")),
            "Dropped_Iterations": numeric(dropped.get("count")),
            "Observed_VUs_Mean": numeric(vus_metric.get("value")),
            "Observed_VUs_Max": numeric(vus_max_metric.get("value")),
            "Workflow_Completed": numeric(
                metric_values(metrics, "workflow_completed").get("count")
            ),
            "Workflow_Failed": numeric(
                metric_values(metrics, "workflow_failed").get("count")
            ),
            "Workflow_Success_Rate_pct": pct(
                numeric(metric_values(metrics, "workflow_success_rate").get("rate"))
            ),
            "Workflow_Duration_Avg_ms": get_stat(metrics, "workflow_duration", "avg"),
            "Workflow_Duration_P50_ms": get_stat(metrics, "workflow_duration", "med"),
            "Workflow_Duration_P95_ms": get_stat(metrics, "workflow_duration", "p(95)"),
            "Workflow_Duration_P99_ms": get_stat(metrics, "workflow_duration", "p(99)"),
            "HTTP_Blocked_Avg_ms": get_stat(metrics, "http_req_blocked", "avg"),
            "HTTP_Connecting_Avg_ms": get_stat(metrics, "http_req_connecting", "avg"),
            "HTTP_Connecting_P95_ms": get_stat(metrics, "http_req_connecting", "p(95)"),
            "HTTP_TLS_Avg_ms": get_stat(metrics, "http_req_tls_handshaking", "avg"),
            "HTTP_Sending_Avg_ms": get_stat(metrics, "http_req_sending", "avg"),
            "HTTP_Waiting_Avg_ms": get_stat(metrics, "http_req_waiting", "avg"),
            "HTTP_Waiting_P50_ms": get_stat(metrics, "http_req_waiting", "med"),
            "HTTP_Waiting_P95_ms": get_stat(metrics, "http_req_waiting", "p(95)"),
            "HTTP_Waiting_P99_ms": get_stat(metrics, "http_req_waiting", "p(99)"),
            "HTTP_Receiving_Avg_ms": get_stat(metrics, "http_req_receiving", "avg"),
            "Iteration_Duration_Avg_ms": get_stat(metrics, "iteration_duration", "avg"),
            "Iteration_Duration_P95_ms": get_stat(
                metrics, "iteration_duration", "p(95)"
            ),
            "Iteration_Duration_P99_ms": get_stat(
                metrics, "iteration_duration", "p(99)"
            ),
            "Data_Sent_bytes": numeric(
                metric_values(metrics, "data_sent").get("count")
            ),
            "Data_Received_bytes": numeric(
                metric_values(metrics, "data_received").get("count")
            ),
            "Run_Status": "summary_present",
        }
    )

    # Missing p99 is a data-quality warning, not a measured zero.
    if not np.isfinite(row["P99_ms"]):
        row["Run_Status"] = "check_missing_p99"
        print(f"[WARNING] {filename}: p99 is missing; it will remain NA.")
    if not np.isfinite(vus):
        row["Run_Status"] = "check_missing_vus"
        print(f"[WARNING] {filename}: VU level unavailable from metadata/filename.")
    if numeric(row["Total_Requests"]) <= 0:
        row["Run_Status"] = "check_no_requests"
        print(f"[WARNING] {filename}: zero or missing HTTP request count.")

    return row


def sample_sd(series: pd.Series) -> float:
    values = series.dropna()
    return float(values.std(ddof=1)) if len(values) >= 2 else np.nan


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--results-dir",
        default="k6/snapshot/results",
        help="Directory containing FORMAL k6 summary JSON files (non-recursive; dryrun/ and warmup/ subfolders are not scanned)",
    )
    parser.add_argument(
        "--baseline-vus",
        type=int,
        default=10,
        help="Baseline VU level for descriptive relative-throughput indicators (default: 10)",
    )
    args = parser.parse_args()

    files = sorted(glob.glob(os.path.join(args.results_dir, "*_summary.json")))
    # Backward compatibility: if no standardized summary names exist, try JSON files.
    if not files:
        files = sorted(glob.glob(os.path.join(args.results_dir, "*.json")))
    if not files:
        raise SystemExit(f"[ERROR] No JSON summary files found in {args.results_dir}/")

    rows = [row for path in files if (row := load_result(path)) is not None]
    if not rows:
        raise SystemExit("[ERROR] No usable k6 summary results found.")

    df = pd.DataFrame(rows).sort_values(["VUs", "Trial", "File"], na_position="last")
    os.makedirs(args.results_dir, exist_ok=True)
    raw_path = os.path.join(args.results_dir, "all_trials.csv")
    df.to_csv(raw_path, index=False, na_rep="NA")

    valid = df.dropna(subset=["VUs"]).copy()
    valid["VUs"] = valid["VUs"].astype(int)
    if valid.empty:
        raise SystemExit(
            "[ERROR] No runs have a recognized VU level; use metadata or filenames such as student_vus_10_trial_1_summary.json."
        )

    numeric_metrics = [
        "Avg_Latency_ms",
        "Min_Latency_ms",
        "P50_ms",
        "P90_ms",
        "P95_ms",
        "P99_ms",
        "Max_Latency_ms",
        "RPS",
        "Total_Requests",
        "HTTP_Success_Rate_pct",
        "HTTP_Failed_Rate_pct",
        "Check_Success_Rate_pct",
        "Workflow_Success_Rate_pct",
        "Workflow_Completed",
        "Workflow_Failed",
        "Workflow_Duration_Avg_ms",
        "Workflow_Duration_P50_ms",
        "Workflow_Duration_P95_ms",
        "Workflow_Duration_P99_ms",
        "Iterations",
        "Iteration_Rate_per_s",
        "Dropped_Iterations",
        "Observed_VUs_Max",
        "HTTP_Blocked_Avg_ms",
        "HTTP_Connecting_Avg_ms",
        "HTTP_Connecting_P95_ms",
        "HTTP_TLS_Avg_ms",
        "HTTP_Sending_Avg_ms",
        "HTTP_Waiting_Avg_ms",
        "HTTP_Waiting_P50_ms",
        "HTTP_Waiting_P95_ms",
        "HTTP_Waiting_P99_ms",
        "HTTP_Receiving_Avg_ms",
        "Iteration_Duration_Avg_ms",
        "Iteration_Duration_P95_ms",
        "Iteration_Duration_P99_ms",
        "Data_Sent_bytes",
        "Data_Received_bytes",
    ]
    agg_spec: dict[str, tuple[str, Any]] = {}
    for column in numeric_metrics:
        if column in valid.columns:
            agg_spec[f"{column}_Mean"] = (column, "mean")
            agg_spec[f"{column}_SD"] = (column, sample_sd)
    agg_spec["Trials_Included"] = ("Trial", "count")
    agg_spec["Distinct_Trial_IDs"] = ("Trial", "nunique")

    summary = (
        valid.groupby("VUs", dropna=True)
        .agg(**agg_spec)
        .reset_index()
        .sort_values("VUs")
    )
    summary["Repeated_Trials_Expected"] = 3
    summary["Trial_Count_Check"] = np.where(
        summary["Distinct_Trial_IDs"] == 3,
        "3 trials found",
        "CHECK: expected 3 distinct trials",
    )

    # Descriptive indicators only. Baseline is the lowest approved workload (10 VUs),
    # not the prior 5-VU pilot, unless explicitly overridden.
    baseline_rows = summary.loc[summary["VUs"] == args.baseline_vus, "RPS_Mean"]
    if (
        not baseline_rows.empty
        and np.isfinite(baseline_rows.iloc[0])
        and baseline_rows.iloc[0] > 0
    ):
        baseline_rps = float(baseline_rows.iloc[0])
        summary["Throughput_Scaling_Efficiency_pct"] = (
            (summary["RPS_Mean"] / baseline_rps)
            / (summary["VUs"] / args.baseline_vus)
            * 100
        )
        summary["RPS_per_VU"] = summary["RPS_Mean"] / summary["VUs"]
        summary["Throughput_Gain_pct"] = summary["RPS_Mean"].pct_change() * 100
        summary["Baseline_VUs"] = args.baseline_vus
        summary["Baseline_RPS_Mean"] = baseline_rps
    else:
        summary["Throughput_Scaling_Efficiency_pct"] = np.nan
        summary["RPS_per_VU"] = summary["RPS_Mean"] / summary["VUs"]
        summary["Throughput_Gain_pct"] = summary["RPS_Mean"].pct_change() * 100
        summary["Baseline_VUs"] = args.baseline_vus
        summary["Baseline_RPS_Mean"] = np.nan
        print(
            f"[WARNING] No positive RPS mean found at baseline {args.baseline_vus} VUs; scaling efficiency remains NA."
        )

    summary = summary.round(3)
    summary_path = os.path.join(args.results_dir, "chapter4_summary.csv")
    summary.to_csv(summary_path, index=False, na_rep="NA")

    print("\nINDIVIDUAL TRIAL RESULTS")
    print(df.to_string(index=False, na_rep="NA"))
    print("\nAGGREGATED CHARACTERIZATION SUMMARY (MEAN AND SAMPLE SD)")
    print(summary.to_string(index=False, na_rep="NA"))
    print(
        "\nInterpretation note: relative-throughput indicators are descriptive only; they do not establish maximum capacity or prove scalability."
    )
    print("\n[SUCCESS] Saved:")
    print(f" - {raw_path}")
    print(f" - {summary_path}")

    missing = df[df["Run_Status"] != "summary_present"]
    if not missing.empty:
        print(
            f"\n[WARNING] {len(missing)} run(s) need data-quality review; see Run_Status in all_trials.csv."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
