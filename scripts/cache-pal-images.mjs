import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const data = JSON.parse(await fs.readFile(path.join(root, "public/data/breeding-data.json"), "utf8"));
const outputDir = path.join(root, "public/data/pal-icons");
await fs.mkdir(outputDir, { recursive: true });

const fileId = (palId) => palId.replaceAll(":", "_");
const pending = [...data.pals];
const failures = [];
let downloaded = 0;
let reused = 0;

async function worker() {
  while (pending.length) {
    const pal = pending.shift();
    const outputPath = path.join(outputDir, `${fileId(pal.id)}.webp`);
    try {
      const existing = await fs.stat(outputPath).catch(() => null);
      if (existing?.size) {
        reused += 1;
        continue;
      }
      const response = await fetch(pal.image, { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length) throw new Error("empty response");
      await fs.writeFile(outputPath, bytes);
      downloaded += 1;
    } catch (error) {
      failures.push({ id: pal.id, url: pal.image, error: String(error) });
    }
  }
}

await Promise.all(Array.from({ length: 12 }, worker));
console.log(JSON.stringify({ downloaded, reused, failures }, null, 2));
if (failures.length) process.exitCode = 1;
