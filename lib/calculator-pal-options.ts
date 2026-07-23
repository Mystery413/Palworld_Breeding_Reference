import type { Pal } from "./planner";

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("zh-CN").replaceAll(/\s+/g, "");
}

function fuzzyMatches(value: string, rawQuery: string): boolean {
  const haystack = normalize(value);
  const query = normalize(rawQuery);
  if (!query || haystack.includes(query)) return true;
  let cursor = 0;
  for (const char of haystack) if (char === query[cursor]) cursor += 1;
  return cursor === query.length;
}

function palSearchScore(pal: Pal, rawQuery: string): number | null {
  const query = normalize(rawQuery);
  if (!query) return 0;
  const fields = [pal.dex.replace(/^0+/, ""), pal.dex, pal.nameZh, pal.name].map(normalize);
  if (fields.some((field) => field === query)) return 0;
  if (fields.some((field) => field.startsWith(query))) return 1;
  if (fields.some((field) => field.includes(query))) return 2;
  if (fields.some((field) => fuzzyMatches(field, query))) return 3;
  return null;
}

export function compareCalculatorPals(left: Pal, right: Pal): number {
  if (left.dex === "-" && right.dex !== "-") return 1;
  if (right.dex === "-" && left.dex !== "-") return -1;
  return left.dex.localeCompare(right.dex, "zh-CN", { numeric: true });
}

/** Return the complete matching catalog; scrolling belongs to the UI, not the data query. */
export function calculatorPalOptions(pals: Pal[], query: string): Pal[] {
  return pals
    .map((pal) => ({ pal, score: palSearchScore(pal, query) }))
    .filter((item): item is { pal: Pal; score: number } => item.score != null)
    .sort((left, right) => left.score - right.score || compareCalculatorPals(left.pal, right.pal))
    .map(({ pal }) => pal);
}
