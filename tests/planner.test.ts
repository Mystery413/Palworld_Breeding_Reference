import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  type BreedingData,
  type InventoryPal,
  findTargetPlan,
  findTargetPlans,
  passiveInheritanceChance,
  potentialInheritanceChance,
  recommendTargets,
  searchBreedingPlans,
  selectCaptureSource,
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

test("路线最多允许四代，五代目标不会被误报可达", () => {
  const data = fixture([
    ["C", "A", "B", "WILDCARD", "WILDCARD"],
    ["D", "C", "B", "WILDCARD", "WILDCARD"],
    ["E", "D", "B", "WILDCARD", "WILDCARD"],
    ["F", "E", "B", "WILDCARD", "WILDCARD"],
    ["G", "F", "B", "WILDCARD", "WILDCARD"],
  ]);
  const inventory: InventoryPal[] = [
    { id: "a", palId: "A", sex: "M", passives: ["甲"] },
    { id: "b", palId: "B", sex: "F", passives: [] },
  ];
  const search = searchBreedingPlans(data, inventory, ["甲"], { maxGenerations: 4 });
  assert.equal(findTargetPlan(search, "F")?.generations, 4);
  assert.equal(findTargetPlan(search, "G"), null);
});

test("默认限制页面实际显示为四个步骤，并允许手动放宽", () => {
  const data = fixture([
    ["C", "A", "B", "WILDCARD", "WILDCARD"],
    ["D", "E", "F", "WILDCARD", "WILDCARD"],
    ["G", "H", "I", "WILDCARD", "WILDCARD"],
    ["J", "C", "D", "WILDCARD", "WILDCARD"],
    ["K", "J", "G", "WILDCARD", "WILDCARD"],
  ]);
  const inventory: InventoryPal[] = ["A", "B", "E", "F", "H", "I"].map((palId, index) => ({
    id: palId,
    palId,
    sex: index % 2 ? "F" : "M",
    passives: [],
  }));
  assert.equal(findTargetPlan(searchBreedingPlans(data, inventory, []), "K"), null);
  const expanded = findTargetPlan(searchBreedingPlans(data, inventory, [], { maxBreedingSteps: 5, maxGenerations: 5 }), "K");
  assert.ok(expanded);
  assert.equal(expanded.steps.length, 5);
});

test("规划器可以把符合等级限制的待捕捉帕鲁作为种源", () => {
  const data = fixture([["C", "A", "B", "WILDCARD", "WILDCARD"]]);
  const inventory: InventoryPal[] = [{ id: "a", palId: "A", sex: "M", passives: ["甲"] }];
  const withoutCapture = searchBreedingPlans(data, inventory, ["甲"], { maxGenerations: 4 });
  const withCapture = searchBreedingPlans(data, inventory, ["甲"], { maxGenerations: 4, catchablePalIds: ["B"] });
  assert.equal(findTargetPlan(withoutCapture, "C"), null);
  const plan = findTargetPlan(withCapture, "C");
  assert.ok(plan);
  assert.deepEqual(plan.captures, [{ palId: "B", level: 1, maxLevel: 1, kind: "wild", difficulty: 1, count: 1 }]);
  assert.equal(plan.steps[0].parentB.source, "captured");
});

test("指定目标路线强制从库存帕鲁出发，并完整满足目标词条", () => {
  const data = fixture([["C", "A", "B", "WILDCARD", "WILDCARD"]]);
  const inventory: InventoryPal[] = [{ id: "owned-a", palId: "A", sex: "M", passives: ["甲"] }];
  const search = searchBreedingPlans(data, inventory, ["甲"], {
    captureSources: [
      { palId: "B", level: 1, maxLevel: 1, kind: "wild", difficulty: 1 },
      { palId: "C", level: 1, maxLevel: 1, kind: "wild", difficulty: 1 },
    ],
  });
  const plan = findTargetPlan(search, "C", { requireOwnedAncestry: true, requireFullPassives: true });
  assert.ok(plan);
  assert.equal(plan.source, "bred");
  assert.deepEqual(plan.coveredPassives, ["甲"]);
  assert.deepEqual(plan.ownedInventoryIds, ["owned-a"]);
});

test("目标词条留空时仍可查询库存起点路线，并返回多个库存方案", () => {
  const data = fixture([
    ["C", "A", "B", "WILDCARD", "WILDCARD"],
    ["C", "D", "E", "WILDCARD", "WILDCARD"],
  ]);
  const inventory: InventoryPal[] = [
    { id: "owned-a", palId: "A", sex: "M", passives: [] },
    { id: "owned-d", palId: "D", sex: "M", passives: [] },
  ];
  const search = searchBreedingPlans(data, inventory, [], { catchablePalIds: ["B", "E", "C"] });
  const plans = findTargetPlans(search, "C", { requireOwnedAncestry: true, requireFullPassives: true }, 4);
  assert.equal(plans.length, 2);
  assert.deepEqual(plans.map((plan) => plan.ownedInventoryIds[0]).sort(), ["owned-a", "owned-d"]);
});

