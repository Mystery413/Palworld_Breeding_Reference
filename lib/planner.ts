export type Sex = "M" | "F" | "A";

export type InventoryPal = {
  id: string;
  palId: string;
  sex: "M" | "F";
  passives: string[];
  hp?: number | null;
  attack?: number | null;
  defense?: number | null;
  nickname?: string;
};

export type Pal = {
  id: string;
  dex: string;
  name: string;
  nameZh: string;
  comboCount: number;
  genderSpecificComboCount: number;
  stats: {
    hp: number | null;
    attack: number | null;
    defense: number | null;
    workSpeed: number | null;
    rarity: number | null;
    breedingPower: number | null;
    maleRate: number | null;
  };
  work: Record<string, number>;
  elements: string[];
  image: string;
  sourceUrl: string;
  habitat?: {
    catchable: boolean;
    minLevel: number | null;
    maxLevel: number | null;
    dayCount: number;
    nightCount: number;
    worldTreeDayCount: number;
    worldTreeNightCount: number;
    summary: string;
    locations: Array<{
      world: "palpagos" | "worldTree";
      x: number;
      y: number;
      time: "day" | "night" | "both";
      level?: number;
      boss?: boolean;
    }>;
    mapSourceUrl: string;
  };
};

export type ComboTuple = [string, string, string, "WILDCARD" | "MALE" | "FEMALE", "WILDCARD" | "MALE" | "FEMALE"];

export type Potentials = {
  hp: number | null;
  attack: number | null;
  defense: number | null;
};

export type BreedingData = {
  version: string;
  exportedAt: string;
  generatedAt: string;
  pals: Pal[];
  combos: ComboTuple[];
};

type PlanNode = {
  nodeId: string;
  palId: string;
  sex: Sex;
  mask: number;
  passives: string[];
  depth: number;
  eggSteps: number;
  totalExpectedEggs: number;
  kind: "owned" | "captured" | "bred";
  inventoryId?: string;
  nickname?: string;
  parents?: [PlanNode, PlanNode];
  combo?: ComboTuple;
  stepChance?: number;
  duplicateParent?: boolean;
  potentials: Potentials;
};

export type PlanStep = {
  id: string;
  index: number;
  childId: string;
  parentA: PlanParent;
  parentB: PlanParent;
  genderA: string;
  genderB: string;
  inheritedPassives: string[];
  chance: number;
  potentialChance: number;
  combinedChance: number;
  potentialTargets: Potentials;
  expectedEggs: number;
  duplicateParent: boolean;
  duplicateAction: "catch" | "breed" | null;
};

export type PlanParent = {
  nodeId: string;
  palId: string;
  source: "owned" | "captured" | "bred";
  inventoryId?: string;
  nickname?: string;
  passives: string[];
};

export type PlanResult = {
  node: PlanNode;
  source: "owned" | "captured" | "bred";
  steps: PlanStep[];
  generations: number;
  breedingSteps: number;
  expectedEggs: number;
  coveredPassives: string[];
  missingPassives: string[];
  captures: Array<{ palId: string; count: number }>;
};

export type Recommendation = PlanResult & {
  pal: Pal;
  score: number;
  qualityScore: number;
  profile: Profile;
};

export type Profile = "combat" | "attack" | "worker" | "balanced";

type SearchResult = {
  states: Map<string, PlanNode>;
  statesByPal: Map<string, PlanNode[]>;
  desiredPassives: string[];
  fullMask: number;
};

export type SearchOptions = {
  maxGenerations?: number;
  catchablePalIds?: string[];
};

const INHERIT_ROLL: Record<number, number> = { 1: 0.4, 2: 0.3, 3: 0.2, 4: 0.1 };
const CLEAN_EXACT: Record<number, number> = { 0: 1, 1: 0.4, 2: 0.24, 3: 0.12, 4: 0.1 };

function popcount(value: number): number {
  let n = value;
  let count = 0;
  while (n) {
    n &= n - 1;
    count += 1;
  }
  return count;
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= Math.min(k, n - k); i += 1) {
    result = (result * (n - i + 1)) / i;
  }
  return result;
}

export function passiveInheritanceChance(poolSize: number, desiredCount: number): number {
  if (desiredCount === 0) return 1;
  if (poolSize < desiredCount || desiredCount > 4) return 0;
  if (poolSize === desiredCount) return CLEAN_EXACT[desiredCount] ?? 0;
  const rollChance = INHERIT_ROLL[desiredCount] ?? 0;
  const noRandomExtra = desiredCount === 4 ? 1 : 0.4;
  return rollChance * (1 / choose(poolSize, desiredCount)) * noRandomExtra;
}

