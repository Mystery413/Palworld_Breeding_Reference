import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { calculatorPalOptions } from "../lib/calculator-pal-options.ts";
import type { BreedingData } from "../lib/planner.ts";

test("配种计算器空搜索返回完整帕鲁目录而不是前十几项", async () => {
  const data = JSON.parse(await readFile(new URL("../public/data/runtime/planner-core.json", import.meta.url), "utf8")) as BreedingData;
  const options = calculatorPalOptions(data.pals, "");
  assert.equal(options.length, data.pals.length);
  assert.ok(options.length > 250);
  assert.equal(new Set(options.map((pal) => pal.id)).size, data.pals.length);
});
