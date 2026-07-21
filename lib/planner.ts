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
    wildMinLevel?: number | null;
    wildMaxLevel?: number | null;
    commonWildMinLevel?: number | null;
    commonWildMaxLevel?: number | null;
    bossMinLevel?: number | null;
    bossMaxLevel?: number | null;
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
  passives?: string[];
  passiveRanks?: Record<string, number | null>;
  combos: ComboTuple[];
};

type PlanNode = {
  nodeId: string;
  palId: string;
  sex: Sex;
  mask: number;
  passives: string[];
  /** Expected non-target passives on the selected usable offspring. */
  extraPassiveCount: number;
  depth: number;
  eggSteps: number;
  totalExpectedEggs: number;
  kind: "owned" | "captured" | "bred";
  inventoryId?: string;
  nickname?: string;
  parents?: [PlanNode, PlanNode];
  combo?: ComboTuple;
  stepChance?: number;
  stepExactChance?: number;
  selectionMode?: "usable" | "pure";
  duplicateParent?: boolean;
  potentials: Potentials;
  captureSources: CaptureSource[];
  breedingStepIds: string[];
  ownedRootId?: string;
};

export type CaptureSource = {
  palId: string;
  level: number;
  maxLevel: number;
  kind: "wild" | "alpha";
  difficulty: number;
};

export const EGG_DIFFICULTY_WEIGHT = 30;
export const PASSIVE_POLLUTION_DIFFICULTY_WEIGHT = 3;

export function selectCaptureSource(pal: Pal, levelLimit: number, recommendedLevelLimit = levelLimit): CaptureSource | null {
  const habitat = pal.habitat;
  if (!habitat?.catchable) return null;
  const candidates: CaptureSource[] = [];
  const commonWildMin = habitat.commonWildMinLevel ?? habitat.wildMinLevel;
  const commonWildMax = habitat.commonWildMaxLevel ?? habitat.wildMaxLevel;
  if (commonWildMin != null && commonWildMin <= levelLimit) {
    candidates.push({ palId: pal.id, level: commonWildMin, maxLevel: Math.min(levelLimit, commonWildMax ?? commonWildMin), kind: "wild", difficulty: commonWildMin });
  }
  if (habitat.bossMinLevel != null && habitat.bossMinLevel <= levelLimit) {
    const bossPenalty = habitat.bossMinLevel <= recommendedLevelLimit ? 10 : 18;
    candidates.push({ palId: pal.id, level: habitat.bossMinLevel, maxLevel: Math.min(levelLimit, habitat.bossMaxLevel ?? habitat.bossMinLevel), kind: "alpha", difficulty: habitat.bossMinLevel + bossPenalty });
  }
  return candidates.sort((a, b) => Number(a.kind === "alpha") - Number(b.kind === "alpha") || a.difficulty - b.difficulty || a.level - b.level)[0] ?? null;
}

export function isWorldTreeOnlyPal(pal: Pal): boolean {
  const locations = pal.habitat?.locations ?? [];
  return locations.some((location) => location.world === "worldTree") && !locations.some((location) => location.world === "palpagos");
}

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
  exactChance: number;
  expectedExtraPassives: number;
  selectionMode: "usable" | "pure";
  potentialChance: number;
  combinedChance: number;
  potentialTargets: Potentials;
  expectedEggs: number;
  sexRequirement: "M" | "F" | "BOTH" | null;
  sexChance: number;
  duplicateParent: boolean;
  duplicateAction: "catch" | "breed" | null;
};

export type PlanParent = {
  nodeId: string;
  palId: string;
  sex: Sex;
  source: "owned" | "captured" | "bred";
  inventoryId?: string;
  nickname?: string;
  passives: string[];
  extraPassiveCount: number;
  captureSource?: CaptureSource;
};

export type PlanResult = {
  node: PlanNode;
  source: "owned" | "captured" | "bred";
  steps: PlanStep[];
  generations: number;
  breedingSteps: number;
  expectedEggs: number;
  finalExtraPassiveCount: number;
  coveredPassives: string[];
  missingPassives: string[];
  captures: Array<CaptureSource & { count: number }>;
  ownedInventoryIds: string[];
  captureDifficulty: number;
  eggDifficulty: number;
  passivePollutionDifficulty: number;
  difficultyScore: number;
  bossCaptureCount: number;
  newCaptureCount: number;
  routePriority: number;
};

export type Recommendation = PlanResult & {
  pal: Pal;
  score: number;
  qualityScore: number;
  profile: Profile;
};

