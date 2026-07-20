#!/usr/bin/env python3
"""Enrich the Palworld 1.0 Pal metadata with current PalDB habitat data.

The script deliberately stores a compact, sampled set of distribution points so
the browser can render an embedded map without loading third-party scripts.
"""

from __future__ import annotations

import html
import json
import re
import ssl
import time
import urllib.error
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any


WEB_ROOT = Path(__file__).resolve().parents[1]
META_PATH = WEB_ROOT / "data" / "pal-metadata-1.0.json"
USER_AGENT = "PalworldBreedingLab/1.0 habitat snapshot"
CA_BUNDLE = Path("/opt/homebrew/etc/ca-certificates/cert.pem")
TLS_CONTEXT = ssl.create_default_context(cafile=str(CA_BUNDLE) if CA_BUNDLE.exists() else "/etc/ssl/cert.pem")
PALPAGOS_BOUNDS = (-1_099_400.0, -724_400.0, 349_400.0, 724_400.0)
WORLD_TREE_BOUNDS = (347_351.5, -818_197.0, 689_148.5, -476_400.0)
MAX_POINTS_PER_WORLD = 72
ALPHA_LOOKUP: dict[str, list[dict[str, Any]]] = {}


def fetch_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=30, context=TLS_CONTEXT) as response:
                return response.read().decode("utf-8")
        except (urllib.error.URLError, TimeoutError) as error:
            last_error = error
            time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"failed to fetch {url}: {last_error}")


def clean_text(value: str) -> str:
    value = re.sub(r"<br\s*/?>", " ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", "", value)
    return " ".join(html.unescape(value).split())


def map_counts(page: str, world: str) -> tuple[int, int]:
    escaped = re.escape(world)
    day = re.search(rf'href="{escaped}\?pal=[^&"]+&t=dayTimeLocations"[^>]*>.*?\((\d+)\)</a>', page, re.S)
    night = re.search(rf'href="{escaped}\?pal=[^&"]+&t=nightTimeLocations"[^>]*>.*?\((\d+)\)</a>', page, re.S)
    return (int(day.group(1)) if day else 0, int(night.group(1)) if night else 0)


def parse_spawner_levels(page: str) -> tuple[list[int], list[int]]:
    section = re.search(r">Spawner</h5>\s*<table[^>]*>(.*?)</table>", page, re.S | re.I)
    if not section:
        return [], []
    wild_levels: list[int] = []
    boss_levels: list[int] = []
    for row in re.findall(r"<tr>(.*?)(?=<tr>|$)", section.group(1), re.S | re.I):
        text = clean_text(row)
        if any(blocked in text for blocked in ("帕鲁中介", "Captured Cage", "帕鲁蛋")):
            continue
        match = re.search(r"Lv\.\s*(\d+)(?:\s*[–—-]\s*(\d+))?", text)
        if match:
            row_levels = [int(value) for value in match.groups() if value and 0 < int(value) <= 100]
            if "palAlpha" in row or "border-danger" in row:
                boss_levels.extend(row_levels)
            else:
                wild_levels.extend(row_levels)
    return wild_levels, boss_levels


def in_bounds(point: dict[str, Any], bounds: tuple[float, float, float, float]) -> bool:
    min_x, min_y, max_x, max_y = bounds
    return min_x <= float(point.get("X", 0)) <= max_x and min_y <= float(point.get("Y", 0)) <= max_y


def compact_locations(distribution: dict[str, Any]) -> tuple[list[dict[str, Any]], list[int], list[int]]:
    merged: dict[tuple[int, int], dict[str, Any]] = {}
    all_levels: list[int] = []
    palpagos_levels: list[int] = []
    for phase, key in (("day", "dayTimeLocations"), ("night", "nightTimeLocations")):
        for raw in distribution.get(key, {}).get("Locations", []):
            if not isinstance(raw, dict) or "X" not in raw or "Y" not in raw:
                continue
            world = "palpagos" if in_bounds(raw, PALPAGOS_BOUNDS) else "worldTree" if in_bounds(raw, WORLD_TREE_BOUNDS) else ""
            if not world:
                continue
            if isinstance(raw.get("lv"), (int, float)) and 0 < int(raw["lv"]) <= 100:
                all_levels.append(int(raw["lv"]))
                if world == "palpagos":
                    palpagos_levels.append(int(raw["lv"]))
            identity = (round(float(raw["X"])), round(float(raw["Y"])))
            current = merged.setdefault(identity, {
                "world": world,
                "x": round(float(raw["X"])),
                "y": round(float(raw["Y"])),
                "time": phase,
            })
            if current["time"] != phase:
                current["time"] = "both"
            if isinstance(raw.get("lv"), (int, float)) and 0 < int(raw["lv"]) <= 100:
                current["level"] = int(raw["lv"])

    sampled: list[dict[str, Any]] = []
    for world in ("palpagos", "worldTree"):
        points = [point for point in merged.values() if point["world"] == world]
        points.sort(key=lambda point: (point["x"], point["y"]))
        if len(points) > MAX_POINTS_PER_WORLD:
            step = len(points) / MAX_POINTS_PER_WORLD
            points = [points[min(len(points) - 1, int(index * step))] for index in range(MAX_POINTS_PER_WORLD)]
        sampled.extend(points)
    return sampled, all_levels, palpagos_levels


