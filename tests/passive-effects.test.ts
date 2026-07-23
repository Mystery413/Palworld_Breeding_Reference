import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PASSIVE_EFFECTS, passiveEffect } from "../lib/passive-effects.ts";

test("1.0 完整词条库都有可悬浮展示的具体效果", async () => {
  const data = JSON.parse(await readFile(new URL("../public/data/runtime/planner-core.json", import.meta.url), "utf8")) as { passives: string[] };
  const missing = data.passives.filter((passive) => !PASSIVE_EFFECTS[passive]?.trim());
  assert.deepEqual(missing, []);
  assert.match(passiveEffect("卓绝技艺"), /工作速度 \+75%/);
  assert.match(passiveEffect("未收录测试词条"), /暂无效果说明/);
});
