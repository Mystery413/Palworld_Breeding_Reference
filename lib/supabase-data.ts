import type { BreedingData, ComboTuple, Pal } from "./planner";

const PAGE_SIZE = 1000;
const PAGE_CONCURRENCY = 6;

type JsonRecord = Record<string, unknown>;

export type SaveImportIndex = {
  pals: Record<string, string>;
  passives: Record<string, string>;
  passiveRanks: Record<string, number>;
};

function supabaseConfig(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return { url, key };
}

function contentRangeTotal(value: string | null): number | null {
  const total = value?.match(/\/(\d+)$/)?.[1];
  return total ? Number(total) : null;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithGatewayRetry(url: string, init: RequestInit): Promise<Response> {
  const retryDelays = [0, 400, 1200];
  let response: Response | null = null;
  for (const retryDelay of retryDelays) {
    if (retryDelay) await delay(retryDelay);
    response = await fetch(url, init);
    if (response.ok || ![404, 429, 502, 503, 504].includes(response.status)) return response;
  }
  return response as Response;
}

async function fetchPage(table: string, select: string, order: string, from: number, to: number, count = false): Promise<{ rows: JsonRecord[]; total: number | null }> {
  const { url, key } = supabaseConfig();
  const query = `select=${encodeURIComponent(select)}${order ? `&order=${encodeURIComponent(order)}` : ""}`;
  const response = await fetchWithGatewayRetry(`${url}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Range: `${from}-${to}`,
      ...(count ? { Prefer: "count=exact" } : {}),
    },
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`${table} 查询失败 (${response.status}): ${message.slice(0, 240)}`);
  }
  return {
    rows: await response.json() as JsonRecord[],
    total: contentRangeTotal(response.headers.get("content-range")),
  };
}

async function fetchAllRows(table: string, select = "*", order = ""): Promise<JsonRecord[]> {
  const first = await fetchPage(table, select, order, 0, PAGE_SIZE - 1, true);
  const total = first.total ?? first.rows.length;
  if (total <= first.rows.length) return first.rows;

  const starts: number[] = [];
  for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) starts.push(from);
  const pages = new Array<JsonRecord[]>(starts.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(PAGE_CONCURRENCY, starts.length) }, async () => {
    while (cursor < starts.length) {
      const index = cursor++;
      const from = starts[index];
      pages[index] = (await fetchPage(table, select, order, from, Math.min(from + PAGE_SIZE - 1, total - 1))).rows;
    }
  });
  await Promise.all(workers);
  return [...first.rows, ...pages.flat()];
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function numberOrZero(value: unknown): number {
  return nullableNumber(value) ?? 0;
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function boolean(value: unknown): boolean {
  return value === true || value === "true";
}

export async function loadBreedingData(): Promise<BreedingData> {
  const [palRows, workRows, elementRows, habitatRows, locationRows, comboRows, passiveRows] = await Promise.all([
    fetchAllRows("pals", "*", "pal_id.asc"),
    fetchAllRows("pal_work_suitabilities", "*", "pal_id.asc,work_type.asc"),
    fetchAllRows("pal_elements", "*", "pal_id.asc,element.asc"),
    fetchAllRows("pal_habitats", "*", "pal_id.asc"),
    fetchAllRows("pal_habitat_locations", "*", "location_id.asc"),
    fetchAllRows("breeding_combos", "*", "combo_id.asc"),
    fetchAllRows("passives", "name_zh,rank", "name_zh.asc"),
  ]);

  const workByPal = new Map<string, Record<string, number>>();
  for (const row of workRows) {
    const palId = text(row.pal_id);
    const work = workByPal.get(palId) ?? {};
    work[text(row.work_type)] = numberOrZero(row.work_level);
    workByPal.set(palId, work);
  }

  const elementsByPal = new Map<string, string[]>();
  for (const row of elementRows) {
    const palId = text(row.pal_id);
    elementsByPal.set(palId, [...(elementsByPal.get(palId) ?? []), text(row.element)]);
  }

  const locationsByPal = new Map<string, NonNullable<Pal["habitat"]>["locations"]>();
  for (const row of locationRows) {
    const palId = text(row.pal_id);
    const locations = locationsByPal.get(palId) ?? [];
    locations.push({
      world: text(row.world) as "palpagos" | "worldTree",
      x: numberOrZero(row.x),
      y: numberOrZero(row.y),
      time: text(row.time_of_day) as "day" | "night" | "both",
      ...(nullableNumber(row.level) == null ? {} : { level: nullableNumber(row.level) as number }),
      ...(boolean(row.is_boss) ? { boss: true } : {}),
    });
    locationsByPal.set(palId, locations);
  }

  const habitatByPal = new Map(habitatRows.map((row) => {
    const palId = text(row.pal_id);
    return [palId, {
      catchable: boolean(row.catchable),
      minLevel: nullableNumber(row.min_level),
      maxLevel: nullableNumber(row.max_level),
      wildMinLevel: nullableNumber(row.wild_min_level),
      wildMaxLevel: nullableNumber(row.wild_max_level),
      commonWildMinLevel: nullableNumber(row.common_wild_min_level),
      commonWildMaxLevel: nullableNumber(row.common_wild_max_level),
      bossMinLevel: nullableNumber(row.boss_min_level),
      bossMaxLevel: nullableNumber(row.boss_max_level),
      dayCount: numberOrZero(row.day_count),
      nightCount: numberOrZero(row.night_count),
      worldTreeDayCount: numberOrZero(row.world_tree_day_count),
      worldTreeNightCount: numberOrZero(row.world_tree_night_count),
      summary: text(row.summary),
      locations: locationsByPal.get(palId) ?? [],
      mapSourceUrl: text(row.map_source_url),
    } satisfies NonNullable<Pal["habitat"]>] as const;
  }));

  const pals: Pal[] = palRows.map((row) => {
    const palId = text(row.pal_id);
    return {
      id: palId,
      dex: text(row.dex),
      name: text(row.name_en),
      nameZh: text(row.name_zh),
      comboCount: numberOrZero(row.combo_count),
      genderSpecificComboCount: numberOrZero(row.gender_specific_combo_count),
      stats: {
        hp: nullableNumber(row.hp),
        attack: nullableNumber(row.attack),
        defense: nullableNumber(row.defense),
        workSpeed: nullableNumber(row.work_speed),
        rarity: nullableNumber(row.rarity),
        breedingPower: nullableNumber(row.breeding_power),
        maleRate: nullableNumber(row.male_rate),
      },
      work: workByPal.get(palId) ?? {},
      elements: elementsByPal.get(palId) ?? [],
      image: text(row.image_url),
      sourceUrl: text(row.source_url),
      ...(habitatByPal.has(palId) ? { habitat: habitatByPal.get(palId) } : {}),
    };
  });

  const combos: ComboTuple[] = comboRows.map((row) => [
    text(row.parent_a_pal_id),
    text(row.parent_b_pal_id),
    text(row.child_pal_id),
    text(row.parent_a_gender) as ComboTuple[3],
    text(row.parent_b_gender) as ComboTuple[4],
  ]);

  const newestUpdate = palRows.reduce((newest, row) => {
    const updatedAt = text(row.updated_at);
    return updatedAt > newest ? updatedAt : newest;
  }, "");
  const date = newestUpdate ? newestUpdate.slice(0, 10) : new Date().toISOString().slice(0, 10);

  return {
    version: text(palRows[0]?.game_version) || "Palworld",
    exportedAt: date,
    generatedAt: date,
    pals,
    passives: [...new Set(passiveRows.map((row) => text(row.name_zh)).filter(Boolean))],
    passiveRanks: Object.fromEntries(passiveRows.map((row) => [text(row.name_zh), nullableNumber(row.rank)])),
    combos,
  };
}

export async function loadSaveImportIndex(): Promise<SaveImportIndex> {
  const [aliasRows, passiveRows] = await Promise.all([
    fetchAllRows("pal_asset_aliases", "*", "asset_id.asc"),
    fetchAllRows("passives", "asset_id,name_zh,rank", "asset_id.asc"),
  ]);
  return {
    pals: Object.fromEntries(aliasRows.map((row) => [text(row.asset_id), text(row.pal_id)])),
    passives: Object.fromEntries(passiveRows.map((row) => [text(row.asset_id), text(row.name_zh)])),
    passiveRanks: Object.fromEntries(passiveRows.map((row) => [text(row.asset_id), numberOrZero(row.rank)])),
  };
}