function sexMatches(actual: Sex, required: "MALE" | "FEMALE"): boolean {
  return actual === "A" || actual === (required === "MALE" ? "M" : "F");
}

function normalSexCompatible(a: PlanNode, b: PlanNode): boolean {
  if (a.sex === "A" || b.sex === "A") return true;
  return a.sex !== b.sex;
}

function comboCompatible(a: PlanNode, b: PlanNode, combo: ComboTuple): boolean {
  const genderA = combo[3];
  const genderB = combo[4];
  if (genderA === "WILDCARD" && genderB === "WILDCARD") {
    if (a.nodeId === b.nodeId && a.kind === "owned") return false;
    return normalSexCompatible(a, b);
  }
  return sexMatches(a.sex, genderA as "MALE" | "FEMALE") && sexMatches(b.sex, genderB as "MALE" | "FEMALE");
}

function stateKey(node: Pick<PlanNode, "palId" | "mask" | "sex">): string {
  return `${node.palId}|${node.mask}|${node.sex}`;
}

function isBetter(next: PlanNode, current?: PlanNode): boolean {
  if (!current) return true;
  if (next.depth !== current.depth) return next.depth < current.depth;
  if (next.eggSteps !== current.eggSteps) return next.eggSteps < current.eggSteps;
  if (Math.abs(next.totalExpectedEggs - current.totalExpectedEggs) > 0.001) {
    return next.totalExpectedEggs < current.totalExpectedEggs;
  }
  return potentialScore(next.potentials) > potentialScore(current.potentials);
}

function potentialScore(potentials: Potentials): number {
  return (potentials.hp ?? 0) + (potentials.attack ?? 0) + (potentials.defense ?? 0);
}

function potentialTargets(a: Potentials, b: Potentials): Potentials {
  const best = (left: number | null, right: number | null) => {
    if (left == null) return right;
    if (right == null) return left;
    return Math.max(left, right);
  };
  return { hp: best(a.hp, b.hp), attack: best(a.attack, b.attack), defense: best(a.defense, b.defense) };
}

