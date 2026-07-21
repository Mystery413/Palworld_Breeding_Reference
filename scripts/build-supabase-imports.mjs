import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = process.cwd();
const outputDir = path.join(root, "supabase");
const csvDir = path.join(outputDir, "csv");
const previewDir = path.join(outputDir, "previews");
await fs.mkdir(csvDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const breeding = JSON.parse(await fs.readFile(path.join(root, "public/data/breeding-data.json"), "utf8"));
const saveIndex = JSON.parse(await fs.readFile(path.join(root, "public/data/save-import-index.json"), "utf8"));

const text = (value) => value == null ? "" : String(value);
const csvCell = (value) => {
  const raw = text(value);
  return /[",\r\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
};
const writeCsv = async (fileName, headers, rows) => {
  const content = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
  await fs.writeFile(path.join(csvDir, fileName), content, "utf8");
};

const tables = [
  {
    file: "01_pals.csv", sheet: "Pals",
    headers: ["pal_id", "game_version", "dex", "name_en", "name_zh", "combo_count", "gender_specific_combo_count", "hp", "attack", "defense", "work_speed", "rarity", "breeding_power", "male_rate", "image_url", "source_url"],
    rows: breeding.pals.map((pal) => [pal.id, breeding.version, pal.dex, pal.name, pal.nameZh, pal.comboCount, pal.genderSpecificComboCount, pal.stats.hp, pal.stats.attack, pal.stats.defense, pal.stats.workSpeed, pal.stats.rarity, pal.stats.breedingPower, pal.stats.maleRate, pal.image, pal.sourceUrl]),
  },
  {
    file: "02_pal_work_suitabilities.csv", sheet: "Work",
    headers: ["pal_id", "work_type", "work_level"],
    rows: breeding.pals.flatMap((pal) => Object.entries(pal.work).map(([type, level]) => [pal.id, type, level])),
  },
  {
    file: "03_pal_elements.csv", sheet: "Elements",
    headers: ["pal_id", "element"],
    rows: breeding.pals.flatMap((pal) => pal.elements.map((element) => [pal.id, element])),
  },
  {
    file: "04_pal_habitats.csv", sheet: "Habitats",
    headers: ["pal_id", "catchable", "min_level", "max_level", "wild_min_level", "wild_max_level", "common_wild_min_level", "common_wild_max_level", "boss_min_level", "boss_max_level", "day_count", "night_count", "world_tree_day_count", "world_tree_night_count", "summary", "map_source_url"],
    rows: breeding.pals.filter((pal) => pal.habitat).map((pal) => { const h = pal.habitat; return [pal.id, h.catchable, h.minLevel, h.maxLevel, h.wildMinLevel, h.wildMaxLevel, h.commonWildMinLevel, h.commonWildMaxLevel, h.bossMinLevel, h.bossMaxLevel, h.dayCount, h.nightCount, h.worldTreeDayCount, h.worldTreeNightCount, h.summary, h.mapSourceUrl]; }),
  },
  {
    file: "05_pal_habitat_locations.csv", sheet: "Locations",
    headers: ["pal_id", "world", "x", "y", "time_of_day", "level", "is_boss"],
    rows: breeding.pals.flatMap((pal) => (pal.habitat?.locations ?? []).map((location) => [pal.id, location.world, location.x, location.y, location.time, location.level, Boolean(location.boss)])),
  },
  {
    file: "06_breeding_combos.csv", sheet: "Breeding",
    headers: ["parent_a_pal_id", "parent_b_pal_id", "child_pal_id", "parent_a_gender", "parent_b_gender"],
    rows: breeding.combos,
  },
  {
    file: "07_passives.csv", sheet: "Passives",
    headers: ["asset_id", "name_zh", "rank"],
    rows: Object.entries(saveIndex.passiveRanks).map(([asset, rank]) => [asset, saveIndex.passives[asset] ?? asset, rank]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  },
  {
    file: "08_pal_asset_aliases.csv", sheet: "Asset Aliases",
    headers: ["asset_id", "pal_id"],
    rows: Object.entries(saveIndex.pals).sort((a, b) => a[0].localeCompare(b[0])),
  },
];

for (const table of tables) await writeCsv(table.file, table.headers, table.rows);

const workbook = Workbook.create();
const summary = workbook.worksheets.add("Import Summary");
summary.showGridLines = false;
summary.getRange("A1:D1").merge();
summary.getRange("A1").values = [["Palworld → Supabase Import Package"]];
summary.getRange("A3:D3").values = [["Order", "CSV / table", "Rows", "Purpose"]];
summary.getRange(`A4:D${tables.length + 3}`).values = tables.map((table, index) => [index + 1, table.file, table.rows.length, table.sheet]);
summary.getRange("A1:D1").format = { fill: "#111827", font: { color: "#D9FF4F", bold: true, size: 18 }, rowHeight: 34 };
summary.getRange("A3:D3").format = { fill: "#D9FF4F", font: { color: "#111827", bold: true }, borders: { preset: "outside", style: "thin", color: "#9CA3AF" } };
summary.getRange(`A4:D${tables.length + 3}`).format = { borders: { preset: "inside", style: "thin", color: "#E5E7EB" } };
summary.getRange("A:A").format.columnWidth = 10;
summary.getRange("B:B").format.columnWidth = 38;
summary.getRange("C:C").format.columnWidth = 14;
summary.getRange("D:D").format.columnWidth = 24;
summary.freezePanes.freezeRows(3);

for (const table of tables) {
  const sheet = workbook.worksheets.add(table.sheet);
  sheet.showGridLines = false;
  const matrix = [table.headers, ...table.rows].map((row) => row.map((value) => value ?? ""));
  const target = sheet.getRangeByIndexes(0, 0, matrix.length, table.headers.length);
  for (let col = 0; col < table.headers.length; col += 1) {
    if (table.headers[col].endsWith("_id") || ["dex", "asset_id", "game_version"].includes(table.headers[col])) {
      sheet.getRangeByIndexes(0, col, matrix.length, 1).format.numberFormat = "@";
    }
  }
  target.values = matrix;
  sheet.getRangeByIndexes(0, 0, 1, table.headers.length).format = { fill: "#111827", font: { color: "#FFFFFF", bold: true }, wrapText: true, rowHeight: 30 };
  sheet.freezePanes.freezeRows(1);
  const used = sheet.getUsedRange();
  used.format.autofitColumns();
  for (let col = 0; col < table.headers.length; col += 1) {
    const column = sheet.getRangeByIndexes(0, col, matrix.length, 1);
    if (column.format.columnWidth > 32) column.format.columnWidth = 32;
  }
}

const inspection = await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 4000 });
console.log(inspection.ndjson);
for (const sheetName of ["Import Summary", ...tables.map((table) => table.sheet)]) {
  const preview = await workbook.render({ sheetName, range: sheetName === "Import Summary" ? "A1:D12" : "A1:H12", scale: 1, format: "png" });
  await fs.writeFile(path.join(previewDir, `${sheetName.replaceAll(" ", "-").toLowerCase()}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(path.join(outputDir, "palworld-reference-data.xlsx"));
console.log(JSON.stringify(Object.fromEntries(tables.map((table) => [table.file, table.rows.length])), null, 2));
