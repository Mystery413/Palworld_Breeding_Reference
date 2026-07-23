"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BreedingData,
  CaptureSource,
  CompletionTarget,
  compactInventoryForPlanning,
  groupTargetPlans,
  hasComplexityDifficultyTradeoff,
  InventoryPal,
  selfBreedingOnlyCombo,
  isWorldTreeOnlyPal,
  Pal,
  planDifficultyScore,
  PlanResult,
  Profile,
  selectCaptureSource,
  TargetPlanGroup,
  TargetPlanSortMode,
} from "@/lib/planner";
import { passiveEffect } from "@/lib/passive-effects";
import {
  GRADUATE_PRESETS,
  GRADUATE_PRESET_GROUPS,
  GraduatePreset,
  GraduatePresetGroup,
  graduatePassiveAlternativesFor,
  graduatePassivesFor,
} from "@/lib/graduate-presets";
import type { PlannerWorkerRequest, PlannerWorkerResponse } from "@/lib/planner-worker-types";
import { loadBreedingData } from "@/lib/supabase-data";
import { bundledPassiveRanks, normalizePassiveName, passiveRankOf } from "@/lib/passive-ranks";
import {
  listSharedSaveUsers,
  loadSharedUserInventory,
  replaceSharedUserInventory,
  SharedSaveUser,
} from "@/lib/supabase-user-data";
import { SaveImportModal } from "./SaveImportModal";
import { PalDetailModal } from "./PalDetailModal";

const STORAGE_KEY = "palworld-breeding-lab-v1";
const METHODS_PER_BATCH = 6;

const PASSIVE_PRESETS = [
  "破坏神",
  "双刃圣剑",
  "守护圣盾",
  "恶魔之手",
  "卓绝技艺",
  "金刚之躯",
  "传说",
  "稀有",
  "鬼神",
  "神速",
  "明镜止水",
  "永动机",
  "吸血鬼",
  "不死之身",
  "特殊体质",
  "重装甲",
  "身轻如燕",
  "育婴师",
  "工匠精神",
  "博爱主义者",
  "沉着冷静",
  "无限精力",
  "凶猛",
];

type SavedState = {
  inventory: InventoryPal[];
  desiredPassives?: string[];
  exactTargetPassives: string[];
  graduatePassives?: string[];
  graduatePresetId?: string;
  graduateTargetId?: string;
  profile: Profile;
  exactTargetId: string;
  playerLevel: number;
  allowCapture: boolean;
  restrictCaptureByLevel: boolean;
  excludeWorldTreeOnly: boolean;
  excludeBossCaptures: boolean;
  maxGenerations: number;
  maxBreedingSteps?: number;
};

type DraftPal = {
  palId: string;
  sex: "M" | "F";
  passives: string[];
  hp: string;
  attack: string;
  defense: string;
  nickname: string;
};

const EMPTY_DRAFT: DraftPal = {
  palId: "",
  sex: "F",
  passives: [],
  hp: "",
  attack: "",
  defense: "",
  nickname: "",
};

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizedSearch(value: string): string {
  return value.trim().toLocaleLowerCase("zh-CN").replaceAll(/\s+/g, "");
}

function fuzzyMatches(value: string, query: string): boolean {
  const haystack = normalizedSearch(value);
  const needle = normalizedSearch(query);
  if (!needle || haystack.includes(needle)) return true;
  let cursor = 0;
  for (const char of haystack) if (char === needle[cursor]) cursor += 1;
  return cursor === needle.length;
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex];
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

function palMatchScore(pal: Pal, rawQuery: string): number | null {
  const query = normalizedSearch(rawQuery);
  if (!query) return 0;
  const fields = [pal.dex.replace(/^0+/, ""), pal.dex, pal.id, pal.nameZh, pal.name];
  const normalizedFields = fields.map(normalizedSearch);
  if (normalizedFields.some((field) => field === query)) return 0;
  if (normalizedFields.some((field) => field.startsWith(query))) return 1;
  if (normalizedFields.some((field) => field.includes(query))) return 2;
  if (normalizedFields.some((field) => fuzzyMatches(field, query))) return 3;
  if (query.length >= 2 && normalizedFields.some((field) => editDistance(field, query) <= Math.max(1, Math.floor(query.length * .25)))) return 4;
  return null;
}

function passiveTier(rank?: number | null): { className: string; label: string | null } {
  if (rank == null) return { className: "passive-custom", label: null };
  if (rank < 0) return { className: `passive-negative passive-negative-${Math.min(3, Math.abs(rank))}`, label: `负面 ${Math.abs(rank)}` };
  if (rank >= 5) return { className: "passive-rank-5", label: null };
  if (rank === 4) return { className: "passive-rank-4", label: null };
  if (rank === 3) return { className: "passive-rank-3", label: null };
  if (rank === 2) return { className: "passive-rank-2", label: null };
  return { className: "passive-rank-1", label: null };
}

function captureRangeLabel(source: Pick<CaptureSource, "level" | "maxLevel" | "kind">): string {
  const range = source.maxLevel > source.level ? `Lv.${source.level}–${source.maxLevel}` : `Lv.${source.level}`;
  return source.kind === "alpha" ? `Alpha Boss ${range}` : `普通野生 ${range}`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value) || value > 9999) return "大量";
  if (value < 10) return value.toFixed(1).replace(".0", "");
  return Math.round(value).toLocaleString("zh-CN");
}

function genderLabel(value: string): string {
  if (value === "MALE" || value === "M") return "♂ 雄";
  if (value === "FEMALE" || value === "F") return "♀ 雌";
  return "异性配对";
}

function sexRequirementLabel(value: PlanResult["steps"][number]["sexRequirement"]): string {
  if (value === "M") return "雄性";
  if (value === "F") return "雌性";
  if (value === "BOTH") return "一雄一雌";
  return "";
}

function maskCsvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseInventoryCsv(text: string, pals: Pal[]): InventoryPal[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((value) => value.trim().toLowerCase());
  const index = (name: string) => headers.indexOf(name);
  const palMap = new Map(pals.flatMap((pal) => [[pal.id.toLowerCase(), pal.id], [pal.name.toLowerCase(), pal.id], [pal.nameZh.toLowerCase(), pal.id]]));
  return lines.slice(1).flatMap((line, rowIndex) => {
    const cells = line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)?.map((cell) => cell.replace(/^,/, "").replace(/^"|"$/g, "").replaceAll('""', '"')) ?? [];
    const rawPal = cells[index("pal_id")] || cells[index("pal")] || cells[index("name")] || "";
    const palId = palMap.get(rawPal.trim().toLowerCase());
    if (!palId) return [];
    const sexRaw = (cells[index("sex")] || "F").toUpperCase();
    const passives = unique((cells[index("passives")] || "").split(/[|;；、]/));
    const value = (field: string) => {
      const raw = cells[index(field)];
      return raw && !Number.isNaN(Number(raw)) ? Number(raw) : null;
    };
    return [{
      id: `import-${Date.now()}-${rowIndex}`,
      palId,
      sex: sexRaw.startsWith("M") || sexRaw === "雄" ? "M" as const : "F" as const,
      passives,
      hp: value("hp"),
      attack: value("attack"),
      defense: value("defense"),
      nickname: cells[index("nickname")] || "",
    }];
  });
}