def common_level_range(levels: list[int]) -> tuple[int | None, int | None]:
    """Return the earliest well-represented habitat cluster, excluding outliers."""
    if not levels:
        return None, None
    counts = Counter(levels)
    clusters: list[list[int]] = []
    for level in sorted(counts):
        if not clusters or level - clusters[-1][-1] > 3:
            clusters.append([level])
        else:
            clusters[-1].append(level)
    weighted = [(cluster, sum(counts[level] for level in cluster)) for cluster in clusters]
    strongest = max(weight for _, weight in weighted)
    minimum_weight = max(3, strongest * 0.12)
    candidates = [cluster for cluster, weight in weighted if weight >= minimum_weight]
    chosen = min(candidates, key=lambda cluster: cluster[0]) if candidates else max(weighted, key=lambda item: item[1])[0]
    return min(chosen), max(chosen)


def load_alpha_lookup() -> dict[str, list[dict[str, Any]]]:
    lookup: dict[str, list[dict[str, Any]]] = {}
    for world, url in (
        ("palpagos", "https://paldb.cc/js/map_data_cn.js?palworld=1.0"),
        ("worldTree", "https://paldb.cc/js/treemap_data_cn.js?palworld=1.0"),
    ):
        source = fetch_text(url)
        match = re.search(r"var fixedDungeon\s*=\s*(\[.*?\]);var", source, re.S)
        if not match:
            continue
        for entry in json.loads(match.group(1)):
            if not isinstance(entry, dict) or not entry.get("id"):
                continue
            entry = {**entry, "world": world}
            keys = {
                str(entry["id"]).lower(),
                re.sub(r"^boss_", "", str(entry["id"]), flags=re.I).lower(),
                str(entry.get("href", "")).lower(),
            }
            for key in keys:
                if key:
                    lookup.setdefault(key, []).append(entry)
    return lookup


def alpha_habitat(pal_code: str, page_slug: str) -> tuple[list[dict[str, Any]], list[int]]:
    keys = {pal_code.lower(), f"boss_{pal_code.lower()}", page_slug.lower()}
    entries: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for key in keys:
        for entry in ALPHA_LOOKUP.get(key, []):
            identity = (entry["world"], str(entry.get("id")))
            if identity not in seen:
                seen.add(identity)
                entries.append(entry)
    locations: list[dict[str, Any]] = []
    levels: list[int] = []
    for entry in entries:
        raw = entry.get("pos") or entry.get("ipos")
        if not isinstance(raw, dict) or "X" not in raw or "Y" not in raw:
            continue
        location = {
            "world": entry["world"],
            "x": round(float(raw["X"])),
            "y": round(float(raw["Y"])),
            "time": "night" if str(entry.get("onlyTime", "")).lower() == "night" else "both",
            "boss": True,
        }
        if isinstance(entry.get("lv"), (int, float)) and 0 < int(entry["lv"]) <= 100:
            location["level"] = int(entry["lv"])
            levels.append(int(entry["lv"]))
        locations.append(location)
    return locations, levels


def load_passive_names() -> list[str]:
    page = fetch_text("https://paldb.cc/cn/Passive_Skills?palworld=1.0")
    section = page.split('<div id="帕鲁被动技能"', 1)[-1].split('</div></div id="帕鲁被动技能">', 1)[0]
    names = [clean_text(value) for value in re.findall(r'<div class="passive-rank-?\d+[^>]*">(.*?)</div>', section, re.S)]
    return list(dict.fromkeys(name for name in names if name))


