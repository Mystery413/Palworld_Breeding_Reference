import type { InventoryPal } from "./planner.ts";

export type SaveImportedPal = InventoryPal & {
  ownerUid: string;
  level: number | null;
  elitePassives: string[];
};

export function filterSaveImportedPals(items: SaveImportedPal[], eliteOnly: boolean): SaveImportedPal[] {
  return eliteOnly ? items.filter((item) => item.elitePassives.length > 0) : items;
}
