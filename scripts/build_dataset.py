#!/usr/bin/env python3
"""Build the compact browser dataset from the repository CSV exports."""

from __future__ import annotations

import csv
import json
from pathlib import Path


WEB_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = WEB_ROOT.parent
META_PATH = WEB_ROOT / "data" / "pal-metadata-1.0.json"
OUTPUT_PATH = WEB_ROOT / "public" / "data" / "breeding-data.json"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def main() -> None:
    metadata = json.loads(META_PATH.read_text(encoding="utf-8"))
    combos = read_csv(REPO_ROOT / "breeding_combos.csv")

    compact_combos = [
        [
            row["child_id"],
            row["parent_a_id"],
            row["parent_b_id"],
            row["parent_a_gender"],
            row["parent_b_gender"],
        ]
        for row in combos
    ]

    payload = {
        "version": "Palworld 1.0",
        "exportedAt": "2026-07-16",
        "generatedAt": "2026-07-20",
        "sources": {
            "breeding": "../breeding_combos.csv",
            "metadata": metadata["source"],
        },
        "pals": metadata["pals"],
        "combos": compact_combos,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(
        f"wrote {OUTPUT_PATH}: {len(payload['pals'])} pals, "
        f"{len(payload['combos'])} combos"
    )


if __name__ == "__main__":
    main()
