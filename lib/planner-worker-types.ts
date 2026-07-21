import type { BreedingData, CaptureSource, InventoryPal, PlanResult, Profile, Recommendation } from "./planner";

export type PlannerWorkerRequest = {
  requestId: number;
  data?: BreedingData;
  inventory: InventoryPal[];
  desiredPassives: string[];
  captureSources: CaptureSource[];
  maxGenerations: number;
  mode: "recommend" | "exact";
  profile: Profile;
  targetPalId: string;
};

export type PlannerWorkerResponse = {
  requestId: number;
  recommendations: Recommendation[];
  exactPlans: PlanResult[];
  summary: { reachablePals: number; fullTraitPals: number };
  durationMs: number;
  error?: string;
};