test("全部目标路线优先普通捕捉，含 Boss 的路线排列在后", () => {
  const data = fixture([
    ["C", "A", "B", "WILDCARD", "WILDCARD"],
    ["C", "D", "E", "WILDCARD", "WILDCARD"],
  ]);
  const inventory: InventoryPal[] = [
    { id: "owned-a", palId: "A", sex: "M", passives: [] },
    { id: "owned-d", palId: "D", sex: "M", passives: [] },
  ];
  const search = searchBreedingPlans(data, inventory, [], {
    captureSources: [
      { palId: "B", level: 20, maxLevel: 20, kind: "wild", difficulty: 20 },
      { palId: "E", level: 1, maxLevel: 1, kind: "alpha", difficulty: 1 },
    ],
  });
  const plans = findTargetPlans(search, "C", { requireOwnedAncestry: true });
  assert.equal(plans.length, 2);
  assert.equal(plans[0].bossCaptureCount, 0);
  assert.equal(plans[1].bossCaptureCount, 1);
  assert.ok(plans[0].routePriority < plans[1].routePriority);
});

test("无 Boss 路线中优先需要新捕捉帕鲁更少的方案", () => {
  const data = fixture([
    ["C", "A", "B", "WILDCARD", "WILDCARD"],
    ["E", "X", "Y", "WILDCARD", "WILDCARD"],
    ["C", "D", "E", "WILDCARD", "WILDCARD"],
  ]);
  const inventory: InventoryPal[] = [
    { id: "owned-a", palId: "A", sex: "M", passives: [] },
    { id: "owned-d", palId: "D", sex: "M", passives: [] },
  ];
  const search = searchBreedingPlans(data, inventory, [], {
    captureSources: [
      { palId: "B", level: 30, maxLevel: 30, kind: "wild", difficulty: 30 },
      { palId: "X", level: 1, maxLevel: 1, kind: "wild", difficulty: 1 },
      { palId: "Y", level: 1, maxLevel: 1, kind: "wild", difficulty: 1 },
    ],
  });
  const plans = findTargetPlans(search, "C", { requireOwnedAncestry: true });
  assert.ok(plans.some((plan) => plan.newCaptureCount === 2));
  assert.equal(plans[0].newCaptureCount, 1);
  assert.equal(plans[0].captures[0].palId, "B");
});

test("捕捉来源严格排除等级上限外目标，并区分普通野生与 Alpha", () => {
  const data = fixture([["C", "A", "B", "WILDCARD", "WILDCARD"]]);
  const pal = data.pals[0];
  pal.habitat = {
    catchable: true,
    minLevel: 20,
    maxLevel: 40,
    wildMinLevel: 31,
    wildMaxLevel: 40,
    commonWildMinLevel: 31,
    commonWildMaxLevel: 33,
    bossMinLevel: 20,
    bossMaxLevel: 20,
    dayCount: 1,
    nightCount: 1,
    worldTreeDayCount: 0,
    worldTreeNightCount: 0,
    summary: "",
    locations: [],
    mapSourceUrl: "",
  };
  assert.equal(selectCaptureSource(pal, 19), null);
  assert.equal(selectCaptureSource(pal, 20)?.kind, "alpha");
  assert.equal(selectCaptureSource(pal, 20)?.level, 20);
  assert.equal(selectCaptureSource(pal, 31)?.kind, "wild");
  assert.equal(selectCaptureSource(pal, 31)?.maxLevel, 31);
});

test("同一目标存在多条路线时优先普通低等级种源，避免高难度 Alpha", () => {
  const data = fixture([
    ["C", "A", "B", "WILDCARD", "WILDCARD"],
    ["C", "D", "E", "WILDCARD", "WILDCARD"],
  ]);
  const search = searchBreedingPlans(data, [], [], {
    captureSources: [
      { palId: "A", level: 10, maxLevel: 10, kind: "alpha", difficulty: 28 },
      { palId: "B", level: 10, maxLevel: 10, kind: "wild", difficulty: 10 },
      { palId: "D", level: 5, maxLevel: 8, kind: "wild", difficulty: 5 },
      { palId: "E", level: 5, maxLevel: 8, kind: "wild", difficulty: 5 },
    ],
  });
  const plan = findTargetPlan(search, "C");
  assert.ok(plan);
  assert.deepEqual(plan.captures.map((capture) => capture.palId).sort(), ["D", "E"]);
  assert.ok(plan.captures.every((capture) => capture.kind === "wild"));
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

test("全量 1.0 图谱只引入玩家等级加八以内的野外种源", async () => {
  const data = JSON.parse(await readFile(new URL("../public/data/breeding-data.json", import.meta.url), "utf8")) as BreedingData;
  const playerLevel = 12;
  const captureSources = data.pals.flatMap((pal) => {
    const source = selectCaptureSource(pal, playerLevel + 8);
    return source ? [source] : [];
  });
  assert.ok(captureSources.length > 0);
  assert.ok(captureSources.every((source) => source.level <= 20 && source.maxLevel <= 20));
  const search = searchBreedingPlans(data, [], [], { maxGenerations: 4, captureSources });
  const recommendations = recommendTargets(data, search, "combat", 5);
  assert.ok(recommendations.length > 0);
  assert.ok(recommendations.every((result) => result.generations <= 4));
  assert.ok(recommendations.every((result) => result.steps.length <= 4));
  assert.ok(recommendations.flatMap((result) => result.captures).every((capture) => capture.level <= 20 && capture.maxLevel <= 20));
});
