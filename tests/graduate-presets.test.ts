import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GRADUATE_PRESETS,
  GRADUATE_PRESET_GROUPS,
  graduatePassivesFor,
} from "../lib/graduate-presets.ts";

type RuntimeData = {
  pals: Array<{ id: string }>;
  passives: string[];
};

test("毕业方案完整覆盖指南中的 18 个分类", () => {
  assert.equal(GRADUATE_PRESETS.length, 18);
  assert.deepEqual(
    GRADUATE_PRESET_GROUPS.map((group) => GRADUATE_PRESETS.filter((preset) => preset.group === group.id).length),
    [12, 2, 4],
  );
  assert.equal(new Set(GRADUATE_PRESETS.map((preset) => preset.id)).size, GRADUATE_PRESETS.length);
  for (const preset of GRADUATE_PRESETS) {
    assert.ok(preset.candidates.length >= 5, `${preset.title} 应提供多个进度选择`);
  }
});

test("每个预设帕鲁与词条都能被当前 1.0 路线数据识别", async () => {
  const data = JSON.parse(await readFile(new URL("../public/data/runtime/planner-core.json", import.meta.url), "utf8")) as RuntimeData;
  const palIds = new Set(data.pals.map((pal) => pal.id));
  const passives = new Set(data.passives);
  for (const preset of GRADUATE_PRESETS) {
    for (const candidate of preset.candidates) {
      assert.ok(palIds.has(candidate.palId), `${preset.title} 包含未知帕鲁 ${candidate.palId}`);
      const selectedPassives = graduatePassivesFor(preset, candidate.palId);
      assert.equal(selectedPassives.length, 4, `${preset.title} ${candidate.palId} 应有四个默认词条`);
      assert.equal(new Set(selectedPassives).size, 4, `${preset.title} ${candidate.palId} 的默认词条不可重复`);
      for (const passive of selectedPassives) {
        assert.ok(passives.has(passive), `${preset.title} 使用了路线数据不认识的词条 ${passive}`);
      }
    }
  }
});