export default function PlannerApp() {
  const [data, setData] = useState<BreedingData | null>(null);
  const [inventory, setInventory] = useState<InventoryPal[]>([]);
  const [exactTargetPassives, setExactTargetPassives] = useState<string[]>([]);
  const [graduatePassives, setGraduatePassives] = useState<string[]>(() => [...GRADUATE_PRESETS[0].defaultPassives]);
  const [graduatePresetId, setGraduatePresetId] = useState(GRADUATE_PRESETS[0].id);
  const [graduateTargetId, setGraduateTargetId] = useState(GRADUATE_PRESETS[0].candidates[0].palId);
  const [profile, setProfile] = useState<Profile>("combat");
  const [mode, setMode] = useState<"recommend" | "exact">("recommend");
  const [exactTargetId, setExactTargetId] = useState("");
  const [playerLevel, setPlayerLevel] = useState(20);
  const [allowCapture, setAllowCapture] = useState(true);
  const [restrictCaptureByLevel, setRestrictCaptureByLevel] = useState(true);
  const [excludeWorldTreeOnly, setExcludeWorldTreeOnly] = useState(false);
  const [excludeBossCaptures, setExcludeBossCaptures] = useState(false);
  const [maxGenerations, setMaxGenerations] = useState(4);
  const [routeSortMode, setRouteSortMode] = useState<TargetPlanSortMode>("recommended");
  const [completionTarget, setCompletionTarget] = useState<CompletionTarget>("usable");
  const [selectedExactPlanIndex, setSelectedExactPlanIndex] = useState(0);
  const [visibleMethodCount, setVisibleMethodCount] = useState(METHODS_PER_BATCH);
  const [detailPalId, setDetailPalId] = useState("");
  const [isInventoryOpen, setInventoryOpen] = useState(false);
  const [isSaveImportOpen, setSaveImportOpen] = useState(false);
  const [draft, setDraft] = useState<DraftPal>(EMPTY_DRAFT);
  const [palSearch, setPalSearch] = useState("");
  const [passiveInput, setPassiveInput] = useState("");
  const [desiredInput, setDesiredInput] = useState("");
  const [targetSearch, setTargetSearch] = useState("");
  const [targetPickerOpen, setTargetPickerOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [isHydrated, setHydrated] = useState(false);
  const [isCalculating, setCalculating] = useState(false);
  const [exactPlans, setExactPlans] = useState<PlanResult[]>([]);
  const [calculationSummary, setCalculationSummary] = useState({ reachablePals: 0, fullTraitPals: 0 });
  const [calculatedInputKey, setCalculatedInputKey] = useState("");
  const [calculationDurationMs, setCalculationDurationMs] = useState(0);
  const [routesTruncated, setRoutesTruncated] = useState(false);
  const [searchTruncated, setSearchTruncated] = useState(false);
  const [saveUsers, setSaveUsers] = useState<SharedSaveUser[]>([]);
  const [activeUserId, setActiveUserId] = useState("");
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const skipNextCloudSync = useRef(false);
  const plannerWorkerRef = useRef<Worker | null>(null);
  const plannerWorkerHasData = useRef(false);
  const plannerRequestId = useRef(0);
  const pendingCalculationKey = useRef("");

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (detailPalId) setDetailPalId("");
      else if (isSaveImportOpen) setSaveImportOpen(false);
      else if (isInventoryOpen) setInventoryOpen(false);
      else setTargetPickerOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [detailPalId, isSaveImportOpen, isInventoryOpen]);

  const initializePlannerWorker = useCallback(() => {
    plannerWorkerRef.current?.terminate();
    const worker = new Worker(new URL("./planner.worker.ts", import.meta.url), { type: "module" });
    plannerWorkerRef.current = worker;
    plannerWorkerHasData.current = false;
    worker.onmessage = (event: MessageEvent<PlannerWorkerResponse>) => {
      const response = event.data;
      if (response.requestId !== plannerRequestId.current) return;
      setCalculating(false);
      if (response.error) {
        setNotice(`计算失败：${response.error}`);
        return;
      }
      setExactPlans(response.exactPlans);
      setCalculationSummary(response.summary);
      setCalculationDurationMs(response.durationMs);
      setRoutesTruncated(Boolean(response.routesTruncated));
      setSearchTruncated(Boolean(response.searchTruncated));
      setCalculatedInputKey(pendingCalculationKey.current);
      setSelectedExactPlanIndex(0);
      setVisibleMethodCount(METHODS_PER_BATCH);
    };
    worker.onerror = () => {
      setCalculating(false);
      plannerWorkerHasData.current = false;
      setNotice("计算线程启动失败，请刷新页面重试。");
    };
  }, []);

  useEffect(() => {
    initializePlannerWorker();
    return () => {
      plannerWorkerRef.current?.terminate();
      plannerWorkerRef.current = null;
    };
  }, [initializePlannerWorker]);

  useEffect(() => {
    loadBreedingData()
      .then(setData)
      .catch((error) => {
        console.error("Supabase reference data load failed", error);
        setNotice("无法从数据库加载配种数据，请刷新页面重试。");
      });
  }, []);

  useEffect(() => {
    listSharedSaveUsers().then(async (users) => {
      setSaveUsers(users);
      if (!users.length) return;
      const first = users[0];
      const items = await loadSharedUserInventory(first.user_id);
      skipNextCloudSync.current = true;
      setActiveUserId(first.user_id);
      setInventory(items);
    }).catch(() => {
      setNotice("共享用户数据库尚未初始化；请先执行最新的 Supabase SQL。");
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<SavedState>;
          if (Array.isArray(parsed.inventory)) setInventory(parsed.inventory);
          if (Array.isArray(parsed.exactTargetPassives)) setExactTargetPassives(parsed.exactTargetPassives.slice(0, 4));
          if (Array.isArray(parsed.graduatePassives)) setGraduatePassives(parsed.graduatePassives.slice(0, 4));
          if (typeof parsed.graduatePresetId === "string" && GRADUATE_PRESETS.some((item) => item.id === parsed.graduatePresetId)) setGraduatePresetId(parsed.graduatePresetId);
          if (typeof parsed.graduateTargetId === "string") setGraduateTargetId(parsed.graduateTargetId);
          if (parsed.profile) setProfile(parsed.profile);
          if (parsed.exactTargetId) setExactTargetId(parsed.exactTargetId);
          if (typeof parsed.playerLevel === "number") setPlayerLevel(Math.max(1, Math.min(80, parsed.playerLevel)));
          if (typeof parsed.allowCapture === "boolean") setAllowCapture(parsed.allowCapture);
          if (typeof parsed.restrictCaptureByLevel === "boolean") setRestrictCaptureByLevel(parsed.restrictCaptureByLevel);
          if (typeof parsed.excludeWorldTreeOnly === "boolean") setExcludeWorldTreeOnly(parsed.excludeWorldTreeOnly);
          if (typeof parsed.excludeBossCaptures === "boolean") setExcludeBossCaptures(parsed.excludeBossCaptures);
          const savedGenerations = parsed.maxGenerations ?? parsed.maxBreedingSteps;
          if (typeof savedGenerations === "number") setMaxGenerations(Math.max(1, Math.min(12, savedGenerations)));
        }
      } catch {
        setNotice("本地存档无法读取，已使用空白库存。你可以重新录入或导入备份。");
      } finally {
        setHydrated(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const saved: SavedState = { inventory, exactTargetPassives, graduatePassives, graduatePresetId, graduateTargetId, profile, exactTargetId, playerLevel, allowCapture, restrictCaptureByLevel, excludeWorldTreeOnly, excludeBossCaptures, maxGenerations };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [inventory, exactTargetPassives, graduatePassives, graduatePresetId, graduateTargetId, profile, exactTargetId, playerLevel, allowCapture, restrictCaptureByLevel, excludeWorldTreeOnly, excludeBossCaptures, maxGenerations, isHydrated]);

  useEffect(() => {
    if (!activeUserId || !isHydrated) return;
    if (skipNextCloudSync.current) {
      skipNextCloudSync.current = false;
      return;
    }
    const active = saveUsers.find((user) => user.user_id === activeUserId);
    const timer = window.setTimeout(() => {
      setCloudSyncing(true);
      replaceSharedUserInventory({
        userId: activeUserId,
        name: active?.name ?? "我的存档",
        sourceFileName: active?.source_file_name ?? undefined,
      }, inventory)
        .catch((error) => {
          console.error("Cloud inventory sync failed", error);
          setNotice("云端保存失败；请确认已执行最新的 Supabase SQL。");
        })
        .finally(() => setCloudSyncing(false));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [inventory, activeUserId, isHydrated, saveUsers]);

  const palById = useMemo(() => new Map(data?.pals.map((pal) => [pal.id, pal]) ?? []), [data]);
  const passiveRanks = useMemo(() => {
    const ranks: Record<string, number | null> = { ...bundledPassiveRanks };
    for (const [name, rank] of Object.entries(data?.passiveRanks ?? {})) {
      ranks[name] = rank;
      ranks[normalizePassiveName(name)] = rank;
    }
    return ranks;
  }, [data]);
  const availablePassives = useMemo(() => unique(inventory.flatMap((item) => item.passives)).sort((left, right) => {
    return (passiveRankOf(right, passiveRanks) ?? -99) - (passiveRankOf(left, passiveRanks) ?? -99) || left.localeCompare(right, "zh-CN");
  }), [inventory, passiveRanks]);
  const ownedPassiveSet = useMemo(() => new Set(availablePassives), [availablePassives]);
  const catchLevelLimit = Math.min(80, playerLevel + 8);
  const captureSources = useMemo(() => {
    if (!data || !allowCapture) return [];
    return data.pals.flatMap((pal) => {
      if (excludeWorldTreeOnly && isWorldTreeOnlyPal(pal)) return [];
      const source = selectCaptureSource(pal, restrictCaptureByLevel ? catchLevelLimit : 80, catchLevelLimit);
      if (excludeBossCaptures && source?.kind === "alpha") return [];
      return source ? [source] : [];
    });
  }, [data, allowCapture, restrictCaptureByLevel, catchLevelLimit, excludeWorldTreeOnly, excludeBossCaptures]);
  const catchablePalIds = useMemo(() => captureSources.map((source) => source.palId), [captureSources]);
  const overLevelCaptureCount = useMemo(() => captureSources.filter((source) => source.level > catchLevelLimit).length, [captureSources, catchLevelLimit]);
  const activeTargetId = mode === "exact" ? exactTargetId : graduateTargetId;
  const activeDesiredPassives = mode === "exact" ? exactTargetPassives : graduatePassives;
  const selfOnlyCombo = useMemo(() => data && activeTargetId ? selfBreedingOnlyCombo(data, activeTargetId) : null, [data, activeTargetId]);
  const selfOnlyParents = useMemo(() => inventory.filter((item) => item.palId === activeTargetId), [inventory, activeTargetId]);
  const missingDesiredPassives = useMemo(
    () => activeDesiredPassives.filter((passive) => !ownedPassiveSet.has(passive)),
    [activeDesiredPassives, ownedPassiveSet],
  );
  const planningInventory = useMemo(
    () => compactInventoryForPlanning(inventory, activeDesiredPassives),
    [inventory, activeDesiredPassives],
  );
  const calculationInputKey = useMemo(() => JSON.stringify({
    mode,
    target: activeTargetId,
    desired: activeDesiredPassives,
    maxGenerations,
    playerLevel,
    allowCapture,
    restrictCaptureByLevel,
    excludeWorldTreeOnly,
    excludeBossCaptures,
    inventory: planningInventory.map((item) => [item.id, item.palId, item.sex, item.passives]),
  }), [mode, activeTargetId, activeDesiredPassives, maxGenerations, playerLevel, allowCapture, restrictCaptureByLevel, excludeWorldTreeOnly, excludeBossCaptures, planningInventory]);
  const calculationIsDirty = calculatedInputKey !== calculationInputKey;

  const calculateRoutes = () => {
    if (!data || !plannerWorkerRef.current) {
      setNotice("配种数据仍在加载，请稍后再计算。");
      return;
    }
    if (!activeTargetId) {
      setNotice("请先选择目标帕鲁，再开始计算。");
      return;
    }
    if (!planningInventory.length && !captureSources.length) {
      setNotice("请先录入库存，或允许途中补抓帕鲁。");
      return;
    }
    if (missingDesiredPassives.length) {
      plannerRequestId.current += 1;
      setCalculating(false);
      setExactPlans([]);
      setCalculationSummary({ reachablePals: 0, fullTraitPals: 0 });
      setCalculationDurationMs(0);
      setRoutesTruncated(false);
      setSearchTruncated(false);
      setCalculatedInputKey(calculationInputKey);
      setSelectedExactPlanIndex(0);
      setVisibleMethodCount(METHODS_PER_BATCH);
      setNotice(`无需计算：当前仓库缺少 ${missingDesiredPassives.join("、")}，无法完成词条继承。`);
      return;
    }
    const requestId = plannerRequestId.current + 1;
    plannerRequestId.current = requestId;
    pendingCalculationKey.current = calculationInputKey;
    setCalculating(true);
    setRoutesTruncated(false);
    setSearchTruncated(false);
    const request: PlannerWorkerRequest = {
      requestId,
      ...(plannerWorkerHasData.current ? {} : { data }),
      inventory: planningInventory,
      desiredPassives: activeDesiredPassives,
      captureSources,
      maxGenerations,
      mode,
      profile,
      targetPalId: activeTargetId,
      planLimit: 240,
    };
    plannerWorkerRef.current.postMessage(request);
    plannerWorkerHasData.current = true;
  };
  const cancelCalculation = () => {
    plannerRequestId.current += 1;
    initializePlannerWorker();
    setCalculating(false);
    setNotice("已停止本次路线计算；你可以调整条件后重新开始。");
  };
  const exactPlanIndex = Math.min(selectedExactPlanIndex, Math.max(0, exactPlans.length - 1));
  const exactPlan = exactPlans[exactPlanIndex] ?? null;
  const recommendedPlanGroups = useMemo(() => groupTargetPlans(exactPlans, "recommended", completionTarget), [exactPlans, completionTarget]);
  const difficultyPlanGroups = useMemo(() => groupTargetPlans(exactPlans, "difficulty", completionTarget), [exactPlans, completionTarget]);
  const exactPlanGroups = routeSortMode === "difficulty" ? difficultyPlanGroups : recommendedPlanGroups;
  const visibleExactPlanGroups = exactPlanGroups.slice(0, visibleMethodCount);
  const hasComplexityTradeoff = useMemo(() => hasComplexityDifficultyTradeoff(recommendedPlanGroups, completionTarget), [recommendedPlanGroups, completionTarget]);

  const activePal = palById.get(activeTargetId);
  const activeGraduatePreset = GRADUATE_PRESETS.find((item) => item.id === graduatePresetId) ?? GRADUATE_PRESETS[0];
  const activePassiveAlternatives = useMemo(
    () => mode === "recommend" ? graduatePassiveAlternativesFor(activeGraduatePreset, graduateTargetId) : [],
    [mode, activeGraduatePreset, graduateTargetId],
  );
  const summary = calculatedInputKey ? calculationSummary : { reachablePals: inventory.length ? new Set(inventory.map((item) => item.palId)).size : 0, fullTraitPals: 0 };
  const detailPal = detailPalId ? palById.get(detailPalId) : undefined;

  const filteredPals = useMemo(() => {
    if (!data) return [];
    return data.pals
      .map((pal) => ({ pal, score: palMatchScore(pal, palSearch) }))
      .filter((item): item is { pal: Pal; score: number } => item.score != null)
      .sort((a, b) => a.score - b.score || a.pal.dex.localeCompare(b.pal.dex, undefined, { numeric: true }))
      .map((item) => item.pal);
  }, [data, palSearch]);

  const targetOptions = useMemo(() => {
    if (!data) return [];
    const query = normalizedSearch(targetSearch);
    return data.pals
      .filter((pal) => fuzzyMatches(`${pal.dex}${pal.name}${pal.nameZh}`, query))
      .sort((a, b) => a.dex.localeCompare(b.dex, undefined, { numeric: true }));
  }, [data, targetSearch]);

  const passiveSuggestions = (query: string, selected: string[], ownedFirst = false) => {
    const normalized = normalizedSearch(query);
    const owned = new Set(availablePassives);
    const pool = ownedFirst && !normalized
      ? availablePassives
      : unique([...availablePassives, ...(data?.passives ?? []), ...PASSIVE_PRESETS]);
    return pool
      .filter((passive) => !selected.includes(passive) && fuzzyMatches(passive, normalized))
      .sort((left, right) => Number(owned.has(right)) - Number(owned.has(left)) || (passiveRankOf(right, passiveRanks) ?? -99) - (passiveRankOf(left, passiveRanks) ?? -99) || left.localeCompare(right, "zh-CN"))
      .slice(0, 12);
  };

  const addDraftPassive = (passive: string) => {
    if (!passive.trim()) return;
    setDraft((current) => ({ ...current, passives: unique([...current.passives, passive]) }));
    setPassiveInput("");
  };

  const addDesiredPassive = (passive: string) => {
    const value = passive.trim();
    if (!value || activeDesiredPassives.includes(value) || activeDesiredPassives.length >= 4) return;
    if (mode === "exact") {
      setExactTargetPassives((current) => [...current, value]);
      setSelectedExactPlanIndex(0);
      setVisibleMethodCount(METHODS_PER_BATCH);
    }
    else {
      setGraduatePassives((current) => [...current, value]);
      setSelectedExactPlanIndex(0);
      setVisibleMethodCount(METHODS_PER_BATCH);
    }
    setDesiredInput("");
  };

  const replaceDesiredPassive = (replaces: string, passive: string) => {
    if (activeDesiredPassives.includes(passive)) return;
    const replace = (current: string[]) => current.map((item) => item === replaces ? passive : item);
    if (mode === "exact") setExactTargetPassives(replace);
    else setGraduatePassives(replace);
    setSelectedExactPlanIndex(0);
    setVisibleMethodCount(METHODS_PER_BATCH);
  };

  const clearDesiredPassives = () => {
    if (mode === "exact") setExactTargetPassives([]);
    else setGraduatePassives([]);
    setDesiredInput("");
    setSelectedExactPlanIndex(0);
    setVisibleMethodCount(METHODS_PER_BATCH);
  };

  const selectGraduatePreset = (preset: GraduatePreset) => {
    const target = preset.candidates[0].palId;
    setGraduatePresetId(preset.id);
    setGraduateTargetId(target);
    setGraduatePassives(graduatePassivesFor(preset, target));
    setSelectedExactPlanIndex(0);
    setVisibleMethodCount(METHODS_PER_BATCH);
  };

  const selectGraduatePal = (preset: GraduatePreset, palId: string) => {
    setGraduateTargetId(palId);
    setGraduatePassives(graduatePassivesFor(preset, palId));
    setSelectedExactPlanIndex(0);
    setVisibleMethodCount(METHODS_PER_BATCH);
  };

  const saveDraft = () => {
    if (!draft.palId) {
      setNotice("请先选择一个帕鲁。然后再保存到库存。");
      return;
    }
    const numberOrNull = (value: string) => value === "" ? null : Math.max(0, Math.min(100, Number(value)));
    const item: InventoryPal = {
      id: `pal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      palId: draft.palId,
      sex: draft.sex,
      passives: unique(draft.passives),
      hp: numberOrNull(draft.hp),
      attack: numberOrNull(draft.attack),
      defense: numberOrNull(draft.defense),
      nickname: draft.nickname.trim(),
    };
    setInventory((current) => [...current, item]);
    setDraft(EMPTY_DRAFT);
    setPalSearch("");
    setInventoryOpen(false);
    setNotice(`${palById.get(item.palId)?.nameZh ?? "帕鲁"} 已加入库存。`);
  };

  const loadExample = () => {
    const example: InventoryPal[] = [
      { id: "demo-1", palId: "1:0", sex: "F", passives: ["卓绝技艺"], hp: 44, attack: 62, defense: 55, nickname: "钓到的彩词条" },
      { id: "demo-2", palId: "2:0", sex: "M", passives: ["破坏神"], hp: 71, attack: 68, defense: 48 },
      { id: "demo-3", palId: "3:0", sex: "F", passives: ["神速"], hp: 39, attack: 51, defense: 64 },
      { id: "demo-4", palId: "4:0", sex: "M", passives: ["不死之身"], hp: 83, attack: 74, defense: 70 },
      { id: "demo-5", palId: "6:0", sex: "F", passives: ["传说"], hp: 92, attack: 89, defense: 78 },
    ];
    setInventory(example);
    const demoPreset = GRADUATE_PRESETS.find((item) => item.id === "pve") ?? GRADUATE_PRESETS[0];
    setGraduatePresetId(demoPreset.id);
    setGraduateTargetId("139:0");
    setGraduatePassives(graduatePassivesFor(demoPreset, "139:0"));
    setPlayerLevel(20);
    setAllowCapture(true);
    setRestrictCaptureByLevel(true);
    setExcludeWorldTreeOnly(false);
    setExcludeBossCaptures(false);
    setMaxGenerations(4);
    setMode("recommend");
    setNotice("示例已载入：已为中期阿努比斯套用稳定攻坚词条，可以直接计算毕业路线。");
  };

  const exportJson = () => {
    downloadFile("palworld-breeding-inventory.json", JSON.stringify({ version: 7, inventory, exactTargetPassives, graduatePassives, graduatePresetId, graduateTargetId, profile, exactTargetId, playerLevel, allowCapture, restrictCaptureByLevel, excludeWorldTreeOnly, excludeBossCaptures, maxGenerations }, null, 2), "application/json");
  };

  const exportCsv = () => {
    const rows = inventory.map((item) => [item.palId, item.sex, item.passives.join("|"), item.hp ?? "", item.attack ?? "", item.defense ?? "", item.nickname ?? ""].map(String).map(maskCsvCell).join(","));
    downloadFile("palworld-breeding-inventory.csv", `pal_id,sex,passives,hp,attack,defense,nickname\n${rows.join("\n")}`, "text/csv;charset=utf-8");
  };

  const importInventory = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !data) return;
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(text) as Partial<SavedState> & { version?: number };
        if (!Array.isArray(parsed.inventory)) throw new Error("missing inventory");
        setInventory(parsed.inventory);
        if (Array.isArray(parsed.exactTargetPassives)) setExactTargetPassives(parsed.exactTargetPassives.slice(0, 4));
        if (Array.isArray(parsed.graduatePassives)) setGraduatePassives(parsed.graduatePassives.slice(0, 4));
        if (typeof parsed.graduatePresetId === "string" && GRADUATE_PRESETS.some((item) => item.id === parsed.graduatePresetId)) setGraduatePresetId(parsed.graduatePresetId);
        if (typeof parsed.graduateTargetId === "string") setGraduateTargetId(parsed.graduateTargetId);
        if (parsed.profile) setProfile(parsed.profile);
        if (parsed.exactTargetId) setExactTargetId(parsed.exactTargetId);
        if (typeof parsed.playerLevel === "number") setPlayerLevel(parsed.playerLevel);
        if (typeof parsed.allowCapture === "boolean") setAllowCapture(parsed.allowCapture);
        if (typeof parsed.restrictCaptureByLevel === "boolean") setRestrictCaptureByLevel(parsed.restrictCaptureByLevel);
        if (typeof parsed.excludeWorldTreeOnly === "boolean") setExcludeWorldTreeOnly(parsed.excludeWorldTreeOnly);
        if (typeof parsed.excludeBossCaptures === "boolean") setExcludeBossCaptures(parsed.excludeBossCaptures);
        const importedGenerations = parsed.maxGenerations ?? parsed.maxBreedingSteps;
        if (typeof importedGenerations === "number") setMaxGenerations(Math.max(1, Math.min(12, importedGenerations)));
      } else {
        const imported = parseInventoryCsv(text, data.pals);
        if (!imported.length) throw new Error("no rows");
        setInventory(imported);
      }
      setNotice("库存导入成功，路线已重新计算。 ");
    } catch {
      setNotice("导入失败。请使用本工具导出的 JSON，或包含 pal_id、sex、passives 列的 CSV。 ");
    } finally {
      event.target.value = "";
    }
  };

  const importGameSave = async (items: InventoryPal[], importMode: "merge" | "replace", meta: { ownerUid: string; fileName: string }) => {
    const nextInventory = importMode === "replace" ? items : (() => {
      const byId = new Map(inventory.map((item) => [item.id, item]));
      items.forEach((item) => byId.set(item.id, item));
      return [...byId.values()];
    })();
    setInventory(nextInventory);
    if (!activeUserId) {
      setCloudSyncing(true);
      try {
        const userId = await replaceSharedUserInventory({
          name: `玩家 ${meta.ownerUid.slice(0, 8)}`,
          sourceFileName: meta.fileName,
        }, nextInventory);
        setActiveUserId(userId);
        setSaveUsers(await listSharedSaveUsers());
        skipNextCloudSync.current = true;
      } catch (error) {
        console.error("Initial cloud inventory save failed", error);
        setNotice("存档已在本机导入，但云端保存失败；请先执行提供的 Supabase SQL。");
      } finally {
        setCloudSyncing(false);
      }
    }
    setSaveImportOpen(false);
    setNotice(`已从 Level.sav ${importMode === "replace" ? "读取" : "合并"} ${items.length} 只帕鲁；路线计算已自动合并重复种源，并保存到共享用户。`);
  };

  const switchSaveUser = async (userId: string) => {
    if (!userId || userId === activeUserId) return;
    setCloudSyncing(true);
    try {
      if (activeUserId) {
        const current = saveUsers.find((item) => item.user_id === activeUserId);
        await replaceSharedUserInventory({
          userId: activeUserId,
          name: current?.name ?? "我的存档",
          sourceFileName: current?.source_file_name ?? undefined,
        }, inventory);
      }
      const items = await loadSharedUserInventory(userId);
      skipNextCloudSync.current = true;
      setActiveUserId(userId);
      setInventory(items);
      setNotice(`已切换到 ${saveUsers.find((item) => item.user_id === userId)?.name ?? "共享用户"}。`);
    } catch {
      setNotice("共享用户读取失败，请确认数据库 SQL 已执行。");
    } finally {
      setCloudSyncing(false);
    }
  };

  const prepareNewSaveUser = async () => {
    setCloudSyncing(true);
    try {
      if (activeUserId) {
        const current = saveUsers.find((item) => item.user_id === activeUserId);
        await replaceSharedUserInventory({
          userId: activeUserId,
          name: current?.name ?? "我的存档",
          sourceFileName: current?.source_file_name ?? undefined,
        }, inventory);
      }
      setActiveUserId("");
      setInventory([]);
      setNotice("已准备新用户；读取 Level.sav 并确认导入后会自动保存到共享数据库。");
    } catch {
      setNotice("当前角色保存失败，暂时无法新建角色。");
    } finally {
      setCloudSyncing(false);
    }
  };

  const palLabel = (palId: string) => {
    const pal = palById.get(palId);
    return pal ? `${pal.nameZh} · ${pal.name}` : palId;
  };

  const passiveKeyDown = (event: KeyboardEvent<HTMLInputElement>, type: "draft" | "desired") => {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    if (type === "draft") addDraftPassive(passiveInput);
    else addDesiredPassive(desiredInput);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="返回顶部">
          <span className="brand-mark">P</span>
          <span><strong>帕鲁育种实验室</strong><small>PAL GENETICS · 1.0</small></span>
        </a>
        <nav className="topnav" aria-label="主导航">
          <Link href="/paldex">完整图鉴</Link>
          <Link href="/calculator">配种计算器</Link>
          <a href="#inventory">我的帕鲁</a>
          <a href="#planner">毕业规划</a>
          <a href="#steps">操作清单</a>
          <a href="#mechanics">机制说明</a>
        </nav>
        <div className="topbar-account">
          <label><span>{cloudSyncing ? "共享库存保存中…" : "当前用户 · 公开可编辑"}</span><select value={activeUserId} onChange={(event) => event.target.value ? void switchSaveUser(event.target.value) : void prepareNewSaveUser()} disabled={cloudSyncing}>
            <option value="">＋ 新建用户</option>
            {saveUsers.map((user) => <option key={user.user_id} value={user.user_id}>{user.name} · {user.source_file_name || "手动库存"}</option>)}
          </select></label>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">BREED SMARTER, NOT HARDER</p>
          <h1>把散落的彩色词条，<br /><em>炼成你的终极帕鲁。</em></h1>
          <p className="hero-lede">录入已有的低阶帕鲁、性别、词条与潜力，再告诉我你的等级。系统会从你的库存个体出发，综合当前打得过的野外种源，在 44,486 条 1.0 配方中按你选择的繁殖代数规划路线。</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setInventoryOpen(true)}>+ 录入第一只帕鲁</button>
            <button className="ghost-button" onClick={loadExample}>用示例体验</button>
            <Link className="ghost-button" href="/paldex">浏览完整图鉴</Link>
            <Link className="ghost-button" href="/calculator">打开配种计算器</Link>
          </div>
        </div>
        <div className="hero-console" aria-label="规划器概览">
          <div className="console-header"><span>当前育种盘面</span><small>{activeUserId ? "自动同步到共享用户" : "新用户尚未导入"}</small></div>
          <div className="console-metrics">
            <div><strong>{inventory.length}</strong><span>已有个体</span></div>
            <div><strong>{summary.reachablePals}</strong><span>可达物种</span></div>
            <div><strong>{catchablePalIds.length}</strong><span>当前可补抓</span></div>
          </div>
          <div className="gene-track">
            <span>目标基因组</span>
            <div>{activeDesiredPassives.length ? activeDesiredPassives.map((passive, index) => <b key={passive} className="passive-hover" title={passiveEffect(passive)} data-passive-effect={passiveEffect(passive)} style={{ "--gene-index": index } as React.CSSProperties}>{passive}</b>) : <i>未指定词条（仅匹配目标物种）</i>}</div>
          </div>
          <div className="console-status"><i className={data && !isCalculating ? "ready" : ""} />{!data ? "正在装载配种图谱…" : isCalculating ? `后台搜索 ${maxGenerations} 代路线…` : calculationIsDirty ? "条件已更新 · 点击开始计算" : `计算完成 · ${calculationDurationMs}ms`}</div>
        </div>
      </section>

      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="关闭提示">×</button></div>}

      <section className="workspace" id="planner">
        <aside className="inventory-panel" id="inventory">
          <div className="section-heading compact">
            <div><span>01</span><h2>我的帕鲁</h2></div>
            <button className="small-add" onClick={() => setInventoryOpen(true)}>＋ 添加</button>
          </div>
          <p className="panel-help">可直接读取 Windows 的 Level.sav；文件只在本机浏览器解析。</p>
          <button className="save-import-launch" onClick={() => setSaveImportOpen(true)}><span>▣</span><b>读取游戏存档</b><small>自动导入物种、性别、词条与潜力值</small><i>→</i></button>
          <div className="inventory-list">
            {!inventory.length ? (
              <button className="empty-inventory" onClick={() => setInventoryOpen(true)}><b>＋</b><span>还没有库存</span><small>先录入钓鱼或抓到的帕鲁</small></button>
            ) : inventory.slice(0, 60).map((item) => {
              const pal = palById.get(item.palId);
              return <article className="inventory-card" key={item.id}>
                {pal?.image ? <img src={pal.image} alt="" loading="lazy" decoding="async" /> : <div className="pal-placeholder">P</div>}
                <div className="inventory-main">
                  <div><strong>{pal?.nameZh ?? item.palId}</strong><span className={item.sex === "M" ? "male" : "female"}>{item.sex === "M" ? "♂" : "♀"}</span></div>
                  <small>No.{pal?.dex} · {pal?.name}</small>
                  <div className="mini-passives">{item.passives.length ? item.passives.map((passive) => <PassiveTag key={passive} name={passive} rank={passiveRankOf(passive, passiveRanks)} compact />) : <em>无词条</em>}</div>
                </div>
                <button className="remove-button" onClick={() => setInventory((current) => current.filter((entry) => entry.id !== item.id))} aria-label={`删除${pal?.nameZh ?? "帕鲁"}`}>×</button>
              </article>;
            })}
            {inventory.length > 60 && <div className="inventory-overflow-note">库存共 {inventory.length} 只；列表仅展示前 60 只，全部个体仍已保存。路线计算已合并为 {planningInventory.length} 个有效种源。</div>}
          </div>
          <div className="inventory-tools">
            <input ref={importRef} type="file" accept=".json,.csv" onChange={importInventory} hidden />
            <button onClick={() => importRef.current?.click()}>导入备份</button>
            <button onClick={exportJson} disabled={!inventory.length}>备份 JSON</button>
            <button onClick={exportCsv} disabled={!inventory.length}>导出 CSV</button>
          </div>
        </aside>

        <div className="planner-panel">
          <div className="section-heading">
            <div><span>02</span><h2>选择毕业方案</h2></div>
            <p>从用途、进度与词条出发，得到可执行的孵化路线。</p>
          </div>

          <div className="mode-switch" role="tablist" aria-label="规划模式">
            <button className={mode === "recommend" ? "active" : ""} onClick={() => setMode("recommend")} role="tab"><b>毕业方案</b><small>已校验的分类与词条</small></button>
            <button className={mode === "exact" ? "active" : ""} onClick={() => setMode("exact")} role="tab"><b>自由目标</b><small>指定任意帕鲁与词条</small></button>
          </div>

          <div className="capture-policy">
            <div className="level-control">
              <span>你的当前等级</span>
              <label><input type="number" min="1" max="80" value={playerLevel} onChange={(event) => setPlayerLevel(Math.max(1, Math.min(80, Number(event.target.value) || 1)))} /><b>级</b></label>
              <small>{restrictCaptureByLevel ? <>已严格排除高于推荐上限 <strong>{catchLevelLimit}</strong> 的捕捉种源。</> : <>已允许高等级种源；高于推荐上限 <strong>{catchLevelLimit}</strong> 的来源有 {overLevelCaptureCount} 种。</>}</small>
            </div>
            <label className="capture-toggle"><input type="checkbox" checked={allowCapture} onChange={(event) => setAllowCapture(event.target.checked)} /><span><b>允许途中补抓帕鲁</b><small>{allowCapture ? `当前有 ${catchablePalIds.length} 种可作为路线种源` : "仅使用我的现有库存"}</small></span></label>
            <label className="generation-cap"><select value={maxGenerations} onChange={(event) => { setMaxGenerations(Number(event.target.value)); setSelectedExactPlanIndex(0); setVisibleMethodCount(METHODS_PER_BATCH); }}>{[1, 2, 3, 4, 5, 6, 8, 10, 12].map((value) => <option key={value} value={value}>{value}</option>)}</select><span>最大繁殖代数<small>按最长亲代链计算，默认 4 代</small></span></label>
            <div className="capture-filters">
              <label><input type="checkbox" checked={restrictCaptureByLevel} disabled={!allowCapture} onChange={(event) => setRestrictCaptureByLevel(event.target.checked)} /><span><b>仅使用当前等级＋8以内种源</b><small>关闭后可查看包含高等级捕捉的最短路线</small></span></label>
              <label><input type="checkbox" checked={excludeWorldTreeOnly} disabled={!allowCapture} onChange={(event) => setExcludeWorldTreeOnly(event.target.checked)} /><span><b>不选择仅在世界树内的帕鲁</b><small>仍允许同时分布在帕洛斯群岛的帕鲁</small></span></label>
              <label><input type="checkbox" checked={excludeBossCaptures} disabled={!allowCapture} onChange={(event) => setExcludeBossCaptures(event.target.checked)} /><span><b>不需要额外捕捉 Boss</b><small>已在库存中的 Boss 不受影响</small></span></label>
            </div>
          </div>

          <div className="goal-builder">
            {mode === "recommend" ? (
              <GraduatePresetChooser
                preset={activeGraduatePreset}
                targetId={graduateTargetId}
                palById={palById}
                onSelectPreset={selectGraduatePreset}
                onSelectPal={(palId) => selectGraduatePal(activeGraduatePreset, palId)}
                onOpenPal={setDetailPalId}
              />
            ) : (
              <div className="exact-target">
                <label htmlFor="target-pal-search">想要孵化的帕鲁</label>
                <div className="target-combobox">
                  {exactTargetId && palById.get(exactTargetId) && !targetPickerOpen ? <button className="selected-target" onClick={() => { setTargetPickerOpen(true); setTargetSearch(""); }}>
                    <img src={palById.get(exactTargetId)?.image} alt="" /><span><strong>{palById.get(exactTargetId)?.nameZh}</strong><small>No.{palById.get(exactTargetId)?.dex} · {palById.get(exactTargetId)?.name}</small></span><i>更换</i>
                  </button> : <>
                    <input id="target-pal-search" value={targetSearch} onChange={(event) => { setTargetSearch(event.target.value); setTargetPickerOpen(true); }} onFocus={() => setTargetPickerOpen(true)} placeholder="搜索中文名、英文名或图鉴编号" autoComplete="off" />
                    {targetPickerOpen && <div className="target-options" role="listbox">
                      {targetOptions.map((pal) => <button key={pal.id} role="option" aria-selected={pal.id === exactTargetId} onClick={() => { setExactTargetId(pal.id); setSelectedExactPlanIndex(0); setVisibleMethodCount(METHODS_PER_BATCH); setTargetSearch(""); setTargetPickerOpen(false); }}><img src={pal.image} alt="" loading="lazy" decoding="async" /><span><strong>{pal.nameZh}</strong><small>No.{pal.dex} · {pal.name}</small></span>{pal.id === exactTargetId && <i>✓</i>}</button>)}
                      {!targetOptions.length && <small>没有找到匹配的帕鲁</small>}
                    </div>}
                  </>}
                </div>
              </div>
            )}

            <div className="goal-block">
              <div className="goal-block-heading">
                <label>{mode === "exact" ? "目标帕鲁词条（可不选）" : "毕业四词条"} <small>{activeDesiredPassives.length}/4</small></label>
                <div>
                  {!!activeDesiredPassives.length && <button className="clear-passives" onClick={clearDesiredPassives}>一键清空</button>}
                  {mode === "recommend" && <button onClick={() => selectGraduatePal(activeGraduatePreset, graduateTargetId)}>恢复推荐</button>}
                </div>
              </div>
              <div className="tag-input">
                {activeDesiredPassives.map((passive) => <PassiveTag key={passive} name={passive} rank={passiveRankOf(passive, passiveRanks)} availability={ownedPassiveSet.has(passive) ? "owned" : "missing"} onRemove={() => { if (mode === "exact") setExactTargetPassives((current) => current.filter((item) => item !== passive)); else setGraduatePassives((current) => current.filter((item) => item !== passive)); setSelectedExactPlanIndex(0); setVisibleMethodCount(METHODS_PER_BATCH); }} />)}
                {activeDesiredPassives.length < 4 && <input value={desiredInput} onChange={(event) => setDesiredInput(event.target.value)} onKeyDown={(event) => passiveKeyDown(event, "desired")} placeholder={activeDesiredPassives.length ? "搜索并继续添加…" : mode === "exact" ? "留空则只查询目标物种" : "搜索词条，支持模糊匹配"} />}
              </div>
              {!!activeDesiredPassives.length && <div className={`passive-availability-summary ${missingDesiredPassives.length ? "has-missing" : "complete"}`}>
                <span>{missingDesiredPassives.length ? "!" : "✓"}</span>
                <p>{missingDesiredPassives.length
                  ? <>仓库缺少 <strong>{missingDesiredPassives.join("、")}</strong>。按当前规则，新补抓帕鲁不自带目标词条，因此无需计算即可判定词条方案不可达。</>
                  : <>所选词条都已在当前仓库中找到，可继续计算继承路线。</>}</p>
              </div>}
              {mode === "exact" && <small className="passive-library-note">默认仅显示仓库已有词条，并按品质从高到低排列；输入名称可搜索完整词条库。</small>}
              {activeDesiredPassives.length < 4 && <SearchSuggestions items={passiveSuggestions(desiredInput, activeDesiredPassives, mode === "exact")} ranks={passiveRanks} query={desiredInput} onSelect={addDesiredPassive} emptyText="没有匹配词条；按回车仍可添加未收录词条" />}
              {mode === "recommend" && <small className="graduate-passive-note">{activeGraduatePreset.passiveNote} 点击词条右侧 × 后即可按喜好替换。</small>}
              {mode === "recommend" && !!activePassiveAlternatives.length && <div className="passive-alternatives">
                <div><strong>可替换 / 降级方案</strong><small>点击即可替换对应毕业词条</small></div>
                <div className="passive-alternative-list">
                  {activePassiveAlternatives.filter((alternative) => activeDesiredPassives.includes(alternative.replaces)).map((alternative) => {
                    const owned = ownedPassiveSet.has(alternative.passive);
                    return <button key={`${alternative.replaces}-${alternative.passive}`} className={owned ? "owned" : "missing"} onClick={() => replaceDesiredPassive(alternative.replaces, alternative.passive)} disabled={activeDesiredPassives.includes(alternative.passive)} title={`${passiveEffect(alternative.passive)}；${alternative.note}`}>
                      <span>{owned ? "✓" : "○"}</span>
                      <b>{alternative.passive}</b>
                      <small>{alternative.label} · 替换{alternative.replaces}</small>
                      <em>{alternative.note}</em>
                    </button>;
                  })}
                </div>
                <p>✓ 仓库已有　○ 当前缺少；替代方案会降低部分极限收益，但能显著减少稀有词条门槛。</p>
              </div>}
              {mode === "exact" && <small className="goal-hint">不选择词条时，只查询目标帕鲁物种；选择后则要求最终子代完整带有这些词条。</small>}
            </div>
          </div>

          <div className={`calculate-action ${selfOnlyCombo ? "self-only" : calculationIsDirty ? "dirty" : "ready"}`}>
            <div><strong>{selfOnlyCombo ? "该帕鲁只有同种配种公式" : calculationIsDirty ? "条件尚未计算" : "当前结果已是最新"}</strong><small>{selfOnlyCombo ? "无需搜索多代可达性，下面已直接给出同种繁殖要求。" : calculationIsDirty ? "选完用户、词条、目标和代数后，再统一开始计算。" : `上次计算耗时 ${calculationDurationMs}ms；修改任意条件后需再次点击。`}</small></div>
            <button className="primary-button" onClick={isCalculating ? cancelCalculation : calculateRoutes} disabled={!data || !!selfOnlyCombo}>{selfOnlyCombo ? "无需计算" : isCalculating ? "停止计算" : mode === "recommend" ? calculatedInputKey ? "重新生成路线" : "生成毕业路线" : calculatedInputKey ? "重新计算" : "开始计算"}</button>
          </div>

          {selfOnlyCombo && activePal ? (
            <SelfBreedingOnlyResult pal={activePal} parents={selfOnlyParents} desiredPassives={activeDesiredPassives} />
          ) : mode === "exact" && !inventory.length ? (
            <div className="planner-empty">
              <span>◎</span><h3>请先录入至少一只帕鲁</h3><p>指定目标路线必须从你的已录入帕鲁开始，途中可以按设置补抓其他亲代。</p><button className="primary-button" onClick={() => setInventoryOpen(true)}>录入帕鲁</button>
            </div>
          ) : !inventory.length && !catchablePalIds.length ? (
            <div className="planner-empty">
              <span>◎</span><h3>暂时没有可用种源</h3><p>录入一只已有帕鲁，或打开“允许途中补抓帕鲁”后再计算路线。</p><button className="primary-button" onClick={() => setInventoryOpen(true)}>录入帕鲁</button>
            </div>
          ) : isCalculating ? (
            <div className="planner-empty"><span className="spinner">◌</span><h3>正在后台计算 {maxGenerations} 代可达图谱</h3><p>计算已移到独立线程，指定目标时只搜索能通往目标的物种；需要调整条件时可以立即停止。</p><button className="ghost-button" onClick={cancelCalculation}>停止本次计算</button></div>
          ) : !calculatedInputKey || calculationIsDirty ? (
            <div className="planner-empty"><span>▶</span><h3>{calculatedInputKey ? "条件已经改变" : mode === "recommend" ? "方案已选好，生成毕业路线" : "准备好后再开始计算"}</h3><p>系统不会在选择过程中自动搜索。确认用户、目标词条、目标帕鲁和最大代数后，再统一生成路线。</p><button className="primary-button" onClick={calculateRoutes}>{mode === "recommend" ? calculatedInputKey ? "按新条件生成路线" : "生成毕业路线" : calculatedInputKey ? "按新条件重新计算" : "开始计算"}</button></div>
          ) : (
            <div className="exact-result">
              {!activeTargetId ? <div className="no-route">选择一个目标帕鲁后，这里会显示不超过 {maxGenerations} 代的路线；目标词条可以留空。</div> : !exactPlan ? <div className={`no-route ${missingDesiredPassives.length ? "missing-passives" : "species-path"}`}>
                <strong>{missingDesiredPassives.length ? "目标词条不可继承" : `${activePal?.nameZh} 当前 ${maxGenerations} 代内物种路径不可达`}</strong>
                {missingDesiredPassives.length
                  ? <span>原因不是配种公式：当前仓库没有 <b>{missingDesiredPassives.join("、")}</b>。新补抓种源按无目标词条处理，请先补录携带这些词条的帕鲁，或使用上方替代方案。</span>
                  : <span>所选词条均已在仓库中，当前失败发生在帕鲁配种路径。{mode === "exact" ? "路线必须从至少一只现有库存帕鲁出发；" : ""}可提高代数、放宽捕捉限制或补录可用亲代后重试。</span>}
              </div> : <>
                <RouteMethodBrowser
                  groups={visibleExactPlanGroups}
                  totalGroups={exactPlanGroups.length}
                  totalPlans={exactPlans.length}
                  sortMode={routeSortMode}
                  completionTarget={completionTarget}
                  hasComplexityTradeoff={hasComplexityTradeoff}
                  selectedPlanIndex={exactPlanIndex}
                  inventory={inventory}
                  palById={palById}
                  palLabel={palLabel}
                  onSelectPlan={setSelectedExactPlanIndex}
                  onOpenPal={setDetailPalId}
                  onSortModeChange={(nextMode) => {
                    setRouteSortMode(nextMode);
                    setVisibleMethodCount(METHODS_PER_BATCH);
                    const nextGroups = nextMode === "difficulty" ? difficultyPlanGroups : recommendedPlanGroups;
                    setSelectedExactPlanIndex(nextGroups[0]?.planIndexes[0] ?? 0);
                  }}
                  onCompletionTargetChange={(nextTarget) => {
                    setCompletionTarget(nextTarget);
                    setVisibleMethodCount(METHODS_PER_BATCH);
                    const nextGroups = groupTargetPlans(exactPlans, routeSortMode, nextTarget);
                    setSelectedExactPlanIndex(nextGroups[0]?.planIndexes[0] ?? 0);
                  }}
                  onShowMore={() => setVisibleMethodCount((current) => current + METHODS_PER_BATCH)}
                />
                {routesTruncated && <div className="tradeoff-note">为避免浏览器内存过高，本次保留了综合排序最优的 240 条路线。收紧最大代数、等级或 Boss 条件可以查看更聚焦的完整结果。</div>}
                {searchTruncated && <div className="tradeoff-note">搜索已达到浏览器安全上限，当前展示的是在上限内找到的最优路线。降低最大代数或收紧补抓条件可获得更完整结果。</div>}
              </>}
            </div>
          )}
        </div>
      </section>

      <section className="mechanics" id="mechanics">
        <div className="section-heading light"><div><span>规则</span><h2>为什么这样规划</h2></div><p>每个结果都基于同一套 1.0 规则。</p></div>
        <div className="mechanic-grid">
          <article><b>01</b><h3>物种先查表</h3><p>特殊配方、同种繁殖和性别限定会覆盖简单平均公式；本工具直接查询当前 1.0 组合表。</p></article>
          <article><b>02</b><h3>词条先合并去重</h3><p>2+2、3+1、4+0 只要最终词条池相同，基础遗传概率相同。杂词条才是真正的污染。</p></article>
          <article><b>03</b><h3>可用与完美分开估算</h3><p>包含全部目标词条就是可用；只有目标词条、没有杂词条才是完美。</p></article>
          <article><b>04</b><h3>整条路线一起比较</h3><p>综合难度只比较捕捉成本和预计蛋数，可以选择按可用成品或完美成品排序。</p></article>
        </div>
        <a className="mechanics-link" href="https://palworld.wiki.gg/wiki/Breeding" target="_blank" rel="noreferrer">查看 1.0 机制来源 ↗</a>
      </section>

      <footer><span>帕鲁育种实验室 · 非官方玩家工具</span><span>等级与分布快照 2026-07-20 · 结果请以游戏 1.0 当前版本为准</span></footer>

      {isInventoryOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setInventoryOpen(false)}>
        <section className="inventory-modal" role="dialog" aria-modal="true" aria-labelledby="add-pal-title">
          <header><div><span>NEW SPECIMEN</span><h2 id="add-pal-title">录入帕鲁个体</h2></div><button onClick={() => setInventoryOpen(false)} aria-label="关闭">×</button></header>
          <div className="modal-body">
            <div className="pal-picker">
              <label htmlFor="pal-search">选择帕鲁 *</label>
              <input id="pal-search" value={palSearch} onChange={(event) => { setPalSearch(event.target.value); setDraft((current) => ({ ...current, palId: "" })); }} placeholder="支持中文、英文、编号及模糊匹配" autoFocus />
              <div className="pal-options">
                {filteredPals.map((pal) => <button key={pal.id} className={draft.palId === pal.id ? "selected" : ""} onClick={() => { setDraft((current) => ({ ...current, palId: pal.id })); setPalSearch(`${pal.nameZh} · ${pal.name}`); }}>
                  <img src={pal.image} alt="" loading="lazy" decoding="async" /><span><strong>{pal.nameZh}</strong><small>No.{pal.dex} · {pal.name}</small></span><i>{draft.palId === pal.id ? "✓" : ""}</i>
                </button>)}
                {!filteredPals.length && <p className="pal-search-empty">没有找到匹配帕鲁，试试简称、英文片段或相近拼写。</p>}
              </div>
            </div>
            <div className="draft-fields">
              <div className="field-row">
                <label>性别 *</label>
                <div className="sex-picker"><button className={draft.sex === "M" ? "selected male" : ""} onClick={() => setDraft((current) => ({ ...current, sex: "M" }))}>♂ 雄性</button><button className={draft.sex === "F" ? "selected female" : ""} onClick={() => setDraft((current) => ({ ...current, sex: "F" }))}>♀ 雌性</button></div>
              </div>
              <div className="field-row">
                <label htmlFor="nickname">备注名 <small>可选</small></label>
                <input id="nickname" value={draft.nickname} onChange={(event) => setDraft((current) => ({ ...current, nickname: event.target.value }))} placeholder="例如：钓鱼获得 / 备用雄性" />
              </div>
              <div className="field-row">
                <label>已有词条 <small>请把杂词条也录入</small></label>
                <div className="tag-input draft-tags">
                  {draft.passives.map((passive) => <PassiveTag key={passive} name={passive} rank={passiveRankOf(passive, passiveRanks)} onRemove={() => setDraft((current) => ({ ...current, passives: current.passives.filter((item) => item !== passive) }))} />)}
                  <input value={passiveInput} onChange={(event) => setPassiveInput(event.target.value)} onKeyDown={(event) => passiveKeyDown(event, "draft")} placeholder="搜索词条或输入未收录词条" />
                </div>
                <SearchSuggestions items={passiveSuggestions(passiveInput, draft.passives)} ranks={passiveRanks} query={passiveInput} onSelect={addDraftPassive} emptyText="没有匹配词条；按回车仍可添加未收录词条" />
              </div>
              <div className="field-row">
                <label>潜力值 <small>没有能力眼镜可以留空</small></label>
                <div className="potential-grid">{(["hp", "attack", "defense"] as const).map((field) => <label key={field}><span>{field === "hp" ? "生命" : field === "attack" ? "攻击" : "防御"}</span><input type="number" min="0" max="100" value={draft[field]} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} placeholder="—" /></label>)}</div>
              </div>
            </div>
          </div>
          <footer><button className="ghost-button" onClick={() => setInventoryOpen(false)}>取消</button><button className="primary-button" onClick={saveDraft}>保存到库存</button></footer>
        </section>
      </div>}

      {isSaveImportOpen && <SaveImportModal pals={data?.pals ?? []} onClose={() => setSaveImportOpen(false)} onImport={importGameSave} />}
      {detailPal && <PalDetailModal key={detailPal.id} pal={detailPal} onClose={() => setDetailPalId("")} />}
    </main>
  );
}

function GraduatePresetChooser({ preset, targetId, palById, onSelectPreset, onSelectPal, onOpenPal }: {
  preset: GraduatePreset;
  targetId: string;
  palById: Map<string, Pal>;
  onSelectPreset: (preset: GraduatePreset) => void;
  onSelectPal: (palId: string) => void;
  onOpenPal: (palId: string) => void;
}) {
  const selectGroup = (group: GraduatePresetGroup) => {
    const first = GRADUATE_PRESETS.find((item) => item.group === group);
    if (first) onSelectPreset(first);
  };
  return <section className="graduate-picker" aria-label="毕业帕鲁预设">
    <div className="graduate-group-tabs" role="tablist" aria-label="毕业方案大类">
      {GRADUATE_PRESET_GROUPS.map((group) => <button key={group.id} className={preset.group === group.id ? "active" : ""} onClick={() => selectGroup(group.id)} role="tab" aria-selected={preset.group === group.id}>
        <b>{group.label}</b><small>{group.short}</small>
      </button>)}
    </div>
    <div className="graduate-purpose-list" role="tablist" aria-label={`${GRADUATE_PRESET_GROUPS.find((item) => item.id === preset.group)?.label}用途`}>
      {GRADUATE_PRESETS.filter((item) => item.group === preset.group).map((item) => <button key={item.id} className={item.id === preset.id ? "active" : ""} onClick={() => onSelectPreset(item)} role="tab" aria-selected={item.id === preset.id}>
        <span>{item.workIcon ? <img src={`data/work-icons/${item.workIcon}.webp`} alt="" /> : item.icon}</span><b>{item.title}</b>
      </button>)}
    </div>
    <header className="graduate-preset-title">
      <div><span>{preset.eyebrow}</span><h3>{preset.title}毕业选择</h3></div>
      <p>{preset.summary}</p>
    </header>
    <div className="graduate-candidate-grid">
      {preset.candidates.map((candidate) => {
        const pal = palById.get(candidate.palId);
        const active = candidate.palId === targetId;
        return <article className={`graduate-candidate ${active ? "active" : ""}`} key={candidate.palId}>
          <button className="graduate-candidate-select" onClick={() => onSelectPal(candidate.palId)} aria-pressed={active}>
            <span className="graduate-rank">#{candidate.rank}</span>
            {pal?.image ? <img src={pal.image} alt="" loading="lazy" decoding="async" /> : <span className="pal-placeholder">P</span>}
            <span className="graduate-candidate-copy">
              <span><i>{candidate.stage}</i><em>{candidate.stats}</em></span>
              <strong>{pal?.nameZh ?? candidate.palId}</strong>
              <small>{candidate.note}</small>
            </span>
            <b className="graduate-check">{active ? "✓" : "选择"}</b>
          </button>
          <button className="graduate-paldex-link" onClick={() => onOpenPal(candidate.palId)} aria-label={`查看${pal?.nameZh ?? "帕鲁"}图鉴`}>图鉴 ↗</button>
        </article>;
      })}
    </div>
  </section>;
}

function PassiveTag({ name, rank, onRemove, compact = false, availability }: { name: string; rank?: number | null; onRemove?: () => void; compact?: boolean; availability?: "owned" | "missing" }) {
  const tier = passiveTier(rank);
  const effect = passiveEffect(name);
  return <span className={`passive-tag passive-hover ${tier.className} ${compact ? "compact" : ""} ${availability ? `availability-${availability}` : ""}`} title={effect} data-passive-effect={effect}>
    {availability && <em className="passive-availability" title={availability === "owned" ? "仓库已有" : "仓库缺少"}>{availability === "owned" ? "✓" : "!"}</em>}
    <b>{name}</b>{tier.label && <i>{tier.label}</i>}{onRemove && <button onClick={onRemove} aria-label={`移除词条${name}`}>×</button>}
  </span>;
}

function SearchSuggestions({ items, ranks, query, onSelect, emptyText }: { items: string[]; ranks: Record<string, number | null>; query: string; onSelect: (value: string) => void; emptyText: string }) {
  return <div className="search-suggestions" aria-label="匹配选项">
    {items.map((item) => { const tier = passiveTier(passiveRankOf(item, ranks)); const effect = passiveEffect(item); return <button className={`${tier.className} passive-hover`} title={effect} data-passive-effect={effect} key={item} onClick={() => onSelect(item)}><span>{item}</span>{tier.label && <small>{tier.label}</small>}</button>; })}
    {query.trim() && !items.length && <p>{emptyText}</p>}
  </div>;
}

function passiveListEffect(passives: string[]): string {
  return passives.map((passive) => `${passive}：${passiveEffect(passive)}`).join("\n");
}

function SelfBreedingOnlyResult({ pal, parents, desiredPassives }: { pal: Pal; parents: InventoryPal[]; desiredPassives: string[] }) {
  const males = parents.filter((parent) => parent.sex === "M");
  const females = parents.filter((parent) => parent.sex === "F");
  const parentPassives = new Set(parents.flatMap((parent) => parent.passives));
  const missingPassives = desiredPassives.filter((passive) => !parentPassives.has(passive));
  return <section className="self-breeding-result" aria-label={`${pal.nameZh}同种繁殖说明`}>
    <div className="self-breeding-heading"><span>同种限定</span><div><strong>不需要计算代数</strong><small>配方表中，{pal.nameZh} 的子代公式只有“自己＋自己”。</small></div></div>
    <div className="self-breeding-formula">
      <div><img src={pal.image} alt="" /><span><small>雄性亲代</small><strong>{pal.nameZh}</strong><em>{males.length ? `库存已有 ${males.length} 只` : "需要先获得 1 只雄性"}</em></span></div>
      <b>＋</b>
      <div><img src={pal.image} alt="" /><span><small>雌性亲代</small><strong>{pal.nameZh}</strong><em>{females.length ? `库存已有 ${females.length} 只` : "需要先获得 1 只雌性"}</em></span></div>
      <b>＝</b>
      <div className="result"><img src={pal.image} alt="" /><span><small>目标子代</small><strong>{pal.nameZh}</strong><em>同种繁殖</em></span></div>
    </div>
    {!!desiredPassives.length && <div className={missingPassives.length ? "self-passive-status missing" : "self-passive-status ready"}>
      <strong>{missingPassives.length ? "目标词条仍有种源缺口" : "同种亲代中已找到全部目标词条"}</strong>
      <div>{desiredPassives.map((passive) => <PassiveTag key={passive} name={passive} availability={parentPassives.has(passive) ? "owned" : "missing"} />)}</div>
      <small>{missingPassives.length ? `需要先获得携带“${missingPassives.join("、")}”的 ${pal.nameZh}，再让一雄一雌同种配种；其他物种无法把词条跨物种传入。` : "选择携带目标词条的雄雌亲代反复孵化，保留同时继承四词条的子代即可。"}</small>
    </div>}
  </section>;
}

function effectiveParentSex(
  step: PlanResult["steps"][number],
  side: "A" | "B",
  inventoryById: Map<string, InventoryPal>,
  stepById: Map<string, PlanResult["steps"][number]>,
): string {
  const parent = side === "A" ? step.parentA : step.parentB;
  const other = side === "A" ? step.parentB : step.parentA;
  const required = side === "A" ? step.genderA : step.genderB;
  if (required === "MALE" || required === "FEMALE") return genderLabel(required);
  const routeRequirements = new Map<string, Set<"M" | "F">>();
  const addRequirement = (nodeId: string, sex: "M" | "F") => {
    const values = routeRequirements.get(nodeId) ?? new Set<"M" | "F">();
    values.add(sex); routeRequirements.set(nodeId, values);
  };
  for (const routeStep of stepById.values()) {
    if (routeStep.sexRequirement === "M" || routeStep.sexRequirement === "F") addRequirement(routeStep.id, routeStep.sexRequirement);
    if (routeStep.sexRequirement === "BOTH") { addRequirement(routeStep.id, "M"); addRequirement(routeStep.id, "F"); }
    if (routeStep.parentA.source === "owned" && routeStep.parentA.inventoryId) { const sex = inventoryById.get(routeStep.parentA.inventoryId)?.sex; if (sex) addRequirement(routeStep.parentA.nodeId, sex); }
    if (routeStep.parentB.source === "owned" && routeStep.parentB.inventoryId) { const sex = inventoryById.get(routeStep.parentB.inventoryId)?.sex; if (sex) addRequirement(routeStep.parentB.nodeId, sex); }
  }
  for (let pass = 0; pass < stepById.size + 1; pass += 1) {
    for (const routeStep of stepById.values()) {
      if (routeStep.genderA !== "WILDCARD") addRequirement(routeStep.parentA.nodeId, routeStep.genderA === "MALE" ? "M" : "F");
      if (routeStep.genderB !== "WILDCARD") addRequirement(routeStep.parentB.nodeId, routeStep.genderB === "MALE" ? "M" : "F");
      if (routeStep.genderA !== "WILDCARD" || routeStep.genderB !== "WILDCARD") continue;
      const a = routeRequirements.get(routeStep.parentA.nodeId); const b = routeRequirements.get(routeStep.parentB.nodeId);
      const fixedA = a?.size === 1 ? [...a][0] : null; const fixedB = b?.size === 1 ? [...b][0] : null;
      if (fixedA && !fixedB) addRequirement(routeStep.parentB.nodeId, fixedA === "M" ? "F" : "M");
      if (fixedB && !fixedA) addRequirement(routeStep.parentA.nodeId, fixedB === "M" ? "F" : "M");
    }
  }
  const knownSex = (candidate: typeof parent): "M" | "F" | null => {
    const routed = routeRequirements.get(candidate.nodeId);
    return routed?.size === 1 ? [...routed][0] : null;
  };
  const ownSex = knownSex(parent);
  if (ownSex) return genderLabel(ownSex);
  if (parent.source === "captured") {
    const otherSex = knownSex(other);
    if (otherSex) return genderLabel(otherSex === "M" ? "F" : "M");
    return "任一性别（需与另一亲代异性）";
  }
  return "需与另一亲代异性";
}

function captureSexRequirement(
  result: PlanResult,
  palId: string,
  inventoryById: Map<string, InventoryPal>,
  stepById: Map<string, PlanResult["steps"][number]>,
): string {
  const labels = new Set<string>();
  for (const step of result.steps) {
    if (step.parentA.source === "captured" && step.parentA.palId === palId) labels.add(effectiveParentSex(step, "A", inventoryById, stepById));
    if (step.parentB.source === "captured" && step.parentB.palId === palId) labels.add(effectiveParentSex(step, "B", inventoryById, stepById));
  }
  if ([...labels].some((label) => label.includes("任一性别"))) return "任一性别，需异性配对";
  if ([...labels].some((label) => label.includes("雄")) && [...labels].some((label) => label.includes("雌"))) return "一雄一雌";
  return [...labels][0] ?? "任一性别";
}

function RouteMethodBrowser({ groups, totalGroups, totalPlans, sortMode, completionTarget, hasComplexityTradeoff, selectedPlanIndex, inventory, palById, palLabel, onSelectPlan, onOpenPal, onSortModeChange, onCompletionTargetChange, onShowMore }: {
  groups: TargetPlanGroup[];
  totalGroups: number;
  totalPlans: number;
  sortMode: TargetPlanSortMode;
  completionTarget: CompletionTarget;
  hasComplexityTradeoff: boolean;
  selectedPlanIndex: number;
  inventory: InventoryPal[];
  palById: Map<string, Pal>;
  palLabel: (id: string) => string;
  onSelectPlan: (index: number) => void;
  onOpenPal: (id: string) => void;
  onSortModeChange: (mode: TargetPlanSortMode) => void;
  onCompletionTargetChange: (target: CompletionTarget) => void;
  onShowMore: () => void;
}) {
  const inventoryById = new Map(inventory.map((item) => [item.id, item]));
  return <section className="method-browser" aria-label="可行繁殖方法">
    <header className="method-browser-title">
      <div><span>03</span><div><h2>{sortMode === "recommended" ? "按推荐顺序选择方法" : "按综合难度选择方法"}</h2><p>{sortMode === "recommended" ? `${totalPlans.toLocaleString("zh-CN")} 条路线按“步骤数＋补抓数”合并为 ${totalGroups} 类；类内难度从低到高。` : `${totalPlans.toLocaleString("zh-CN")} 条路线全部拆开，严格按综合难度从低到高展示。`}</p></div></div>
      <div className="route-sort-controls">
        <div className="route-sort-toggle" role="group" aria-label="方法排序方式"><button className={sortMode === "recommended" ? "active" : ""} onClick={() => onSortModeChange("recommended")}>推荐顺序</button><button className={sortMode === "difficulty" ? "active" : ""} onClick={() => onSortModeChange("difficulty")}>综合难度</button></div>
        <div className="route-sort-toggle" role="group" aria-label="综合难度成品目标"><button className={completionTarget === "usable" ? "active" : ""} onClick={() => onCompletionTargetChange("usable")}>目标：可用</button><button className={completionTarget === "perfect" ? "active" : ""} onClick={() => onCompletionTargetChange("perfect")}>目标：完美</button></div>
      </div>
    </header>
    <div className="difficulty-rule">综合难度当前按获得<b>{completionTarget === "usable" ? "可用成品" : "完美成品"}</b>所需蛋数与捕捉成本排序。</div>
    {hasComplexityTradeoff && <div className="tradeoff-note">有些路线虽然步骤或补抓更多，但获得当前目标成品所需蛋数更少。你可以切换到“综合难度”查看。</div>}
    <div className="method-list">
      {groups.map((group, groupIndex) => {
        const selectedOffset = group.planIndexes.indexOf(selectedPlanIndex);
        const active = selectedOffset >= 0;
        const plan = active ? group.plans[selectedOffset] : group.plans[0];
        const stepById = new Map(plan.steps.map((step) => [step.id, step]));
        const variantOffsets = group.plans.slice(0, 4).map((_, index) => index);
        if (active && !variantOffsets.includes(selectedOffset)) variantOffsets.push(selectedOffset);
        return <article className={`method-card ${active ? "active" : ""}`} key={group.key}>
          <header>
            <div className="method-identity"><b>方法 {String(groupIndex + 1).padStart(2, "0")}</b><strong>{plan.breedingSteps} 步 · {plan.newCaptureCount} 补抓</strong>{groupIndex === 0 && <i>当前排序首选</i>}{active && <em>下方正在查看</em>}</div>
            <div className="method-metrics"><span><b>{plan.breedingSteps}</b>步骤</span><span><b>{plan.newCaptureCount}</b>补抓</span><span><b>{formatNumber(planDifficultyScore(plan, completionTarget))}</b>综合难度</span><span><b>{formatNumber(plan.usableExpectedEggs)}</b>可用蛋数</span><span><b>{formatNumber(plan.perfectExpectedEggs)}</b>完美蛋数</span></div>
          </header>
          {plan.steps.length > 0 ? <div className="method-flow">
            {plan.steps.slice(0, 3).map((step) => <div className="method-flow-step" key={step.id}>
              <span className="method-step-number">STEP {String(step.index).padStart(2, "0")}</span>
              <RoutePalButton pal={palById.get(step.parentA.palId)} source={step.parentA.source} captureSource={step.parentA.captureSource} sexLabel={effectiveParentSex(step, "A", inventoryById, stepById)} onOpenPal={onOpenPal} />
              <i>＋</i>
              <RoutePalButton pal={palById.get(step.parentB.palId)} source={step.parentB.source} captureSource={step.parentB.captureSource} sexLabel={effectiveParentSex(step, "B", inventoryById, stepById)} onOpenPal={onOpenPal} />
              <i>→</i>
              <RoutePalButton pal={palById.get(step.childId)} source="result" passives={step.inheritedPassives} onOpenPal={onOpenPal} />
            </div>)}
            {plan.steps.length > 3 && <div className="method-more-steps">下方已展开全部 {plan.steps.length} 步操作</div>}
          </div> : <div className="method-direct">目标已经在库存中，无需继续配种。</div>}
          <div className="method-variants">
            <div className="variant-heading"><b>{group.plans.length > 1 ? `${group.plans.length} 种可替换组合` : "唯一组合"}</b><small>每一行都是完整可执行组合，点击即可查看详细步骤</small></div>
            <div className="variant-list">
              {variantOffsets.map((offset) => {
                const variant = group.plans[offset];
                const planIndex = group.planIndexes[offset];
                const roots = variant.ownedInventoryIds.map((id) => inventoryById.get(id)).filter(Boolean) as InventoryPal[];
                const rootNames = roots.map((item) => item.nickname || palById.get(item.palId)?.nameZh || item.palId);
                const captures = variant.captures.map((item) => `${palById.get(item.palId)?.nameZh ?? item.palId}${item.count > 1 ? `×${item.count}` : ""}`);
                return <button className={planIndex === selectedPlanIndex ? "active" : ""} key={planIndex} onClick={() => onSelectPlan(planIndex)}>
                  <span><i>仓库</i><b>{rootNames.join("＋") || "已有种源"}</b></span>
                  <span className={captures.length ? "needs-capture" : "owned-only"}><i>{captures.length ? "补抓" : "无需补抓"}</i><b>{captures.join("＋") || "全部已有"}</b></span>
                  <small><b>{formatNumber(planDifficultyScore(variant, completionTarget))}</b> 难度 · 可用约 {formatNumber(variant.usableExpectedEggs)} 蛋 · 完美约 {formatNumber(variant.perfectExpectedEggs)} 蛋{variant.bossCaptureCount ? " · 含 Boss" : ""}</small>
                  <em>{planIndex === selectedPlanIndex ? "已选择 ✓" : "查看详情"}</em>
                </button>;
              })}
            </div>
            {group.plans.length > variantOffsets.length && <small className="variant-remainder">另有 {(group.plans.length - variantOffsets.length).toLocaleString("zh-CN")} 条同类路线，已按综合难度排序。</small>}
          </div>
          {active && <PlanExecutionDetails result={plan} palById={palById} inventory={inventory} palLabel={palLabel} onOpenPal={onOpenPal} />}
        </article>;
      })}
    </div>
    {groups.length < totalGroups && <button className="show-more-methods" onClick={onShowMore}>继续查看后面的 {Math.min(METHODS_PER_BATCH, totalGroups - groups.length)} 种方法 ↓</button>}
  </section>;
}

function RoutePalButton({ pal, source, captureSource, sexLabel, passives, onOpenPal }: {
  pal?: Pal;
  source: "owned" | "captured" | "bred" | "result";
  captureSource?: CaptureSource;
  sexLabel?: string;
  passives?: string[];
  onOpenPal: (id: string) => void;
}) {
  const sourceLabel = source === "owned" ? `库存已有${sexLabel ? ` · ${sexLabel}` : ""}` : source === "captured" ? `补抓${sexLabel ? ` · ${sexLabel}` : ""} · ${captureSource ? captureRangeLabel(captureSource) : "等级未知"}` : source === "bred" ? `前序子代${sexLabel ? ` · ${sexLabel}` : ""}` : "本步产出";
  return <button className={`route-pal ${source}`} disabled={!pal} onClick={() => pal && onOpenPal(pal.id)} aria-label={pal ? `查看${pal.nameZh}图鉴` : "未知帕鲁"}>
    {pal?.image && <img src={pal.image} alt="" />}
    <span><small>{sourceLabel}</small><strong>{pal?.nameZh ?? "未知帕鲁"}</strong>{source === "result" && <em className={passives?.length ? "passive-hover" : ""} title={passives?.length ? passiveListEffect(passives) : undefined} data-passive-effect={passives?.length ? passiveListEffect(passives) : undefined}>{passives?.length ? passives.join(" · ") : "无指定词条"}</em>}</span>
  </button>;
}

function PlanExecutionDetails({ result, palById, inventory, palLabel, onOpenPal }: { result: PlanResult; palById: Map<string, Pal>; inventory: InventoryPal[]; palLabel: (id: string) => string; onOpenPal: (id: string) => void }) {
  const inventoryById = new Map(inventory.map((item) => [item.id, item]));
  const stepById = new Map(result.steps.map((step) => [step.id, step]));
  return <section className="plan-details inline-plan-details" id="steps">
    <div className="inline-details-title"><div><b>完整操作</b><span>已在当前方法内展开，无需翻到页面底部</span></div><small>{result.steps.length} 步 · {result.newCaptureCount} 补抓 · 可用约 {formatNumber(result.usableExpectedEggs)} 蛋 · 完美约 {formatNumber(result.perfectExpectedEggs)} 蛋</small></div>
    {result.missingPassives.length > 0 && <div className="warning-box"><b>还有词条种源缺口</b><span>{result.missingPassives.join("、")} 未在当前库存的可达链中。路线会先给出最接近结果；若想稳定遗传，请先抓到携带这些词条的帕鲁。</span></div>}
    {result.captures.length > 0 && <div className="capture-checklist">
      <div className="capture-title"><span>出发前补抓</span><h3>这条路线需要先获得 {result.captures.reduce((sum, item) => sum + item.count, 0)} 只野外种源</h3><p>请对照下方常见等级判断当前是否适合捕捉；点击任意卡片可打开内置栖息地图。</p></div>
      <div className="capture-cards">{result.captures.map((requirement) => {
        const capturePal = palById.get(requirement.palId);
        const requiredSex = captureSexRequirement(result, requirement.palId, inventoryById, stepById);
        return <button key={requirement.palId} className={requirement.kind === "alpha" ? "alpha-capture" : ""} onClick={() => onOpenPal(requirement.palId)} aria-label={`查看${capturePal?.nameZh ?? requirement.palId}图鉴与地图`}>
          {capturePal?.image && <img src={capturePal.image} alt="" />}
          <div><strong>{capturePal?.nameZh ?? requirement.palId}<em>{requiredSex}</em></strong><small>{captureRangeLabel(requirement)} · 需要 {requirement.count} 只</small></div>
          <i>↗</i>
        </button>;
      })}</div>
    </div>}
    {!result.steps.length ? <div className="owned-result">{result.source === "captured" ? <><b>无需配种：</b>直接捕捉 {palById.get(result.node.palId)?.nameZh ?? result.node.palId} 即可。<button onClick={() => onOpenPal(result.node.palId)}>打开栖息地图</button></> : "✓ 目标已经在你的库存中，不需要额外配种。"}</div> : <div className="step-list">
      {result.steps.map((step) => {
        const child = palById.get(step.childId);
        const a = palById.get(step.parentA.palId);
        const b = palById.get(step.parentB.palId);
        return <article className="plan-step" key={step.id}>
          <div className="step-index"><small>STEP</small><strong>{String(step.index).padStart(2, "0")}</strong></div>
          <div className="step-content">
            <div className="step-breed">
              <ParentChip pal={a} parent={step.parentA} gender={effectiveParentSex(step, "A", inventoryById, stepById)} onOpenPal={onOpenPal} />
              <span className="breed-plus">＋</span>
              <ParentChip pal={b} parent={step.parentB} gender={effectiveParentSex(step, "B", inventoryById, stepById)} onOpenPal={onOpenPal} />
              <span className="breed-arrow">→</span>
              <button className="child-chip" onClick={() => onOpenPal(step.childId)} aria-label={`查看${child?.nameZh ?? step.childId}图鉴`}>{child?.image && <img src={child.image} alt="" />}<span><small>目标子代 · 点击看图鉴</small><strong>{child?.nameZh ?? step.childId}</strong><em className={step.inheritedPassives.length ? "passive-hover" : ""} title={step.inheritedPassives.length ? passiveListEffect(step.inheritedPassives) : undefined} data-passive-effect={step.inheritedPassives.length ? passiveListEffect(step.inheritedPassives) : undefined}>{step.inheritedPassives.length ? `目标词条：${step.inheritedPassives.join(" · ")}` : "无指定词条"}</em></span></button>
            </div>
            <div className="step-instructions">
              <p><b>你要做：</b>把 {palLabel(step.parentA.palId)} 与 {palLabel(step.parentB.palId)} 放入配种牧场，使用普通蛋糕；孵化后保留<strong>{step.inheritedPassives.length ? `至少带有 ${step.inheritedPassives.join("、")}` : step.sexRequirement ? `性别为${sexRequirementLabel(step.sexRequirement)}` : "符合后续要求"}{step.inheritedPassives.length && step.sexRequirement ? `、性别为${sexRequirementLabel(step.sexRequirement)}` : ""}</strong>的 {child?.nameZh}。</p>
              <div><span>可用预计 <b>{formatNumber(step.usableExpectedEggs)}</b> 枚蛋</span><span>完美预计 <b>{formatNumber(step.perfectExpectedEggs)}</b> 枚蛋</span>{step.duplicateAction === "breed" && <span className="duplicate-note">需额外孵化一只异性副本</span>}{step.duplicateAction === "catch" && <span className="duplicate-note">需捕捉一雄一雌两只</span>}</div>
            </div>
          </div>
        </article>;
      })}
    </div>}
  </section>;
}

function ParentChip({ pal, parent, gender, onOpenPal }: { pal?: Pal; parent: { source: "owned" | "captured" | "bred"; nickname?: string; passives: string[]; extraPassiveCount: number; captureSource?: CaptureSource }; gender: string; onOpenPal: (id: string) => void }) {
  const sourceLabel = parent.source === "owned" ? "库存个体" : parent.source === "captured" ? "途中补抓" : "上一步子代";
  const effect = parent.passives.length ? passiveListEffect(parent.passives) : undefined;
  return <button className={`parent-chip ${parent.source === "captured" ? "captured" : ""}`} disabled={!pal} onClick={() => pal && onOpenPal(pal.id)} aria-label={pal ? `查看${pal.nameZh}图鉴` : "未知帕鲁"}>{pal?.image && <img src={pal.image} alt="" />}<span><small>{sourceLabel} · {gender || "需异性配对"} · 点击看图鉴</small><strong>{pal?.nameZh ?? "未知帕鲁"}</strong><em className={effect ? "passive-hover" : ""} title={effect} data-passive-effect={effect}>{parent.passives.join(" · ") || parent.nickname || (parent.captureSource ? captureRangeLabel(parent.captureSource) : "无指定词条")}</em></span></button>;
}
