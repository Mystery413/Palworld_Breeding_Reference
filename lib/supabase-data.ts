import type { BreedingData, Pal } from "./planner";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const DATA_VERSION = process.env.NEXT_PUBLIC_DATA_VERSION ?? "";

export type SaveImportIndex = {
  pals: Record<string, string>;
  passives: Record<string, string>;
  passiveRanks: Record<string, number>;
};

type HabitatLocation = NonNullable<Pal["habitat"]>["locations"][number];

let breedingDataPromise: Promise<BreedingData> | null = null;
let saveImportIndexPromise: Promise<SaveImportIndex> | null = null;
const habitatPromises = new Map<string, Promise<HabitatLocation[]>>();

export function buildRuntimeDataUrl(path: string, basePath = BASE_PATH, version = DATA_VERSION): string {
  const url = `${basePath}/${path}`;
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
}

async function loadJson<T>(path: string): Promise<T> {
  // GitHub Pages serves immutable-looking file paths even when their contents
  // change. The build version prevents an older planner snapshot from being
  // reused, while no-cache still revalidates data in local/manual builds where
  // NEXT_PUBLIC_DATA_VERSION is absent.
  const response = await fetch(buildRuntimeDataUrl(path), { cache: "no-cache" });
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