export type TargetPlanGroup = {
  key: string;
  plans: PlanResult[];
  planIndexes: number[];
};

export type TargetPlanSortMode = "recommended" | "difficulty";

export type BreedingCalculatorMatch = {
  childId: string;
  parentAId: string;
  parentBId: string;
  parentASex: ComboTuple[3];
  parentBSex: ComboTuple[4];
};

export function calculateOffspring(data: BreedingData, parentAId: string, parentBId: string): BreedingCalculatorMatch[] {
  if (!parentAId || !parentBId) return [];
  const matches = data.combos.flatMap((combo) => {
    if (combo[1] === parentAId && combo[2] === parentBId) {
      return [{ childId: combo[0], parentAId, parentBId, parentASex: combo[3], parentBSex: combo[4] }];
    }
    if (combo[1] === parentBId && combo[2] === parentAId) {
      return [{ childId: combo[0], parentAId, parentBId, parentASex: combo[4], parentBSex: combo[3] }];
    }
    return [];
  });
  return [...new Map(matches.map((match) => [`${match.childId}|${match.parentASex}|${match.parentBSex}`, match])).values()];
}

export function findBreedingPartners(data: BreedingData, parentId: string, childId: string): BreedingCalculatorMatch[] {
  if (!parentId || !childId) return [];
  const matches = data.combos.flatMap((combo) => {
    if (combo[0] !== childId) return [];
    if (combo[1] === parentId) {
      return [{ childId, parentAId: parentId, parentBId: combo[2], parentASex: combo[3], parentBSex: combo[4] }];
    }
    if (combo[2] === parentId) {
      return [{ childId, parentAId: parentId, parentBId: combo[1], parentASex: combo[4], parentBSex: combo[3] }];
    }
    return [];
  });
  return [...new Map(matches.map((match) => [`${match.parentBId}|${match.parentASex}|${match.parentBSex}`, match])).values()];
}

export type Profile = "combat" | "attack" | "worker" | "balanced";

type SearchResult = {
  states: Map<string, PlanNode>;
  statesByPal: Map<string, PlanNode[]>;
  desiredPassives: string[];
  fullMask: number;
  data: BreedingData;
  maxGenerations: number;
  maxBreedingSteps: number;
};

export type SearchOptions = {
  maxGenerations?: number;
  maxBreedingSteps?: number;
  catchablePalIds?: string[];
  captureSources?: CaptureSource[];
};

const INHERIT_ROLL: Record<number, number> = { 1: 0.4, 2: 0.3, 3: 0.2, 4: 0.1 };
const CLEAN_EXACT: Record<number, number> = { 0: 1, 1: 0.4, 2: 0.24, 3: 0.12, 4: 0.1 };

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= Math.min(k, n - k); i += 1) {
    result = (result * (n - i + 1)) / i;
  }
  return result;
}

export function passiveExactChance(poolSize: number, desiredCount: number): number {
  if (desiredCount === 0) return 1;
  if (poolSize < desiredCount || desiredCount > 4) return 0;
  if (poolSize === desiredCount) return CLEAN_EXACT[desiredCount] ?? 0;
  const rollChance = INHERIT_ROLL[desiredCount] ?? 0;
  const noRandomExtra = desiredCount === 4 ? 1 : 0.4;
  return rollChance * (1 / choose(poolSize, desiredCount)) * noRandomExtra;
}

export type PassiveInheritanceOutcome = {
  usableChance: number;
  exactChance: number;
  expectedExtraPassives: number;
};

/**
 * Chance that every requested passive is present. Extra passives are accepted.
 * `exactChance` remains available for routes where purifying now is cheaper
 * than carrying pollution into later generations.
 */
export function passiveInheritanceOutcome(poolSize: number, desiredCount: number): PassiveInheritanceOutcome {
  if (desiredCount === 0) return { usableChance: 1, exactChance: 1, expectedExtraPassives: 0 };
  if (poolSize < desiredCount || desiredCount > 4) {
    return { usableChance: 0, exactChance: 0, expectedExtraPassives: 0 };
  }
  let usableChance = 0;
  let inheritedExtras = 0;
  for (let inheritedCount = desiredCount; inheritedCount <= Math.min(4, poolSize); inheritedCount += 1) {
    const combinations = choose(poolSize, inheritedCount);
    if (!combinations) continue;
    const containsAllDesired = choose(poolSize - desiredCount, inheritedCount - desiredCount) / combinations;
    const contribution = (INHERIT_ROLL[inheritedCount] ?? 0) * containsAllDesired;
    usableChance += contribution;
    inheritedExtras += contribution * (inheritedCount - desiredCount);
  }
  const exactChance = passiveExactChance(poolSize, desiredCount);
  // Exact-vs-usable also captures random added passives not represented by the
  // inherited subset. One extra is a conservative expectation for dirty rolls.
  const dirtyShare = usableChance > 0 ? Math.max(0, 1 - exactChance / usableChance) : 0;
  const expectedExtraPassives = usableChance > 0
    ? Math.min(4 - desiredCount, Math.max(dirtyShare, inheritedExtras / usableChance))
    : 0;
  return { usableChance, exactChance, expectedExtraPassives };
}

