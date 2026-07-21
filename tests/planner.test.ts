import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  type BreedingData,
  type InventoryPal,
  calculateOffspring,
  findTargetPlan,
  findTargetPlans,
  findBreedingPartners,
  groupTargetPlans,
  hasComplexityDifficultyTradeoff,
  isWorldTreeOnlyPal,
  passiveExactChance,
  passiveInheritanceChance,
  passiveInheritanceOutcome,
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

test("可用词条率允许目标词条齐全的子代携带额外词条", () => {
  assert.equal(passiveInheritanceChance(1, 1), 0.4);
  assert.equal(passiveInheritanceChance(2, 2), 0.3);
  assert.equal(passiveInheritanceChance(3, 3), 0.2);
  assert.equal(passiveInheritanceChance(4, 4), 0.1);
  assert.ok(Math.abs(passiveInheritanceChance(6, 4) - 0.1 / 15) < 1e-12);
  assert.equal(passiveExactChance(2, 2), 0.24);
  const polluted = passiveInheritanceOutcome(3, 1);
  assert.ok(Math.abs(polluted.usableChance - (0.4 / 3 + 0.3 * 2 / 3 + 0.2)) < 1e-12);
  assert.ok(polluted.usableChance > polluted.exactChance);
  assert.ok(polluted.expectedExtraPassives > 0);
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
  assert.equal(plan.steps[0].chance, 0.3);
  assert.equal(plan.steps[0].exactChance, 0.24);
  assert.equal(plan.steps[0].selectionMode, "usable");
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

test("综合难度按一枚蛋等价 30 级普通捕捉计算", () => {
  const data = fixture([["C", "A", "B", "WILDCARD", "WILDCARD"]]);
  const inventory: InventoryPal[] = [{ id: "owned-a", palId: "A", sex: "M", passives: [] }];
  const plan = findTargetPlans(
    searchBreedingPlans(data, inventory, [], {
      captureSources: [{ palId: "B", level: 10, maxLevel: 10, kind: "wild", difficulty: 10 }],
    }),
    "C",
    { requireOwnedAncestry: true },
  )[0];
  assert.ok(plan);
  assert.equal(plan.expectedEggs, 1);
  assert.equal(plan.captureDifficulty, 10);
  assert.equal(plan.eggDifficulty, 30);
  assert.equal(plan.difficultyScore, 40);
});

test("中间亲代所需性别会增加预计蛋数与综合难度", () => {
  const data = fixture([
    ["C", "A", "B", "WILDCARD", "WILDCARD"],
    ["T", "C", "D", "WILDCARD", "WILDCARD"],
  ]);
  const intermediate = data.pals.find((pal) => pal.id === "C");
  assert.ok(intermediate);
  intermediate.stats.maleRate = 80;
  const inventory: InventoryPal[] = [
    { id: "owned-a", palId: "A", sex: "M", passives: [] },
    { id: "owned-d", palId: "D", sex: "M", passives: [] },
  ];
  const plan = findTargetPlans(
    searchBreedingPlans(data, inventory, [], { catchablePalIds: ["B"] }),
    "T",
    { requireOwnedAncestry: true },
  ).find((candidate) => candidate.breedingSteps === 2);
  assert.ok(plan);
  assert.equal(plan.steps[0].sexRequirement, "F");
  assert.ok(Math.abs(plan.steps[0].sexChance - 0.2) < 1e-12);
  assert.ok(Math.abs(plan.steps[0].expectedEggs - 5) < 1e-12);
  assert.ok(Math.abs(plan.expectedEggs - 6) < 1e-12);
  assert.ok(Math.abs(plan.difficultyScore - 181) < 1e-12);
});

test("重复使用的补抓亲代会把性别要求传递到中间子代", () => {
  const data = fixture([
    ["C", "A", "B", "WILDCARD", "WILDCARD"],
    ["D", "C", "B", "WILDCARD", "WILDCARD"],
  ]);
  const search = searchBreedingPlans(data, [{ id: "owned-a", palId: "A", sex: "F", passives: [] }], [], {
    maxGenerations: 2,
    captureSources: [{ palId: "B", level: 10, maxLevel: 10, kind: "wild", difficulty: 10 }],
  });
  const plan = findTargetPlan(search, "D", { requireOwnedAncestry: true });
  assert.ok(plan);
  assert.equal(plan.steps[0].sexRequirement, "F");
  assert.equal(plan.steps[0].expectedEggs, 2);
  assert.equal(plan.expectedEggs, 3);
});

test("同一补抓物种在不同步骤需要两种性别时计为两只", () => {
  const data = fixture([
    ["C", "A", "B", "WILDCARD", "WILDCARD"],
    ["D", "C", "B", "MALE", "FEMALE"],
  ]);
  const search = searchBreedingPlans(data, [{ id: "owned-a", palId: "A", sex: "F", passives: [] }], [], {
    maxGenerations: 2,
    captureSources: [{ palId: "B", level: 10, maxLevel: 10, kind: "wild", difficulty: 10 }],
  });
  const plan = findTargetPlan(search, "D", { requireOwnedAncestry: true });
  assert.ok(plan);
  assert.equal(plan.captures[0].count, 2);
  assert.equal(plan.newCaptureCount, 2);
  assert.equal(plan.captureDifficulty, 20);
});

test("杂词条不再把含有目标词条的可用子代判废", () => {
  const data = fixture([["C", "A", "B", "WILDCARD", "WILDCARD"]]);
  const route = (passives: string[]) => findTargetPlans(
    searchBreedingPlans(data, [{ id: "owned-a", palId: "A", sex: "M", passives }], ["目标词条"], { catchablePalIds: ["B"] }),
    "C",
    { requireOwnedAncestry: true, requireFullPassives: true },
  )[0];
  const clean = route(["目标词条"]);
  const polluted = route(["目标词条", "无用词条一", "负面词条"]);
  assert.ok(clean && polluted);
  assert.equal(clean.expectedEggs, 2.5);
  assert.ok(polluted.expectedEggs < 3);
  assert.ok(polluted.expectedEggs < 18.75 / 4);
  assert.ok(polluted.finalExtraPassiveCount > 0);
  assert.ok(polluted.passivePollutionDifficulty > 0);
  assert.equal(polluted.steps[0].selectionMode, "usable");
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

test("仅替换同一位置帕鲁的路线合并为一种方法", () => {
  const data = fixture([
    ["C", "A", "B", "WILDCARD", "WILDCARD"],
    ["C", "D", "E", "WILDCARD", "WILDCARD"],
    ["F", "A", "B", "WILDCARD", "WILDCARD"],
    ["C", "F", "G", "WILDCARD", "WILDCARD"],
  ]);
  const inventory: InventoryPal[] = [
    { id: "owned-a", palId: "A", sex: "M", passives: [] },
    { id: "owned-d", palId: "D", sex: "M", passives: [] },
  ];
  const plans = findTargetPlans(
    searchBreedingPlans(data, inventory, [], { maxGenerations: 2, maxBreedingSteps: 12, catchablePalIds: ["B", "E", "G"] }),
    "C",
    { requireOwnedAncestry: true },
  );
  const groups = groupTargetPlans(plans);
  const directGroup = groups.find((group) => group.plans[0]?.breedingSteps === 1);
  const chainedGroup = groups.find((group) => group.plans[0]?.breedingSteps === 2);
  assert.ok(directGroup);
  assert.equal(directGroup.plans.length, 2);
  assert.ok(chainedGroup);
  assert.ok(groups.length >= 2);

  const recommended = groupTargetPlans([
    { ...directGroup.plans[0], difficultyScore: 200 },
    { ...chainedGroup.plans[0], difficultyScore: 100 },
  ], "recommended");
  const byDifficulty = groupTargetPlans([
    { ...directGroup.plans[0], difficultyScore: 200 },
    { ...chainedGroup.plans[0], difficultyScore: 100 },
  ], "difficulty");
  assert.equal(recommended[0].plans[0].breedingSteps, 1);
  assert.equal(byDifficulty[0].plans[0].breedingSteps, 2);
  assert.equal(byDifficulty.every((group) => group.plans.length === 1), true);
  assert.equal(hasComplexityDifficultyTradeoff(recommended), true);
});

test("精简计算器支持 A+B 查子代与 A+? 查目标", () => {
  const data = fixture([
    ["C", "A", "B", "MALE", "FEMALE"],
    ["D", "A", "B", "WILDCARD", "WILDCARD"],
  ]);
  assert.deepEqual(calculateOffspring(data, "B", "A"), [
    { childId: "C", parentAId: "B", parentBId: "A", parentASex: "FEMALE", parentBSex: "MALE" },
    { childId: "D", parentAId: "B", parentBId: "A", parentASex: "WILDCARD", parentBSex: "WILDCARD" },
  ]);
  assert.deepEqual(findBreedingPartners(data, "A", "C"), [
    { childId: "C", parentAId: "A", parentBId: "B", parentASex: "MALE", parentBSex: "FEMALE" },
  ]);
});

test("综合难度相同时优先普通捕捉，避免不必要的 Boss", () => {
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
      { palId: "E", level: 10, maxLevel: 10, kind: "alpha", difficulty: 20 },
    ],
  });
  const plans = findTargetPlans(search, "C", { requireOwnedAncestry: true });
  assert.equal(plans.length, 2);
  assert.equal(plans[0].bossCaptureCount, 0);
  assert.equal(plans[1].bossCaptureCount, 1);
  assert.equal(plans[0].difficultyScore, plans[1].difficultyScore);
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

test("优先按实际步骤排序，步骤相同时再按新增捕捉数量排序", () => {
  const data = fixture([
    ["E", "A", "B", "WILDCARD", "WILDCARD"],
    ["C", "E", "X", "WILDCARD", "WILDCARD"],
    ["F", "D", "Y", "WILDCARD", "WILDCARD"],
    ["C", "F", "Z", "WILDCARD", "WILDCARD"],
  ]);
  const inventory: InventoryPal[] = [
    { id: "owned-a", palId: "A", sex: "M", passives: [] },
    { id: "owned-b", palId: "B", sex: "F", passives: [] },
    { id: "owned-d", palId: "D", sex: "M", passives: [] },
  ];
  const search = searchBreedingPlans(data, inventory, [], { catchablePalIds: ["X", "Y", "Z"] });
  const plans = findTargetPlans(search, "C", { requireOwnedAncestry: true });
  const twoStepPlans = plans.filter((plan) => plan.breedingSteps === 2);
  assert.ok(twoStepPlans.some((plan) => plan.newCaptureCount === 1));
  assert.ok(twoStepPlans.some((plan) => plan.newCaptureCount === 2));
  assert.equal(twoStepPlans[0].newCaptureCount, 1);
});

test("世界树专属判定只排除没有帕洛斯群岛点位的帕鲁", () => {
  const data = fixture([["C", "A", "B", "WILDCARD", "WILDCARD"]]);
  const basePal = {
    ...data.pals[0],
    id: "tree-only",
    habitat: {
      catchable: true,
      minLevel: 1,
      maxLevel: 80,
      dayCount: 0,
      nightCount: 0,
      worldTreeDayCount: 1,
      worldTreeNightCount: 0,
      summary: "",
      locations: [{ world: "worldTree" as const, x: 0, y: 0, time: "day" as const, level: 80 }],
      mapSourceUrl: "",
    },
  };
  assert.equal(isWorldTreeOnlyPal(basePal), true);
  assert.equal(isWorldTreeOnlyPal({ ...basePal, habitat: { ...basePal.habitat, locations: [...basePal.habitat.locations, { world: "palpagos", x: 1, y: 1, time: "day", level: 20 }] } }), false);
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
  assert.equal(selectCaptureSource(pal, 20, 28)?.difficulty, 30);
  assert.equal(selectCaptureSource(pal, 31)?.kind, "wild");
  assert.equal(selectCaptureSource(pal, 31)?.maxLevel, 31);
  const highBoss = { ...pal, habitat: { ...pal.habitat, commonWildMinLevel: null, wildMinLevel: null, bossMinLevel: 40, bossMaxLevel: 40 } };
  assert.equal(selectCaptureSource(highBoss, 80, 28)?.difficulty, 58);
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

test("一代搜索保留姬小兔加燧火鸟直达云海鹿的最短路径", async () => {
  const data = JSON.parse(await readFile(new URL("../public/data/breeding-data.json", import.meta.url), "utf8")) as BreedingData;
  const strictSources = data.pals.flatMap((pal) => {
    const source = selectCaptureSource(pal, 28);
    return source ? [source] : [];
  });
  const captureSources = data.pals.flatMap((pal) => {
    const source = selectCaptureSource(pal, 80);
    return source ? [source] : [];
  });
  const inventory: InventoryPal[] = [{ id: "ribbuny", palId: "44:0", sex: "F", passives: [] }];
  const strictSearch = searchBreedingPlans(data, inventory, [], { maxGenerations: 1, maxBreedingSteps: 12, captureSources: strictSources });
  assert.equal(findTargetPlans(strictSearch, "83:0", { requireOwnedAncestry: true, requireFullPassives: true }).length, 0);
  const search = searchBreedingPlans(data, inventory, [], {
    maxGenerations: 1,
    maxBreedingSteps: 12,
    captureSources,
  });
  const plans = findTargetPlans(search, "83:0", { requireOwnedAncestry: true, requireFullPassives: true });
  const direct = plans.find((plan) => plan.steps.length === 1 && plan.steps[0].parentA.palId === "104:0" && plan.steps[0].parentB.palId === "44:0");
  assert.ok(direct);
  assert.equal(direct.breedingSteps, 1);
  assert.equal(direct.newCaptureCount, 1);

  const expandedPlans = findTargetPlans(
    searchBreedingPlans(data, inventory, [], { maxGenerations: 3, maxBreedingSteps: 12, captureSources }),
    "83:0",
    { requireOwnedAncestry: true, requireFullPassives: true },
  );
  const signature = (plan: (typeof plans)[number]) =>
    plan.steps.map((step) => `${step.childId}:${step.parentA.source}:${step.parentA.palId}+${step.parentB.source}:${step.parentB.palId}`).join(">");
  assert.deepEqual(
    expandedPlans.filter((plan) => plan.breedingSteps === 1).map(signature).sort(),
    plans.map(signature).sort(),
  );
});

test("放宽最大代数不会覆盖原有的一步直达路线", () => {
  const data = fixture([
    ["Q", "X", "Y", "WILDCARD", "WILDCARD"],
    ["P", "Q", "Z", "WILDCARD", "WILDCARD"],
    ["T", "A", "P", "WILDCARD", "WILDCARD"],
    ["T", "A", "Q", "WILDCARD", "WILDCARD"],
  ]);
  const inventory: InventoryPal[] = [{ id: "owned-a", palId: "A", sex: "M", passives: [] }];
  const captureSources = ["X", "Y", "Z"].map((palId) => ({
    palId,
    level: 1,
    maxLevel: 1,
    kind: "wild" as const,
    difficulty: 1,
  }));
  captureSources.push({ palId: "P", level: 80, maxLevel: 80, kind: "wild", difficulty: 80 });

  const oneGeneration = findTargetPlans(
    searchBreedingPlans(data, inventory, [], { maxGenerations: 1, maxBreedingSteps: 12, captureSources }),
    "T",
    { requireOwnedAncestry: true },
  );
  const threeGenerations = findTargetPlans(
    searchBreedingPlans(data, inventory, [], { maxGenerations: 3, maxBreedingSteps: 12, captureSources }),
    "T",
    { requireOwnedAncestry: true },
  );
  const directSignature = (plan: (typeof oneGeneration)[number]) =>
    plan.breedingSteps === 1 && plan.steps[0]?.parentA.palId === "A" && plan.steps[0]?.parentB.palId === "P";

  assert.equal(oneGeneration.filter(directSignature).length, 1);
  assert.equal(threeGenerations.filter(directSignature).length, 1);
  const shortSignature = (plan: (typeof oneGeneration)[number]) =>
    plan.steps.map((step) => `${step.childId}:${step.parentA.source}:${step.parentA.palId}+${step.parentB.source}:${step.parentB.palId}`).join(">");
  const atMostTwo = (plans: typeof oneGeneration) => plans.filter((plan) => plan.breedingSteps <= 2).map(shortSignature).sort();
  const twoGenerations = findTargetPlans(
    searchBreedingPlans(data, inventory, [], { maxGenerations: 2, maxBreedingSteps: 12, captureSources }),
    "T",
    { requireOwnedAncestry: true },
  );
  assert.deepEqual(atMostTwo(threeGenerations), atMostTwo(twoGenerations));
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
