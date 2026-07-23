import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GRADUATE_PRESETS,
  GRADUATE_PRESET_GROUPS,
  graduatePassiveAlternativesFor,
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

test("每个据点工种都有有效的游戏图标和至少三个可点击替代词条", async () => {
  const data = JSON.parse(await readFile(new URL("../public/data/runtime/planner-core.json", import.meta.url), "utf8")) as RuntimeData;
  const passives = new Set(data.passives);
  for (const preset of GRADUATE_PRESETS.filter((item) => item.group === "base")) {
    assert.match(preset.workIcon ?? "", /^\d{2}$/, `${preset.title} 缺少工作适应性图标`);
    await readFile(new URL(`../public/data/work-icons/${preset.workIcon}.webp`, import.meta.url));
    for (const candidate of preset.candidates) {
      const selected = graduatePassivesFor(preset, candidate.palId);
      const alternatives = graduatePassiveAlternativesFor(preset, candidate.palId);
      assert.ok(alternatives.length >= 3, `${preset.title} 应提供至少三个替代词条`);
      for (const alternative of alternatives) {
        assert.ok(selected.includes(alternative.replaces), `${preset.title} 的替代目标 ${alternative.replaces} 不在毕业词条内`);
        assert.ok(passives.has(alternative.passive), `${preset.title} 使用了未知替代词条 ${alternative.passive}`);
        assert.ok(alternative.note.length >= 8, `${preset.title} 的替代说明过短`);
      }
    }
  }
});
