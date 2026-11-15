#!/usr/bin/env bash
# Rebuild the dataset from the live NASA PSI API.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 pipeline/fetch_psi.py
python3 pipeline/parse_tables.py
python3 pipeline/build_dataset.py
