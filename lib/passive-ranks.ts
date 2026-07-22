import saveImportIndex from "../public/data/save-import-index.json" with { type: "json" };

export type PassiveRankMap = Record<string, number | null | undefined>;

export function normalizePassiveName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

// Keep this small rank table in the JavaScript bundle. The main planner data is
// comparatively large, so relying on it alone briefly rendered every trait as
// an unknown custom value while that file was still downloading.
export const bundledPassiveRanks: Record<string, number> = Object.fromEntries(
  Object.entries(saveImportIndex.passives).flatMap(([assetId, nameZh]) => {
    const rank = saveImportIndex.passiveRanks[assetId as keyof typeof saveImportIndex.passiveRanks];
    return typeof rank === "number" ? [[normalizePassiveName(nameZh), rank]] : [];
  }),
);

export function passiveRankOf(name: string, ranks: PassiveRankMap): number | undefined {
  const direct = ranks[name];
  if (typeof direct === "number") return direct;
  const normalizedName = normalizePassiveName(name);
  const normalized = ranks[normalizedName] ?? bundledPassiveRanks[normalizedName];
  return typeof normalized === "number" ? normalized : undefined;
}
