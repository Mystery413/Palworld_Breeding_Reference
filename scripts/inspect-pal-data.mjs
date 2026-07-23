import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const palId = process.argv[2];

if (!palId) {
  console.error("用法：npm run data:inspect -- <pal_id>，例如 npm run data:inspect -- 174:0");
  process.exit(1);
}

const [corrections, breedingData, runtimeData] = await Promise.all([
  fs.readFile(path.join(root, "data/habitat-corrections.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(root, "public/data/breeding-data.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(root, "public/data/runtime/planner-core.json"), "utf8").then(JSON.parse),
]);

const correction = corrections[palId] ?? null;
const breedingPal = breedingData.pals.find((pal) => pal.id === palId);
const runtimePal = runtimeData.pals.find((pal) => pal.id === palId);

assert.ok(breedingPal, `完整数据中找不到帕鲁：${palId}`);
assert.ok(runtimePal, `运行时快照中找不到帕鲁：${palId}`);

const levelFields = [
  "minLevel",
  "maxLevel",
  "wildMinLevel",
  "wildMaxLevel",
  "commonWildMinLevel",
  "commonWildMaxLevel",
  "bossMinLevel",
  "bossMaxLevel",
];

const pickLevels = (habitat) => Object.fromEntries(levelFields.map((field) => [field, habitat?.[field] ?? null]));
const fullLevels = pickLevels(breedingPal.habitat);
const runtimeLevels = pickLevels(runtimePal.habitat);

assert.deepEqual(runtimeLevels, fullLevels, `${palId} 的完整数据与运行时快照不一致，请重新构建`);
if (correction) {
  for (const [field, expected] of Object.entries(correction)) {
    assert.equal(runtimePal.habitat?.[field], expected, `${palId}.${field} 未应用人工核验修正`);
  }
}

console.log(JSON.stringify({
  palId,
  name: `${runtimePal.nameZh} ${runtimePal.name}`,
  correction,
  breedingData: fullLevels,
  runtimeData: runtimeLevels,
  synchronized: true,
}, null, 2));
