import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type Habitat = {
  minLevel: number | null;
  maxLevel: number | null;
  wildMinLevel: number | null;
  wildMaxLevel: number | null;
  commonWildMinLevel: number | null;
  commonWildMaxLevel: number | null;
  bossMinLevel: number | null;
  bossMaxLevel: number | null;
};

type RuntimeData = {
  pals: Array<{ id: string; habitat?: Habitat }>;
};

const expectedHabitats: Record<string, Habitat> = {
  "122:0": {
    minLevel: 40,
    maxLevel: 80,
    wildMinLevel: 40,
    wildMaxLevel: 80,
    commonWildMinLevel: 40,
    commonWildMaxLevel: 44,
    bossMinLevel: 45,
    bossMaxLevel: 45,
  },
  "174:0": {
    minLevel: 68,
    maxLevel: 80,
    wildMinLevel: 75,
    wildMaxLevel: 80,
    commonWildMinLevel: 75,
    commonWildMaxLevel: 80,
    bossMinLevel: 68,
    bossMaxLevel: 68,
  },
  "186:1": {
    minLevel: 58,
    maxLevel: 80,
    wildMinLevel: 75,
    wildMaxLevel: 80,
    commonWildMinLevel: 75,
    commonWildMaxLevel: 80,
    bossMinLevel: 58,
    bossMaxLevel: 59,
  },
};

test("线上静态快照包含已核验的栖息地修正", async () => {
  const data = JSON.parse(
    await readFile(new URL("../public/data/runtime/planner-core.json", import.meta.url), "utf8"),
  ) as RuntimeData;
  const palsById = new Map(data.pals.map((pal) => [pal.id, pal]));

  for (const [palId, expected] of Object.entries(expectedHabitats)) {
    const habitat = palsById.get(palId)?.habitat;
    assert.ok(habitat, `静态快照缺少 ${palId} 的栖息地`);
    for (const [field, value] of Object.entries(expected)) {
      assert.equal(habitat[field as keyof Habitat], value, `${palId}.${field} 已回归为错误数据`);
    }
  }
});
