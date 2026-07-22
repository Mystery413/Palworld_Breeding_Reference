import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "public/data/breeding-data.json");
const outputDir = path.join(root, "public/data/runtime");
const habitatDir = path.join(outputDir, "habitats");

const data = JSON.parse(await fs.readFile(sourcePath, "utf8"));
await fs.mkdir(habitatDir, { recursive: true });

const fileId = (palId) => palId.replaceAll(":", "_");
const core = {
  ...data,
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
  habitatFiles: data.pals.length,
}, null, 2));