/** Backwards-compatible name: this now means a usable child, not an exact child. */
export function passiveInheritanceChance(poolSize: number, desiredCount: number): number {
  return passiveInheritanceOutcome(poolSize, desiredCount).usableChance;
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

function stateKey(
  node: Pick<PlanNode, "palId" | "mask" | "sex" | "ownedRootId" | "kind" | "depth" | "breedingStepIds" | "extraPassiveCount">,
): string {
  // A directly captured parent and a bred parent of the same species are not
  // interchangeable routes. Preserve acquisition type and route length so a
  // deeper search cannot overwrite a shorter route discovered earlier.
  return [
    node.palId,
    node.mask,
    node.sex,
    node.ownedRootId ?? "capture-only",
    node.kind,
    `x${Math.round(node.extraPassiveCount * 10)}`,
    `g${node.depth}`,
    `s${node.breedingStepIds.length}`,
  ].join("|");
}

function bitCount(value: number): number {
  let count = 0;
  for (let current = value; current; current >>>= 1) count += current & 1;
  return count;
}

function passivePoolSize(parentA: PlanNode, parentB: PlanNode): number {
  const desiredCount = bitCount(parentA.mask | parentB.mask);
  const extraCount = parentA.nodeId === parentB.nodeId
    ? Math.max(parentA.extraPassiveCount, parentB.extraPassiveCount)
    : parentA.extraPassiveCount + parentB.extraPassiveCount;
  return desiredCount + Math.min(8 - desiredCount, Math.ceil(extraCount));
}

function selectionOutcomes(poolSize: number, desiredCount: number): Array<{
  mode: "usable" | "pure";
  chance: number;
  exactChance: number;
  extraPassiveCount: number;
}> {
  const outcome = passiveInheritanceOutcome(poolSize, desiredCount);
  const usable = {
    mode: "usable" as const,
    chance: outcome.usableChance,
    exactChance: outcome.exactChance,
    extraPassiveCount: outcome.expectedExtraPassives,
  };
  if (outcome.exactChance <= 0 || outcome.expectedExtraPassives < 0.05 || Math.abs(outcome.usableChance - outcome.exactChance) < 1e-9) {
    return [usable];
  }
  return [usable, {
    mode: "pure" as const,
    chance: outcome.exactChance,
    exactChance: outcome.exactChance,
    extraPassiveCount: 0,
  }];
}

function mergeCaptureSources(left: CaptureSource[], right: CaptureSource[]): CaptureSource[] {
  const sources = new Map<string, CaptureSource>();
  for (const source of [...left, ...right]) {
    const current = sources.get(source.palId);
    if (!current || source.difficulty < current.difficulty) sources.set(source.palId, source);
  }
  return [...sources.values()];
}

function routeEffort(node: PlanNode): number {
  const captureEffort = node.captureSources.reduce((sum, source) => sum + source.difficulty, 0);
  return captureEffort + node.totalExpectedEggs * EGG_DIFFICULTY_WEIGHT
    + node.extraPassiveCount * PASSIVE_POLLUTION_DIFFICULTY_WEIGHT + node.depth / 100;
}

function isBetter(next: PlanNode, current?: PlanNode): boolean {
  if (!current) return true;
  const nextEffort = routeEffort(next);
  const currentEffort = routeEffort(current);
  if (Math.abs(nextEffort - currentEffort) > 0.001) return nextEffort < currentEffort;
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
  const maxBreedingSteps = Math.max(0, Math.min(12, options.maxBreedingSteps ?? 4));
  const maxGenerations = Math.max(0, Math.min(12, options.maxGenerations ?? maxBreedingSteps));
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
    const mask = maskFor(passives, desiredPassives);
    addState({
      nodeId: `owned:${item.id}`,
      palId: item.palId,
      sex: item.sex,
      mask,
      passives,
      extraPassiveCount: Math.max(0, passives.length - bitCount(mask)),
      depth: 0,
      eggSteps: 0,
      totalExpectedEggs: 0,
      kind: "owned",
      inventoryId: item.id,
      nickname: item.nickname,
      potentials: { hp: item.hp ?? null, attack: item.attack ?? null, defense: item.defense ?? null },
      captureSources: [],
      breedingStepIds: [],
      ownedRootId: item.id,
    });
  });

  const legacySources = unique(options.catchablePalIds ?? []).map((palId) => ({
    palId,
    level: 1,
    maxLevel: 1,
    kind: "wild" as const,
    difficulty: 1,
  }));
  const sourceByPal = new Map<string, CaptureSource>();
  for (const source of [...legacySources, ...(options.captureSources ?? [])]) {
    const current = sourceByPal.get(source.palId);
    if (!current || source.difficulty < current.difficulty) sourceByPal.set(source.palId, source);
  }
  sourceByPal.forEach((source, palId) => {
    addState({
      nodeId: `captured:${palId}`,
      palId,
      sex: "A",
      mask: 0,
      passives: [],
      extraPassiveCount: 0,
      depth: 0,
      eggSteps: 0,
      totalExpectedEggs: 0,
      kind: "captured",
      potentials: { hp: null, attack: null, defense: null },
      captureSources: [source],
      breedingStepIds: [],
    });
  });

  // Finalize one complete generation at a time. The previous queue limit could
  // stop halfway through a generation, making results depend on the requested
  // maximum depth. Layered finalization makes every shorter generation stable.
  let frontier = queue.splice(0);
  const maxCandidateEvaluationsPerGeneration = Math.max(
    100_000,
    data.pals.length * Math.max(1, 1 << desiredPassives.length) * 20,
  );
  for (let generation = 1; generation <= maxGenerations && frontier.length; generation += 1) {
    const nextStates = new Map<string, PlanNode>();
    let evaluatedCandidates = 0;
    const addNextState = (node: PlanNode) => {
      const key = stateKey(node);
      if (isBetter(node, nextStates.get(key))) nextStates.set(key, node);
    };

    generationSearch:
    for (const changed of frontier) {
      for (const comboIndex of recipesByParent.get(changed.palId) ?? []) {
        const combo = data.combos[comboIndex];
        const changedIsA = combo[1] === changed.palId;
        const otherPalId = changedIsA ? combo[2] : combo[1];
        for (const other of statesByPal.get(otherPalId) ?? []) {
          const parentA = changedIsA ? changed : other;
          const parentB = changedIsA ? other : changed;
          if (!comboCompatible(parentA, parentB, combo)) continue;
          const depth = Math.max(parentA.depth, parentB.depth) + 1;
          if (depth !== generation) continue;
          evaluatedCandidates += 1;
          const mask = parentA.mask | parentB.mask;
          const inheritedPassives = passivesForMask(mask, desiredPassives);
          const outcomes = selectionOutcomes(passivePoolSize(parentA, parentB), inheritedPassives.length);
          const potentials = potentialTargets(parentA.potentials, parentB.potentials);
          const ivChance = potentialInheritanceChance(parentA.potentials, parentB.potentials, potentials);
          const duplicateParent = parentA.nodeId === parentB.nodeId;
          const duplicateBreedingCost = duplicateParent && parentA.kind === "bred";
          for (const outcome of outcomes) {
            const combinedChance = outcome.chance * ivChance;
            const nodeId = `bred:${generatedId++}`;
            const breedingStepIds = unique([...parentA.breedingStepIds, ...parentB.breedingStepIds, nodeId]);
            if (breedingStepIds.length > maxBreedingSteps) continue;
            addNextState({
              nodeId,
              palId: combo[0],
              sex: "A",
              mask,
              passives: inheritedPassives,
              extraPassiveCount: outcome.extraPassiveCount,
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
              stepChance: outcome.chance,
              stepExactChance: outcome.exactChance,
              selectionMode: outcome.mode,
              duplicateParent,
              potentials,
              captureSources: mergeCaptureSources(parentA.captureSources, parentB.captureSources),
              breedingStepIds,
              ownedRootId: parentA.ownedRootId ?? parentB.ownedRootId,
            });
          }
          if (evaluatedCandidates >= maxCandidateEvaluationsPerGeneration) break generationSearch;
        }
      }
    }

    frontier = [...nextStates.values()];
    for (const node of frontier) {
      const key = stateKey(node);
      states.set(key, node);
      const list = statesByPal.get(node.palId) ?? [];
      list.push(node);
      statesByPal.set(node.palId, list);
    }
  }

  return { states, statesByPal, desiredPassives, fullMask, data, maxGenerations, maxBreedingSteps };
}