def enrich_pal(pal: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    source_url = pal.get("sourceUrl", "")
    empty = {
        "catchable": False,
        "minLevel": None,
        "maxLevel": None,
        "wildMinLevel": None,
        "wildMaxLevel": None,
        "commonWildMinLevel": None,
        "commonWildMaxLevel": None,
        "bossMinLevel": None,
        "bossMaxLevel": None,
        "dayCount": 0,
        "nightCount": 0,
        "worldTreeDayCount": 0,
        "worldTreeNightCount": 0,
        "summary": "当前 1.0 数据未记录普通野外栖息地。",
        "locations": [],
        "mapSourceUrl": source_url,
    }
    if not source_url.startswith("https://paldb.cc/"):
        return pal["id"], empty

    page = fetch_text(source_url)
    code_match = re.search(r'(?:Palpagos_Islands|The_World_Tree)\?pal=([^&"]+)', page)
    summary_match = re.search(r'data-i18n-tw="簡介">Summary</h5>\s*<div>(.*?)</div>', page, re.S | re.I)
    day_count, night_count = map_counts(page, "Palpagos_Islands")
    tree_day_count, tree_night_count = map_counts(page, "The_World_Tree")
    summary = clean_text(summary_match.group(1)) if summary_match else empty["summary"]
    if not code_match:
        return pal["id"], {**empty, "summary": summary}

    pal_code = html.unescape(code_match.group(1))
    page_slug = source_url.rsplit("/", 1)[-1]
    alpha_locations, alpha_levels = alpha_habitat(pal_code, page_slug)
    try:
        distribution = json.loads(fetch_text(f"https://paldb.cc/paldex/{pal_code.lower()}.json?palworld=1.0"))
        locations, coordinate_levels, palpagos_levels = compact_locations(distribution)
    except RuntimeError:
        locations, coordinate_levels, palpagos_levels = [], [], []
    locations.extend(alpha_locations)
    spawner_wild_levels, spawner_boss_levels = parse_spawner_levels(page)
    wild_levels = spawner_wild_levels + coordinate_levels
    boss_levels = spawner_boss_levels + alpha_levels
    common_wild_min, common_wild_max = common_level_range(palpagos_levels or spawner_wild_levels)
    levels = wild_levels + boss_levels
    catchable = (day_count + night_count + tree_day_count + tree_night_count) > 0 or bool(alpha_locations)
    return pal["id"], {
        "catchable": catchable,
        "minLevel": min(levels) if levels else None,
        "maxLevel": max(levels) if levels else None,
        "wildMinLevel": min(wild_levels) if wild_levels else None,
        "wildMaxLevel": max(wild_levels) if wild_levels else None,
        "commonWildMinLevel": common_wild_min,
        "commonWildMaxLevel": common_wild_max,
        "bossMinLevel": min(boss_levels) if boss_levels else None,
        "bossMaxLevel": max(boss_levels) if boss_levels else None,
        "dayCount": day_count,
        "nightCount": night_count,
        "worldTreeDayCount": tree_day_count,
        "worldTreeNightCount": tree_night_count,
        "summary": summary,
        "locations": locations,
        "mapSourceUrl": f"https://paldb.cc/cn/Palpagos_Islands?pal={pal_code}&t=dayTimeLocations",
    }


def main() -> None:
    global ALPHA_LOOKUP
    ALPHA_LOOKUP = load_alpha_lookup()
    metadata = json.loads(META_PATH.read_text(encoding="utf-8"))
    pals = metadata["pals"]
    results: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(enrich_pal, pal): pal for pal in pals}
        for index, future in enumerate(as_completed(futures), start=1):
            pal = futures[future]
            try:
                pal_id, habitat = future.result()
            except Exception as error:  # Keep the snapshot usable if one page is temporarily down.
                print(f"warning: {pal['name']} failed: {error}")
                continue
            results[pal_id] = habitat
            if index % 25 == 0 or index == len(pals):
                print(f"fetched {index}/{len(pals)}")

    for pal in pals:
        if pal["id"] in results:
            pal["habitat"] = results[pal["id"]]
    metadata["passives"] = load_passive_names()
    metadata["habitatSource"] = "https://paldb.cc/cn/Pals"
    metadata["habitatRetrievedAt"] = "2026-07-20"
    META_PATH.write_text(json.dumps(metadata, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"updated {META_PATH}: {len(results)}/{len(pals)} habitat records, {len(metadata['passives'])} passives")


if __name__ == "__main__":
    main()
