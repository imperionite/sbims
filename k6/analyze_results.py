import json  # noqa: I001
import glob
import os
import re
import pandas as pd
import numpy as np

results = []
files = glob.glob("k6/results/*.json")

if not files:
    print("[ERROR] No JSON files found in k6/results/")
    exit(1)  # noqa: PLR1722


def get_stat(metric_dict, key):
    """Safely extracts a metric whether flattened or nested under 'values'."""
    if not metric_dict:
        return 0.0
    if isinstance(metric_dict, dict):
        if "values" in metric_dict and isinstance(metric_dict["values"], dict):
            return metric_dict["values"].get(key, 0.0) or 0.0
        return metric_dict.get(key, 0.0) or 0.0
    return 0.0


for filepath in files:
    filename = os.path.basename(filepath)
    try:
        with open(filepath, "r") as f:
            data = json.load(f)
    except Exception as e:  # noqa: BLE001
        print(f"Skipping {filename}: {e}")
        continue

    m = data.get("metrics", {})
    if not m:
        continue

    # Extract all numbers from the filename (e.g. summary_vus_75_trial_2.json -> [75, 2])
    digits = re.findall(r"\d+", filename)
    if len(digits) >= 2:
        vus = int(digits[0])
        trial = int(digits[1])
    elif len(digits) == 1:
        vus = int(digits[0])
        trial = 1
    else:
        vus = 0
        trial = 1

    # Latency metrics (convert seconds to milliseconds if needed)
    dur = m.get("http_req_duration", {})
    avg_lat = get_stat(dur, "avg")
    med_lat = get_stat(dur, "med")
    p95_lat = get_stat(dur, "p(95)")
    p99_lat = get_stat(dur, "p(99)")

    # If k6 exported in seconds (e.g. 2.77 instead of 2770), convert to ms
    if avg_lat < 50 and avg_lat > 0:
        avg_lat *= 1000
        med_lat *= 1000
        p95_lat *= 1000
        p99_lat *= 1000

    # Throughput and counts
    reqs = m.get("http_reqs", {})
    req_rate = get_stat(reqs, "rate")
    total_reqs = int(get_stat(reqs, "count"))

    # Failure rate
    failed = m.get("http_req_failed", {})
    err_rate = get_stat(failed, "rate")
    if err_rate <= 1.0 and err_rate > 0:
        err_rate *= 100  # Convert 0.0076 to 0.76%

    # Custom completed workflows
    wf = m.get("workflow_completed", {})
    wf_completed = int(get_stat(wf, "count"))
    if wf_completed == 0 and "iterations" in m:
        wf_completed = int(get_stat(m.get("iterations", {}), "count"))

    results.append(
        {
            "File": filename,
            "VUs": vus,
            "Trial": trial,
            "Avg_Latency_ms": round(avg_lat, 2),
            "P50_ms": round(med_lat, 2),
            "P95_ms": round(p95_lat, 2),
            "P99_ms": round(p99_lat, 2),
            "Throughput_req_s": round(req_rate, 2),
            "Total_Requests": total_reqs,
            "Error_Rate_pct": round(err_rate, 2),
            "Workflows_Completed": wf_completed,
        }
    )

df = pd.DataFrame(results).sort_values(by=["VUs", "Trial"])

print(
    "======================================================================================="
)
print("                               INDIVIDUAL TRIAL RESULTS")
print(
    "======================================================================================="
)
cols = [
    "File",
    "VUs",
    "Trial",
    "Avg_Latency_ms",
    "P50_ms",
    "P95_ms",
    "Throughput_req_s",
    "Error_Rate_pct",
    "Workflows_Completed",
]
print(df[cols].to_string(index=False))

print(
    "\n======================================================================================="
)
print("                   AGGREGATED SUMMARY FOR CHAPTER 4 (MEAN ± STD)")
print(
    "======================================================================================="
)

summary = (
    df.groupby("VUs")
    .agg(
        {
            "Avg_Latency_ms": [
                "mean",
                lambda x: np.nanstd(x, ddof=1) if len(x) > 1 else 0.0,
            ],
            "P95_ms": ["mean", lambda x: np.nanstd(x, ddof=1) if len(x) > 1 else 0.0],
            "Throughput_req_s": [
                "mean",
                lambda x: np.nanstd(x, ddof=1) if len(x) > 1 else 0.0,
            ],
            "Error_Rate_pct": [
                "mean",
                lambda x: np.nanstd(x, ddof=1) if len(x) > 1 else 0.0,
            ],
            "Workflows_Completed": ["mean"],
        }
    )
    .round(2)
)

summary.columns = [
    "Avg_Lat_Mean",
    "Avg_Lat_SD",
    "P95_Mean",
    "P95_SD",
    "Throughput_Mean",
    "Throughput_SD",
    "Error_Rate_Mean",
    "Error_Rate_SD",
    "Wf_Completed_Mean",
]
summary = summary.reset_index()

print(summary.to_string(index=False))

df.to_csv("k6/results/all_trials_raw.csv", index=False)
summary.to_csv("k6/results/chapter4_summary.csv", index=False)
print("\n[SUCCESS] Extracted real metrics to:")
print(" - k6/results/all_trials_raw.csv")
print(" - k6/results/chapter4_summary.csv\n")
