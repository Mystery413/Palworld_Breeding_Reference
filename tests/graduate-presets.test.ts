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

test("探索坐骑使用 1.0 海陆空速度口径与毕业词条", () => {
  const flying = GRADUATE_PRESETS.find((preset) => preset.id === "flying");
  const ground = GRADUATE_PRESETS.find((preset) => preset.id === "ground");
  const water = GRADUATE_PRESETS.find((preset) => preset.id === "water-mount");

  assert.ok(flying);
  assert.ok(ground);
  assert.ok(water);
  assert.deepEqual(flying.defaultPassives, ["次元跳跃", "神速", "传说", "运动健将"]);
  assert.deepEqual(ground.defaultPassives, ["次元跳跃", "神速", "传说", "运动健将"]);
  assert.deepEqual(water.defaultPassives, ["次元跳跃", "破浪王者", "游泳健将", "神速"]);

  const ranked = (preset: typeof flying) =>
    preset.candidates.map(({ palId, rank, stats }) => [rank, palId, Number(stats.match(/冲刺 (\d+)/)?.[1])]);

  assert.deepEqual(ranked(flying), [
    [1, "202:0", 3300], [2, "203:0", 3000], [3, "192:0", 2800], [4, "171:0", 2750], [5, "171:1", 2750],
    [6, "196:0", 2700], [7, "200:0", 1800], [8, "200:1", 1800], [9, "189:0", 1600], [10, "190:0", 1600],
    [11, "124:0", 1400], [12, "124:1", 1400], [13, "188:0", 1400], [14, "188:1", 1400], [15, "177:0", 1350],
  ]);
  assert.deepEqual(ranked(ground), [
    [1, "197:0", 1900], [2, "199:0", 1900], [3, "198:0", 1800], [4, "175:0", 1500], [5, "93:0", 1300],
    [6, "93:1", 1300], [7, "161:0", 1260], [8, "154:0", 1260], [9, "130:0", 1250], [10, "130:1", 1250],
    [11, "123:0", 1200], [12, "112:0", 1200], [13, "112:1", 1200], [14, "146:0", 1200], [15, "137:0", 1200],
  ]);
  assert.deepEqual(ranked(water), [
    [1, "201:0", 2000], [2, "103:0", 1890], [3, "121:0", 1800], [4, "75:0", 1440], [5, "63:1", 1440],
    [6, "97:0", 1350], [7, "97:1", 1350], [8, "169:0", 1300], [9, "169:1", 1300], [10, "41:0", 1000],
    [11, "41:1", 1000], [12, "151:0", 950], [13, "151:1", 950],
  ]);
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
