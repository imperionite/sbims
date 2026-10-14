from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

try:
    import psutil
except ImportError as exc:
    raise SystemExit(
        "Missing dependency: install psutil with `python -m pip install psutil`."
    ) from exc


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def static_device_metadata() -> dict[str, Any]:
    vm = psutil.virtual_memory()
    processor = platform.processor().strip() or None

    if not processor and sys.platform.startswith("linux"):
        try:
            with open(
                "/proc/cpuinfo", "r", encoding="utf-8", errors="ignore"
            ) as handle:
                for line in handle:
                    if line.lower().startswith(("model name", "hardware")):  # noqa: SIM102
                        if ":" in line:
                            processor = line.split(":", 1)[1].strip()
                            break
        except OSError:
            pass

    return {
        "device_label": os.getenv("DEVICE_LABEL") or None,
        "os_system": platform.system(),
        "os_release": platform.release(),
        "os_version": platform.version(),
        "architecture": platform.machine(),
        "python_version": platform.python_version(),
        "cpu_model": processor,
        "logical_cpu_count": psutil.cpu_count(logical=True),
        "physical_cpu_count": psutil.cpu_count(logical=False),
        "total_memory_bytes": int(vm.total),
        "k6_version": os.getenv("K6_VERSION") or None,
        "load_generator_role": "client_load_generator_only",
    }