function parentSummary(node: PlanNode): PlanParent {
  return {
    nodeId: node.nodeId,
    palId: node.palId,
    sex: node.sex,
    source: node.kind,
    inventoryId: node.inventoryId,
    nickname: node.nickname,
    passives: node.passives,
    extraPassiveCount: node.extraPassiveCount,
    captureSource: node.kind === "captured" ? node.captureSources[0] : undefined,
  };
}

function flattenSteps(node: PlanNode, data: BreedingData): PlanStep[] {
  const steps: PlanStep[] = [];
  const nodesById = new Map<string, PlanNode>();
  const seen = new Set<string>();
  const visit = (current: PlanNode) => {
    if (current.kind !== "bred" || !current.parents || !current.combo || seen.has(current.nodeId)) return;
    visit(current.parents[0]);
    visit(current.parents[1]);
    seen.add(current.nodeId);
    nodesById.set(current.nodeId, current);
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
      exactChance: current.stepExactChance ?? current.stepChance ?? 1,
      expectedExtraPassives: current.extraPassiveCount,
      selectionMode: current.selectionMode ?? "usable",
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
      sexRequirement: null,
      sexChance: 1,
      duplicateParent: Boolean(current.duplicateParent),
      duplicateAction: current.duplicateParent
        ? current.parents[0].kind === "captured"
          ? "catch"
          : "breed"
        : null,
    });
  };
  visit(node);
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const requirements = new Map<string, Set<"M" | "F">>();
  const palById = new Map(data.pals.map((pal) => [pal.id, pal]));
  const maleChance = (palId: string) => Math.max(0, Math.min(1, (palById.get(palId)?.stats.maleRate ?? 50) / 100));
  const requireSex = (parent: PlanNode, sex: "M" | "F") => {
    const current = requirements.get(parent.nodeId) ?? new Set<"M" | "F">();
    current.add(sex);
    requirements.set(parent.nodeId, current);
  };
  const knownSex = (parent: PlanNode): "M" | "F" | null => {
    if (parent.sex === "M" || parent.sex === "F") return parent.sex;
    const required = requirements.get(parent.nodeId);
    return required?.size === 1 ? [...required][0] : null;
  };

  // Sex constraints can travel across steps when the same captured or bred
  // parent is reused. Iterate to a fixed point so a known sex in an earlier
  // pairing also constrains the intermediate child paired with it later.
  for (let pass = 0; pass < Math.max(2, steps.length + 1); pass += 1) {
    const before = [...requirements.values()].reduce((sum, value) => sum + value.size, 0);
    for (const current of nodesById.values()) {
      if (!current.parents || !current.combo) continue;
      const [parentA, parentB] = current.parents;
      const [genderA, genderB] = [current.combo[3], current.combo[4]];
      if (genderA !== "WILDCARD") requireSex(parentA, genderA === "MALE" ? "M" : "F");
      if (genderB !== "WILDCARD") requireSex(parentB, genderB === "MALE" ? "M" : "F");
      if (genderA !== "WILDCARD" || genderB !== "WILDCARD") continue;
      if (parentA.nodeId === parentB.nodeId) {
        requireSex(parentA, "M");
        requireSex(parentA, "F");
        continue;
      }
      const fixedA = knownSex(parentA);
      const fixedB = knownSex(parentB);
      if (fixedA && !fixedB) {
        requireSex(parentB, fixedA === "M" ? "F" : "M");
        continue;
      }
      if (fixedB && !fixedA) {
        requireSex(parentA, fixedB === "M" ? "F" : "M");
        continue;
      }
      if (parentA.kind === "bred" && parentB.kind === "bred" && !fixedA && !fixedB) {
        const stepA = stepById.get(parentA.nodeId);
        const stepB = stepById.get(parentB.nodeId);
        const maleA = maleChance(parentA.palId);
        const maleB = maleChance(parentB.palId);
        const baseA = stepA?.expectedEggs ?? 1;
        const baseB = stepB?.expectedEggs ?? 1;
        const maleFemaleCost = baseA / Math.max(0.0001, maleA) + baseB / Math.max(0.0001, 1 - maleB);
        const femaleMaleCost = baseA / Math.max(0.0001, 1 - maleA) + baseB / Math.max(0.0001, maleB);
        if (maleFemaleCost <= femaleMaleCost) {
          requireSex(parentA, "M");
          requireSex(parentB, "F");
        } else {
          requireSex(parentA, "F");
          requireSex(parentB, "M");
        }
      }
    }
    const after = [...requirements.values()].reduce((sum, value) => sum + value.size, 0);
    if (after === before) break;
  }

  return steps.map((step, index) => {
    const required = requirements.get(step.id);
    if (!required?.size) return { ...step, index: index + 1 };
    const male = maleChance(step.childId);
    const needsBoth = required.size === 2;
    const requiredSex = needsBoth ? "BOTH" : [...required][0];
    const multiplier = needsBoth
      ? male > 0 && male < 1
        ? 1 / male + 1 / (1 - male) - 1
        : 9999
      : 1 / Math.max(0.0001, requiredSex === "M" ? male : 1 - male);
    return {
      ...step,
      index: index + 1,
      sexRequirement: requiredSex,
      sexChance: 1 / multiplier,
      expectedEggs: step.expectedEggs * multiplier,
    };
  });
}