export function potentialInheritanceChance(a: Potentials, b: Potentials, targets = potentialTargets(a, b)): number {
  const chanceFor = (left: number | null, right: number | null, target: number | null) => {
    if (target == null) return 1;
    const threshold = Math.max(0, Math.min(100, Math.ceil(target)));
    const fromLeft = left != null && left >= threshold ? 0.3 : 0;
    const fromRight = right != null && right >= threshold ? 0.3 : 0;
    const fromRandom = 0.4 * ((101 - threshold) / 101);
    return fromLeft + fromRight + fromRandom;
  };
  return (
    chanceFor(a.hp, b.hp, targets.hp) *
    chanceFor(a.attack, b.attack, targets.attack) *
    chanceFor(a.defense, b.defense, targets.defense)
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function maskFor(passives: string[], desired: string[]): number {
  const set = new Set(passives);
  return desired.reduce((mask, passive, index) => mask | (set.has(passive) ? 1 << index : 0), 0);
}

function passivesForMask(mask: number, desired: string[]): string[] {
  return desired.filter((_, index) => (mask & (1 << index)) !== 0);
}

export function searchBreedingPlans(
  data: BreedingData,
  inventory: InventoryPal[],
  requestedPassives: string[],
  options: SearchOptions = {},
): SearchResult {
  const desiredPassives = unique(requestedPassives).slice(0, 4);
  const fullMask = desiredPassives.length ? (1 << desiredPassives.length) - 1 : 0;
  const maxGenerations = Math.max(0, Math.min(4, options.maxGenerations ?? 4));
  const recipesByParent = new Map<string, number[]>();
  data.combos.forEach((combo, index) => {
    for (const parentId of new Set([combo[1], combo[2]])) {
      const list = recipesByParent.get(parentId) ?? [];
      list.push(index);
      recipesByParent.set(parentId, list);
    }
  });

  const states = new Map<string, PlanNode>();
  const statesByPal = new Map<string, PlanNode[]>();
  const queue: PlanNode[] = [];
  let generatedId = 0;

  const addState = (node: PlanNode) => {
    const key = stateKey(node);
    const current = states.get(key);
    if (!isBetter(node, current)) return;
    states.set(key, node);
    const list = (statesByPal.get(node.palId) ?? []).filter((item) => stateKey(item) !== key);
    list.push(node);
    statesByPal.set(node.palId, list);
    queue.push(node);
  };

  inventory.forEach((item) => {
    const passives = unique(item.passives);
    addState({
      nodeId: `owned:${item.id}`,
      palId: item.palId,
      sex: item.sex,
      mask: maskFor(passives, desiredPassives),
      passives,
      depth: 0,
      eggSteps: 0,
      totalExpectedEggs: 0,
      kind: "owned",
      inventoryId: item.id,
      nickname: item.nickname,
      potentials: { hp: item.hp ?? null, attack: item.attack ?? null, defense: item.defense ?? null },
    });
  });

  unique(options.catchablePalIds ?? []).forEach((palId) => {
    addState({
      nodeId: `captured:${palId}`,
      palId,
      sex: "A",
      mask: 0,
      passives: [],
      depth: 0,
      eggSteps: 0,
      totalExpectedEggs: 0,
      kind: "captured",
      potentials: { hp: null, attack: null, defense: null },
    });
  });

  let cursor = 0;
  const maxQueuedStates = Math.max(25_000, data.pals.length * Math.max(1, 1 << desiredPassives.length) * 5);
  while (cursor < queue.length && queue.length < maxQueuedStates) {
    const changed = queue[cursor++];
    if (states.get(stateKey(changed)) !== changed) continue;
    for (const comboIndex of recipesByParent.get(changed.palId) ?? []) {
      const combo = data.combos[comboIndex];
      const changedIsA = combo[1] === changed.palId;
      const otherPalId = changedIsA ? combo[2] : combo[1];
      for (const other of statesByPal.get(otherPalId) ?? []) {
        const parentA = changedIsA ? changed : other;
        const parentB = changedIsA ? other : changed;
        if (!comboCompatible(parentA, parentB, combo)) continue;
        const mask = parentA.mask | parentB.mask;
        const inheritedPassives = passivesForMask(mask, desiredPassives);
        const parentPool = unique([...parentA.passives, ...parentB.passives]);
        const chance = passiveInheritanceChance(parentPool.length, inheritedPassives.length);
        const potentials = potentialTargets(parentA.potentials, parentB.potentials);
        const ivChance = potentialInheritanceChance(parentA.potentials, parentB.potentials, potentials);
        const combinedChance = chance * ivChance;
        const duplicateParent = parentA.nodeId === parentB.nodeId;
        const duplicateBreedingCost = duplicateParent && parentA.kind === "bred";
        const depth = Math.max(parentA.depth, parentB.depth) + 1;
        if (depth > maxGenerations) continue;
        const node: PlanNode = {
          nodeId: `bred:${generatedId++}`,
          palId: combo[0],
          sex: "A",
          mask,
          passives: inheritedPassives,
          depth,
          eggSteps: parentA.eggSteps + parentB.eggSteps + 1 + (duplicateBreedingCost ? 1 : 0),
          totalExpectedEggs:
            parentA.totalExpectedEggs +
            parentB.totalExpectedEggs +
            (combinedChance > 0 ? 1 / combinedChance : 9999) +
            (duplicateBreedingCost ? 1 / Math.max(combinedChance, 0.01) : 0),
          kind: "bred",
          parents: [parentA, parentB],
          combo,
          stepChance: chance,
          duplicateParent,
          potentials,
        };
        addState(node);
      }
    }
  }

  return { states, statesByPal, desiredPassives, fullMask };
}

function parentSummary(node: PlanNode): PlanParent {
  return {
    nodeId: node.nodeId,
    palId: node.palId,
    source: node.kind,
    inventoryId: node.inventoryId,
    nickname: node.nickname,
    passives: node.passives,
  };
}

function flattenSteps(node: PlanNode): PlanStep[] {
  const steps: PlanStep[] = [];
  const seen = new Set<string>();
  const visit = (current: PlanNode) => {
    if (current.kind !== "bred" || !current.parents || !current.combo || seen.has(current.nodeId)) return;
    visit(current.parents[0]);
    visit(current.parents[1]);
    seen.add(current.nodeId);
    steps.push({
      id: current.nodeId,
      index: steps.length + 1,
      childId: current.palId,
      parentA: parentSummary(current.parents[0]),
      parentB: parentSummary(current.parents[1]),
      genderA: current.combo[3],
      genderB: current.combo[4],
      inheritedPassives: current.passives,
      chance: current.stepChance ?? 1,
      potentialChance: potentialInheritanceChance(current.parents[0].potentials, current.parents[1].potentials, current.potentials),
      combinedChance:
        (current.stepChance ?? 1) *
        potentialInheritanceChance(current.parents[0].potentials, current.parents[1].potentials, current.potentials),
      potentialTargets: current.potentials,
      expectedEggs:
        1 /
        Math.max(
          0.0001,
          (current.stepChance ?? 1) *
            potentialInheritanceChance(current.parents[0].potentials, current.parents[1].potentials, current.potentials),
        ),
      duplicateParent: Boolean(current.duplicateParent),
      duplicateAction: current.duplicateParent
        ? current.parents[0].kind === "captured"
          ? "catch"
          : "breed"
        : null,
    });
  };
  visit(node);
  return steps.map((step, index) => ({ ...step, index: index + 1 }));
}

function toPlanResult(node: PlanNode, desiredPassives: string[], fullMask: number): PlanResult {
  const steps = flattenSteps(node);
  const captureCounts = new Map<string, number>();
  if (node.kind === "captured") captureCounts.set(node.palId, 1);
  for (const step of steps) {
    const countsInStep = new Map<string, number>();
    for (const parent of [step.parentA, step.parentB]) {
      if (parent.source === "captured") {
        countsInStep.set(parent.palId, (countsInStep.get(parent.palId) ?? 0) + 1);
      }
    }
    for (const [palId, count] of countsInStep) {
      captureCounts.set(palId, Math.max(captureCounts.get(palId) ?? 0, count));
    }
  }
  return {
    node,
    source: node.kind,
    steps,
    generations: node.depth,
    breedingSteps: node.eggSteps,
    expectedEggs: node.totalExpectedEggs,
    coveredPassives: passivesForMask(node.mask, desiredPassives),
    missingPassives: passivesForMask(fullMask & ~node.mask, desiredPassives),
    captures: [...captureCounts].map(([palId, count]) => ({ palId, count })),
  };
}

export function findTargetPlan(search: SearchResult, targetPalId: string): PlanResult | null {
  const candidates = search.statesByPal.get(targetPalId) ?? [];
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => {
    const coverage = popcount(b.mask) - popcount(a.mask);
    if (coverage) return coverage;
    if (a.depth !== b.depth) return a.depth - b.depth;
    if (a.eggSteps !== b.eggSteps) return a.eggSteps - b.eggSteps;
    return a.totalExpectedEggs - b.totalExpectedEggs;
  });
  return toPlanResult(sorted[0], search.desiredPassives, search.fullMask);
}

export function palQualityScore(pal: Pal, profile: Profile): number {
  const hp = pal.stats.hp ?? 0;
  const attack = pal.stats.attack ?? 0;
  const defense = pal.stats.defense ?? 0;
  const rarity = pal.stats.rarity ?? 0;
  const workLevels = Object.values(pal.work);
  const maxWork = workLevels.length ? Math.max(...workLevels) : 0;
  const totalWork = workLevels.reduce((sum, value) => sum + value, 0);
  const combat = hp * 0.28 + attack * 0.5 + defense * 0.32 + rarity * 1.8;
  const offense = attack * 0.72 + hp * 0.12 + defense * 0.16 + rarity * 2;
  const worker = maxWork * 18 + totalWork * 3 + (pal.stats.workSpeed ?? 0) * 0.2 + rarity;
  if (profile === "attack") return offense;
  if (profile === "worker") return worker;
  if (profile === "balanced") return combat * 0.62 + worker * 0.38;
  return combat;
}

export function recommendTargets(
  data: BreedingData,
  search: SearchResult,
  profile: Profile,
  limit = 8,
): Recommendation[] {
  const results: Recommendation[] = [];
  for (const pal of data.pals) {
    if (pal.stats.hp == null && profile !== "worker") continue;
    const plan = findTargetPlan(search, pal.id);
    if (!plan) continue;
    const coverage = plan.coveredPassives.length;
    const qualityScore = palQualityScore(pal, profile);
    const score =
      qualityScore +
      coverage * 24 -
      plan.missingPassives.length * 34 -
      plan.captures.length * 2.5 -
      plan.generations * 7 -
      Math.log2(Math.max(1, plan.expectedEggs)) * 2.5;
    results.push({ ...plan, pal, score, qualityScore, profile });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function summarizeSearch(search: SearchResult): { reachablePals: number; fullTraitPals: number } {
  let fullTraitPals = 0;
  for (const states of search.statesByPal.values()) {
    if (states.some((state) => state.mask === search.fullMask)) fullTraitPals += 1;
  }
  return { reachablePals: search.statesByPal.size, fullTraitPals };
}