def resource_sample(proc: psutil.Process | None, phase: str) -> dict[str, Any]:
    vm = psutil.virtual_memory()
    swap = psutil.swap_memory()

    sample: dict[str, Any] = {
        "timestamp_utc": utc_now(),
        "phase": phase,
        "system_cpu_percent": psutil.cpu_percent(interval=None),
        "system_memory_used_bytes": int(vm.used),
        "system_memory_available_bytes": int(vm.available),
        "system_memory_percent": float(vm.percent),
        "system_swap_used_bytes": int(swap.used),
        "system_swap_percent": float(swap.percent),
    }

    if proc is not None:
        try:
            with proc.oneshot():
                mem = proc.memory_info()
                sample.update(
                    {
                        "k6_process_cpu_percent": proc.cpu_percent(interval=None),
                        "k6_process_rss_bytes": int(mem.rss),
                        "k6_process_vms_bytes": int(mem.vms),
                        "k6_process_threads": proc.num_threads(),
                    }
                )
        except (
            psutil.NoSuchProcess,
            psutil.AccessDenied,
            psutil.ZombieProcess,
        ):
            sample["k6_process_sample_unavailable"] = True

    return sample


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run k6 and record load-generator environment metrics."
    )
    parser.add_argument(
        "--interval-seconds",
        type=float,
        default=5.0,
        help="Device resource sampling interval (default: 5 seconds)",
    )
    parser.add_argument("--k6-bin", default="k6")
    parser.add_argument("--script", default="k6/student-workflow.js")
    args, k6_args = parser.parse_known_args()

    if k6_args and k6_args[0] == "--":
        k6_args = k6_args[1:]

    if args.interval_seconds <= 0:
        parser.error("--interval-seconds must be greater than zero")

    k6_path = shutil.which(args.k6_bin)
    if not k6_path:
        raise SystemExit(f"Cannot find k6 executable: {args.k6_bin}")

    vus = os.getenv("K6_VUS", "5")
    trial = os.getenv("K6_TRIAL", "1")
    result_path = Path(
        os.getenv(
            "RESULTS_FILE",
            f"k6/results/student_vus_{vus}_trial_{trial}_summary.json",
        )
    )
    environment_path = result_path.with_name(f"{result_path.stem}_environment.json")

    result_path.parent.mkdir(parents=True, exist_ok=True)

    device = static_device_metadata()

    # Prime non-blocking CPU counters before taking measurements.
    psutil.cpu_percent(interval=None)
    psutil.Process().cpu_percent(interval=None)

    samples: list[dict[str, Any]] = [resource_sample(None, "before")]

    command = [k6_path, "run", *k6_args, args.script]
    child_env = os.environ.copy()

    # One canonical wrapper start time is passed to the k6 script.
    wrapper_started_utc = utc_now()
    wrapper_start_monotonic = time.monotonic()
    child_env["SBIMS_WRAPPER_STARTED_AT_UTC"] = wrapper_started_utc

    print(
        "Environment monitoring is active. Device metrics describe "
        "the load generator, not the hosted backend."
    )

    proc: subprocess.Popen[bytes] | None = None
    exit_code = 127
    launch_error: str | None = None
    k6_proc: psutil.Process | None = None

    try:
        proc = subprocess.Popen(command, env=child_env)
        try:
            k6_proc = psutil.Process(proc.pid)
            k6_proc.cpu_percent(interval=None)
        except psutil.Error:
            k6_proc = None

        while proc.poll() is None:
            time.sleep(args.interval_seconds)
            samples.append(resource_sample(k6_proc, "during"))

        exit_code = int(proc.returncode or 0)

    except OSError as exc:
        launch_error = str(exc)
        print(f"Could not launch k6: {exc}", file=sys.stderr)

    finally:
        # Record the end after k6 has exited, including failed launches.
        samples.append(resource_sample(None, "after"))
        wrapper_ended_utc = utc_now()
        elapsed_seconds = time.monotonic() - wrapper_start_monotonic

    numeric_samples = samples

    environment = {
        "metadata_schema_version": 2,
        "wrapper_execution_started_at_utc": wrapper_started_utc,
        "wrapper_execution_ended_at_utc": wrapper_ended_utc,
        "wrapper_elapsed_seconds": round(elapsed_seconds, 3),
        "sampling_interval_seconds": args.interval_seconds,
        "device": device,
        "resource_summary": {
            "system_cpu_percent_max_sampled": max(
                (s["system_cpu_percent"] for s in numeric_samples),
                default=None,
            ),
            "system_memory_percent_max_sampled": max(
                (s["system_memory_percent"] for s in numeric_samples),
                default=None,
            ),
            "system_swap_percent_max_sampled": max(
                (s["system_swap_percent"] for s in numeric_samples),
                default=None,
            ),
            "k6_process_cpu_percent_max_sampled": max(
                (
                    s["k6_process_cpu_percent"]
                    for s in numeric_samples
                    if "k6_process_cpu_percent" in s
                ),
                default=None,
            ),
            "k6_process_rss_bytes_max_sampled": max(
                (
                    s["k6_process_rss_bytes"]
                    for s in numeric_samples
                    if "k6_process_rss_bytes" in s
                ),
                default=None,
            ),
            "sample_count": len(numeric_samples),
        },
        "resource_samples": numeric_samples,
        "run_exit_status": exit_code,
        "launch_error": launch_error,
        "notes": (
            "Resource values are sampled and describe the client/load "
            "generator only, not Deno Deploy, Supabase, or the database. "
            "Wrapper elapsed time includes k6 process startup and shutdown."
        ),
    }

    # Always preserve the environment data independently.
    try:
        write_json(environment_path, environment)
        print(f"Saved environment metadata to {environment_path}")
    except OSError as exc:
        print(
            f"WARNING: could not save environment metadata: {exc}",
            file=sys.stderr,
        )

    # Merge metadata into the k6 summary when it exists and is valid.
    try:
        with result_path.open("r", encoding="utf-8") as handle:
            summary = json.load(handle)

        if not isinstance(summary, dict):
            raise TypeError("k6 summary root must be a JSON object")

        metadata = summary.setdefault("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {"original_metadata_value": metadata}
            summary["metadata"] = metadata

        # These timestamps describe the wrapper execution envelope.
        metadata["run_started_at_utc"] = wrapper_started_utc
        metadata["run_ended_at_utc"] = wrapper_ended_utc
        metadata["wrapper_elapsed_seconds"] = round(elapsed_seconds, 3)
        metadata["run_exit_status"] = exit_code
        metadata["environment_sampling_interval_seconds"] = args.interval_seconds
        metadata["environment_metadata_included"] = True
        metadata["environment_metadata_file"] = str(environment_path)

        summary["environment"] = environment
        write_json(result_path, summary)
        print(f"Updated k6 summary: {result_path}")

    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(
            f"WARNING: could not merge metadata into k6 summary: {exc}",
            file=sys.stderr,
        )
        print(
            "The separate environment file may still be available.",
            file=sys.stderr,
        )

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
