import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "public/data/breeding-data.json");
const saveIndexPath = path.join(root, "public/data/save-import-index.json");
const outputDir = path.join(root, "public/data/runtime");
const habitatDir = path.join(outputDir, "habitats");

const data = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const saveIndex = JSON.parse(await fs.readFile(saveIndexPath, "utf8"));
await fs.mkdir(habitatDir, { recursive: true });

// breeding-data.json contains the display names, while the save import index
// is the authoritative source for passive ranks. Join them by localized name
// so the static runtime keeps the same rarity information as Supabase did.
const passiveRanks = Object.fromEntries(Object.entries(saveIndex.passives)
  .flatMap(([assetId, nameZh]) => {
    const rank = saveIndex.passiveRanks[assetId];
    return typeof rank === "number" ? [[nameZh, rank]] : [];
  }));

const fileId = (palId) => palId.replaceAll(":", "_");
const core = {
  ...data,
  passiveRanks,
  pals: data.pals.map((pal) => {
    const locations = pal.habitat?.locations ?? [];
    return {
      ...pal,
      image: pal.image ? `data/pal-icons/${fileId(pal.id)}.webp` : "",
      ...(pal.habitat ? {
        habitat: {
          ...pal.habitat,
          locations: [],
          hasPalpagosLocations: locations.some((location) => location.world === "palpagos"),
          hasWorldTreeLocations: locations.some((location) => location.world === "worldTree"),
        },
      } : {}),
    };
  }),
};

await fs.writeFile(path.join(outputDir, "planner-core.json"), JSON.stringify(core));
await Promise.all(data.pals.map((pal) => fs.writeFile(
  path.join(habitatDir, `${fileId(pal.id)}.json`),
  JSON.stringify(pal.habitat?.locations ?? []),
)));

console.log(JSON.stringify({
  coreBytes: Buffer.byteLength(JSON.stringify(core)),
  pals: core.pals.length,
  combos: core.combos.length,
  passiveRanks: Object.keys(core.passiveRanks).length,
  habitatFiles: data.pals.length,
}, null, 2));
