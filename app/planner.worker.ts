/// <reference lib="webworker" />

import {
  findTargetPlans,
  searchBreedingPlans,
  summarizeSearch,
  type PlanResult,
  type BreedingData,
  type Recommendation,
} from "@/lib/planner";
import type { PlannerWorkerRequest, PlannerWorkerResponse } from "@/lib/planner-worker-types";

const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
let breedingData: BreedingData | null = null;

function transferablePlan<T extends PlanResult>(plan: T): T {
  // The UI only needs the final species id from node. Removing recursive parent
  // nodes prevents the entire search tree from being cloned back to the page.
  return { ...plan, node: { palId: plan.node.palId } } as T;
}

workerScope.onmessage = (event: MessageEvent<PlannerWorkerRequest>) => {
  const request = event.data;
  const started = performance.now();
  try {
    if (request.data) breedingData = request.data;
    if (!breedingData) throw new Error("配种图谱尚未载入");
    const search = searchBreedingPlans(breedingData, request.inventory, request.desiredPassives, {
      maxGenerations: request.maxGenerations,
      maxBreedingSteps: 12,
      captureSources: request.captureSources,
      targetPalId: request.targetPalId,
    });
    const recommendations: Recommendation[] = [];
    const planLimit = Math.max(50, Math.min(500, request.planLimit ?? 240));
    const exactPlanCandidates: PlanResult[] = request.targetPalId
      ? findTargetPlans(search, request.targetPalId, {
          requireOwnedAncestry: request.mode === "exact",
          requireFullPassives: true,
        }, planLimit + 1).map(transferablePlan)
      : [];
    const routesTruncated = exactPlanCandidates.length > planLimit;
    const exactPlans = exactPlanCandidates.slice(0, planLimit);
    const response: PlannerWorkerResponse = {
      requestId: request.requestId,
      recommendations,
      exactPlans,
      summary: summarizeSearch(search),
      durationMs: Math.round(performance.now() - started),
      routesTruncated,
      searchTruncated: search.truncated,
    };
    workerScope.postMessage(response);
  } catch (error) {
    workerScope.postMessage({
      requestId: request.requestId,
      recommendations: [],
      exactPlans: [],
      summary: { reachablePals: 0, fullTraitPals: 0 },
      durationMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : "路线计算失败",
    } satisfies PlannerWorkerResponse);
  }
};

export {};
