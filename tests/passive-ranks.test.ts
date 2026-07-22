import assert from "node:assert/strict";
import test from "node:test";
import { bundledPassiveRanks, normalizePassiveName, passiveRankOf } from "../lib/passive-ranks.ts";

test("bundled ranks are available before the large planner file loads", () => {
  assert.equal(passiveRankOf("极限绝食", {}), 4);
  assert.equal(passiveRankOf("凶猛", {}), 3);
  assert.equal(passiveRankOf("永动机", {}), 4);
});

test("passive names tolerate save whitespace and invisible characters", () => {
  assert.equal(normalizePassiveName(" 神\u200B速 "), "神速");
  assert.equal(passiveRankOf(" 神\u200B速 ", bundledPassiveRanks), 4);
});

test("an actually unknown passive remains unranked", () => {
  assert.equal(passiveRankOf("玩家自己输入的词条", bundledPassiveRanks), undefined);
});