function routeParentSexRequirements(steps: PlanStep[]): Map<string, Set<"M" | "F">> {
  const requirements = new Map<string, Set<"M" | "F">>();
  const add = (nodeId: string, sex: "M" | "F") => {
    const current = requirements.get(nodeId) ?? new Set<"M" | "F">();
    current.add(sex); requirements.set(nodeId, current);
  };
  for (const step of steps) {
    if (step.sexRequirement === "M" || step.sexRequirement === "F") add(step.id, step.sexRequirement);
    if (step.sexRequirement === "BOTH") { add(step.id, "M"); add(step.id, "F"); }
    if (step.parentA.sex === "M" || step.parentA.sex === "F") add(step.parentA.nodeId, step.parentA.sex);
    if (step.parentB.sex === "M" || step.parentB.sex === "F") add(step.parentB.nodeId, step.parentB.sex);
  }
  for (let pass = 0; pass < steps.length + 1; pass += 1) {
    for (const step of steps) {
      if (step.genderA !== "WILDCARD") add(step.parentA.nodeId, step.genderA === "MALE" ? "M" : "F");
      if (step.genderB !== "WILDCARD") add(step.parentB.nodeId, step.genderB === "MALE" ? "M" : "F");
      if (step.genderA !== "WILDCARD" || step.genderB !== "WILDCARD") continue;
      const a = requirements.get(step.parentA.nodeId); const b = requirements.get(step.parentB.nodeId);
      const fixedA = a?.size === 1 ? [...a][0] : null; const fixedB = b?.size === 1 ? [...b][0] : null;
      if (fixedA && !fixedB) add(step.parentB.nodeId, fixedA === "M" ? "F" : "M");
      if (fixedB && !fixedA) add(step.parentA.nodeId, fixedB === "M" ? "F" : "M");
    }
  }
  return requirements;
}

