import type { BreedingData, Pal } from "./planner";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export type SaveImportIndex = {
  pals: Record<string, string>;
  passives: Record<string, string>;
  passiveRanks: Record<string, number>;
};

type HabitatLocation = NonNullable<Pal["habitat"]>["locations"][number];

let breedingDataPromise: Promise<BreedingData> | null = null;
let saveImportIndexPromise: Promise<SaveImportIndex> | null = null;
const habitatPromises = new Map<string, Promise<HabitatLocation[]>>();

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_PATH}/${path}`, { cache: "force-cache" });
  if (!response.ok) throw new Error(`${path} 加载失败 (${response.status})`);
  return response.json() as Promise<T>;
}

function withRuntimeAssetPaths(data: BreedingData): BreedingData {
  return {
    ...data,
    pals: data.pals.map((pal) => ({
      ...pal,
      image: pal.image && !/^https?:/i.test(pal.image) ? `${BASE_PATH}/${pal.image}` : pal.image,
    })),
  };
}

export function loadBreedingData(): Promise<BreedingData> {
  breedingDataPromise ??= loadJson<BreedingData>("data/runtime/planner-core.json")
    .then(withRuntimeAssetPaths);
  return breedingDataPromise;
}

export function loadSaveImportIndex(): Promise<SaveImportIndex> {
  saveImportIndexPromise ??= loadJson<SaveImportIndex>("data/save-import-index.json");
  return saveImportIndexPromise;
}

export function loadPalHabitatLocations(palId: string): Promise<HabitatLocation[]> {
  const fileName = palId.replaceAll(":", "_");
  const existing = habitatPromises.get(fileName);
  if (existing) return existing;
  const request = loadJson<HabitatLocation[]>(`data/runtime/habitats/${fileName}.json`);
  habitatPromises.set(fileName, request);
  return request;
}
