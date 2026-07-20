import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  type BreedingData,
  type InventoryPal,
  findTargetPlan,
  passiveInheritanceChance,
  potentialInheritanceChance,
  recommendTargets,
  searchBreedingPlans,
  summarizeSearch,
} from "../lib/planner.ts";

function fixture(combos: BreedingData["combos"]): BreedingData {
  const ids = [...new Set(combos.flatMap((combo) => combo.slice(0, 3) as string[]))];
  return {
    version: "1.0",
    exportedAt: "2026-07-16",
    generatedAt: "test",
    combos,
    pals: ids.map((id, index) => ({
      id,
      dex: String(index + 1),
      name: id,
      nameZh: id,
      comboCount: 0,
      genderSpecificComboCount: 0,
      stats: { hp: 100, attack: 100, defense: 100, workSpeed: 100, rarity: 5, breedingPower: 100, maleRate: 50 },
      work: {},
      elements: [],
      image: "",
      sourceUrl: "",
    })),
  };
}

test("词条遗传率采用 1.0 的干净词条池概率", () => {
  assert.equal(passiveInheritanceChance(1, 1), 0.4);
  assert.equal(passiveInheritanceChance(2, 2), 0.24);
  assert.equal(passiveInheritanceChance(3, 3), 0.12);
  assert.equal(passiveInheritanceChance(4, 4), 0.1);
  assert.ok(Math.abs(passiveInheritanceChance(6, 4) - 0.1 / 15) < 1e-12);
});

test("潜力值逐项按父 30%、母 30%、随机 40% 计算", () => {
  const perfect = { hp: 100, attack: 100, defense: 100 };
  const chance = potentialInheritanceChance(perfect, perfect);
  const oneStat = 0.6 + 0.4 / 101;
  assert.ok(Math.abs(chance - oneStat ** 3) < 1e-12);
  assert.equal(potentialInheritanceChance({ hp: null, attack: null, defense: null }, { hp: null, attack: null, defense: null }), 1);
});

test("一对异性个体可把两个词条传给一步子代", () => {
  const data = fixture([["C", "A", "B", "WILDCARD", "WILDCARD"]]);
  const inventory: InventoryPal[] = [
    { id: "a", palId: "A", sex: "M", passives: ["甲"] },
    { id: "b", palId: "B", sex: "F", passives: ["乙"] },
  ];
  const plan = findTargetPlan(searchBreedingPlans(data, inventory, ["甲", "乙"]), "C");
  assert.ok(plan);
  assert.equal(plan.generations, 1);
  assert.equal(plan.steps.length, 1);
  assert.deepEqual(plan.coveredPassives, ["甲", "乙"]);
  assert.equal(plan.steps[0].chance, 0.24);
});

test("普通配方拒绝同性配对", () => {
  const data = fixture([["C", "A", "B", "WILDCARD", "WILDCARD"]]);
  const inventory: InventoryPal[] = [
    { id: "a", palId: "A", sex: "F", passives: [] },
    { id: "b", palId: "B", sex: "F", passives: [] },
  ];
  assert.equal(findTargetPlan(searchBreedingPlans(data, inventory, []), "C"), null);
});

test("性别限定配方严格匹配父母位置", () => {
  const data = fixture([["C", "A", "B", "MALE", "FEMALE"]]);
  const valid: InventoryPal[] = [
    { id: "a", palId: "A", sex: "M", passives: [] },
    { id: "b", palId: "B", sex: "F", passives: [] },
  ];
  const invalid: InventoryPal[] = [
    { id: "a", palId: "A", sex: "F", passives: [] },
    { id: "b", palId: "B", sex: "M", passives: [] },
  ];
  assert.ok(findTargetPlan(searchBreedingPlans(data, valid, []), "C"));
  assert.equal(findTargetPlan(searchBreedingPlans(data, invalid, []), "C"), null);
});

test("1.0 全量图谱可从示例库存生成可执行推荐", async () => {
  const data = JSON.parse(await readFile(new URL("../public/data/breeding-data.json", import.meta.url), "utf8")) as BreedingData;
  const inventory: InventoryPal[] = [
    { id: "demo-1", palId: "1:0", sex: "F", passives: ["卓绝技艺"] },
    { id: "demo-2", palId: "2:0", sex: "M", passives: ["破坏神"] },
    { id: "demo-3", palId: "3:0", sex: "F", passives: ["神速"] },
    { id: "demo-4", palId: "4:0", sex: "M", passives: ["不死之身"] },
    { id: "demo-5", palId: "6:0", sex: "F", passives: ["传说"] },
  ];
  const started = performance.now();
  const search = searchBreedingPlans(data, inventory, ["破坏神", "不死之身", "神速", "传说"]);
  const elapsed = performance.now() - started;
  const summary = summarizeSearch(search);
  const recommendations = recommendTargets(data, search, "combat", 10);

  assert.ok(elapsed < 8_000, `全量规划耗时过长：${Math.round(elapsed)}ms`);
  assert.ok(summary.reachablePals > 20);
  assert.ok(recommendations.length > 0);
  for (const result of recommendations) {
    for (const step of result.steps) {
      assert.ok(data.combos.some((combo) => combo[0] === step.childId && combo[1] === step.parentA.palId && combo[2] === step.parentB.palId));
      assert.ok(step.chance > 0 && step.chance <= 1);
    }
  }
});