function toPlanResult(node: PlanNode, desiredPassives: string[], fullMask: number, data: BreedingData): PlanResult {
  const steps = flattenSteps(node, data);
  const parentSexRequirements = routeParentSexRequirements(steps);
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
  for (const step of steps) {
    for (const parent of [step.parentA, step.parentB]) {
      if (parent.source === "captured" && parentSexRequirements.get(parent.nodeId)?.size === 2) {
        captureCounts.set(parent.palId, Math.max(2, captureCounts.get(parent.palId) ?? 0));
      }
    }
  }
  const captures = [...captureCounts].map(([palId, count]) => {
    const source = node.captureSources.find((item) => item.palId === palId) ?? {
      palId,
      level: 1,
      maxLevel: 1,
      kind: "wild" as const,
      difficulty: 1,
    };
    return { ...source, count };
  });
  const captureDifficulty = captures.reduce((sum, capture) => sum + capture.difficulty * capture.count, 0);
  const bossCaptureCount = captures.reduce((sum, capture) => sum + (capture.kind === "alpha" ? capture.count : 0), 0);
  const newCaptureCount = captures.reduce((sum, capture) => sum + capture.count, 0);
  const expectedEggs = steps.reduce((sum, step) => sum + step.expectedEggs, 0);
  const eggDifficulty = expectedEggs * EGG_DIFFICULTY_WEIGHT;
  const passivePollutionDifficulty = node.extraPassiveCount * PASSIVE_POLLUTION_DIFFICULTY_WEIGHT;
  const difficultyScore = captureDifficulty + eggDifficulty + passivePollutionDifficulty;
  const routePriority = difficultyScore + node.depth / 100;
  return {
    node,
    source: node.kind,
    steps,
    generations: node.depth,
    breedingSteps: node.breedingStepIds.length,
    expectedEggs,
    finalExtraPassiveCount: node.extraPassiveCount,
    coveredPassives: passivesForMask(node.mask, desiredPassives),
    missingPassives: passivesForMask(fullMask & ~node.mask, desiredPassives),
    captures,
    ownedInventoryIds: unique(
      [node, ...steps.flatMap((step) => [step.parentA, step.parentB])]
        .map((item) => item.inventoryId ?? "")
        .filter(Boolean),
    ),
    captureDifficulty,
    eggDifficulty,
    passivePollutionDifficulty,
    difficultyScore,
    bossCaptureCount,
    newCaptureCount,
    routePriority,
  };
}

export type TargetPlanOptions = {
  requireOwnedAncestry?: boolean;
  requireFullPassives?: boolean;
};

function compareTargetPlans(a: PlanResult, b: PlanResult): number {
  const coverage = b.coveredPassives.length - a.coveredPassives.length;
  if (coverage) return coverage;
  if (a.breedingSteps !== b.breedingSteps) return a.breedingSteps - b.breedingSteps;
  if (a.newCaptureCount !== b.newCaptureCount) return a.newCaptureCount - b.newCaptureCount;
  if (Math.abs(a.difficultyScore - b.difficultyScore) > 0.001) return a.difficultyScore - b.difficultyScore;
  if (Math.abs(a.finalExtraPassiveCount - b.finalExtraPassiveCount) > 0.05) {
    return a.finalExtraPassiveCount - b.finalExtraPassiveCount;
  }
  if (a.bossCaptureCount !== b.bossCaptureCount) return a.bossCaptureCount - b.bossCaptureCount;
  if (a.generations !== b.generations) return a.generations - b.generations;
  return a.expectedEggs - b.expectedEggs;
}

function matchesTargetOptions(node: PlanNode, search: SearchResult, options: TargetPlanOptions): boolean {
  if (options.requireOwnedAncestry && !node.ownedRootId) return false;
  if (options.requireFullPassives && node.mask !== search.fullMask) return false;
  return true;
}

function enumerateTargetNodes(search: SearchResult, targetPalId: string, options: TargetPlanOptions): PlanNode[] {
  const candidates = [...(search.statesByPal.get(targetPalId) ?? [])];
  search.data.combos.forEach((combo, comboIndex) => {
    if (combo[0] !== targetPalId) return;
    const leftStates = search.statesByPal.get(combo[1]) ?? [];
    const rightStates = search.statesByPal.get(combo[2]) ?? [];
    for (const parentA of leftStates) {
      for (const parentB of rightStates) {
        if (!comboCompatible(parentA, parentB, combo)) continue;
        const mask = parentA.mask | parentB.mask;
        const ownedRootId = parentA.ownedRootId ?? parentB.ownedRootId;
        if (options.requireOwnedAncestry && !ownedRootId) continue;
        if (options.requireFullPassives && mask !== search.fullMask) continue;
        const depth = Math.max(parentA.depth, parentB.depth) + 1;
        if (depth > search.maxGenerations) continue;
        const inheritedPassives = passivesForMask(mask, search.desiredPassives);
        const outcomes = selectionOutcomes(passivePoolSize(parentA, parentB), inheritedPassives.length);
        const potentials = potentialTargets(parentA.potentials, parentB.potentials);
        const ivChance = potentialInheritanceChance(parentA.potentials, parentB.potentials, potentials);
        const duplicateParent = parentA.nodeId === parentB.nodeId;
        const duplicateBreedingCost = duplicateParent && parentA.kind === "bred";
        for (const outcome of outcomes) {
          const nodeId = `target:${comboIndex}:${parentA.nodeId}:${parentB.nodeId}:${outcome.mode}`;
          const breedingStepIds = unique([...parentA.breedingStepIds, ...parentB.breedingStepIds, nodeId]);
          if (breedingStepIds.length > search.maxBreedingSteps) continue;
          const combinedChance = outcome.chance * ivChance;
          candidates.push({
            nodeId,
            palId: targetPalId,
            sex: "A",
            mask,
            passives: inheritedPassives,
            extraPassiveCount: outcome.extraPassiveCount,
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
            stepChance: outcome.chance,
            stepExactChance: outcome.exactChance,
            selectionMode: outcome.mode,
            duplicateParent,
            potentials,
            captureSources: mergeCaptureSources(parentA.captureSources, parentB.captureSources),
            breedingStepIds,
            ownedRootId,
          });
        }
      }
    }
  });
  return candidates.filter((node) => matchesTargetOptions(node, search, options));
}

export function findTargetPlans(
  search: SearchResult,
  targetPalId: string,
  options: TargetPlanOptions = {},
  limit = Number.POSITIVE_INFINITY,
): PlanResult[] {
  const candidates = enumerateTargetNodes(search, targetPalId, options);
  if (!candidates.length) return [];
  const bestByRoute = new Map<string, PlanResult>();
  for (const node of candidates) {
    const plan = toPlanResult(node, search.desiredPassives, search.fullMask, search.data);
    const signature = plan.steps
      .map((step) => `${step.childId}:${step.parentA.source}:${step.parentA.palId}+${step.parentB.source}:${step.parentB.palId}`)
      .join(">");
    const key = `${plan.ownedInventoryIds.join(",")}|${signature || `source:${plan.source}`}`;
    const current = bestByRoute.get(key);
    if (!current || compareTargetPlans(plan, current) < 0) bestByRoute.set(key, plan);
  }
  const results = [...bestByRoute.values()];
  results.sort(compareTargetPlans);
  return results.slice(0, Math.max(1, limit));
}

/** Groups routes by the two costs users act on first: breeding operations and new captures. */
export function groupTargetPlans(plans: PlanResult[], sortMode: TargetPlanSortMode = "recommended"): TargetPlanGroup[] {
  if (sortMode === "difficulty") {
    return plans
      .map((plan, index) => ({ key: `plan:${index}`, plans: [plan], planIndexes: [index] }))
      .sort((left, right) => left.plans[0].difficultyScore - right.plans[0].difficultyScore || left.planIndexes[0] - right.planIndexes[0]);
  }
  const entriesByKey = new Map<string, Array<{ plan: PlanResult; index: number }>>();
  plans.forEach((plan, index) => {
    const key = `${plan.breedingSteps}|${plan.newCaptureCount}`;
    const entries = entriesByKey.get(key) ?? [];
    entries.push({ plan, index });
    entriesByKey.set(key, entries);
  });
  const groups = [...entriesByKey].map(([key, entries]) => {
    entries.sort((left, right) => left.plan.difficultyScore - right.plan.difficultyScore || left.index - right.index);
    return { key, plans: entries.map((entry) => entry.plan), planIndexes: entries.map((entry) => entry.index) };
  });
  return groups.sort((left, right) => {
    const leftPlan = left.plans[0];
    const rightPlan = right.plans[0];
    return leftPlan.breedingSteps - rightPlan.breedingSteps || leftPlan.newCaptureCount - rightPlan.newCaptureCount || leftPlan.difficultyScore - rightPlan.difficultyScore;
  });
}

export function hasComplexityDifficultyTradeoff(groups: TargetPlanGroup[]): boolean {
  return groups.some((current, currentIndex) => groups.slice(0, currentIndex).some((earlier) => {
    const currentPlan = current.plans[0];
    const earlierPlan = earlier.plans[0];
    const noSimpler = currentPlan.breedingSteps >= earlierPlan.breedingSteps && currentPlan.newCaptureCount >= earlierPlan.newCaptureCount;
    const strictlyMoreComplex = currentPlan.breedingSteps > earlierPlan.breedingSteps || currentPlan.newCaptureCount > earlierPlan.newCaptureCount;
    return noSimpler && strictlyMoreComplex && currentPlan.difficultyScore + 0.001 < earlierPlan.difficultyScore;
  }));
}

export function findTargetPlan(
  search: SearchResult,
  targetPalId: string,
  options: TargetPlanOptions = {},
): PlanResult | null {
  const plans = (search.statesByPal.get(targetPalId) ?? [])
    .filter((node) => matchesTargetOptions(node, search, options))
    .map((node) => toPlanResult(node, search.desiredPassives, search.fullMask, search.data))
    .sort(compareTargetPlans);
  return plans[0] ?? null;
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
  targetOptions: TargetPlanOptions = {},
): Recommendation[] {
  const results: Recommendation[] = [];
  for (const pal of data.pals) {
    if (pal.stats.hp == null && profile !== "worker") continue;
    const plan = findTargetPlan(search, pal.id, targetOptions);
    if (!plan) continue;
    const coverage = plan.coveredPassives.length;
    const qualityScore = palQualityScore(pal, profile);
    const score =
      qualityScore +
      coverage * 24 -
      plan.missingPassives.length * 34 -
      plan.difficultyScore * 0.35;
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
