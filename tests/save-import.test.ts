import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
// The browser parser is deliberately plain ESM so the Web Worker and Node tests share it.
import { parseCharacterMap, parseUesaveJson } from "../public/pal-save-parser.js";
import { filterSaveImportedPals } from "../lib/save-import.ts";
import type { SaveImportedPal } from "../lib/save-import.ts";

const join = (...chunks: Uint8Array[]) => {
  const output = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
};
const i32 = (value: number) => { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setInt32(0, value, true); return bytes; };
const u64 = (value: number) => { const bytes = new Uint8Array(8); new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true); return bytes; };
const fstring = (value: string) => { const text = new TextEncoder().encode(value); return join(i32(text.length + 1), text, new Uint8Array([0])); };
const guid = (seed: number) => new Uint8Array(16).fill(seed);
const property = (name: string, type: string, payload: Uint8Array, metadata = new Uint8Array([0])) => join(fstring(name), fstring(type), u64(payload.length), metadata, payload);
const properties = (...items: Uint8Array[]) => join(...items, fstring("None"));
const guidProperty = (name: string, value: Uint8Array) => property(name, "StructProperty", value, join(fstring("Guid"), new Uint8Array(16), new Uint8Array([0])));
const nameProperty = (name: string, value: string) => property(name, "NameProperty", fstring(value));
const stringProperty = (name: string, value: string) => property(name, "StrProperty", fstring(value));
const intProperty = (name: string, value: number) => property(name, "IntProperty", i32(value));
const boolProperty = (name: string, value: boolean) => join(fstring(name), fstring("BoolProperty"), u64(0), new Uint8Array([value ? 1 : 0, 0]));
const enumProperty = (name: string, value: string) => property(name, "EnumProperty", fstring(value), join(fstring("EPalGenderType"), new Uint8Array([0])));
const nameArray = (name: string, values: string[]) => property(name, "ArrayProperty", join(i32(values.length), ...values.map(fstring)), join(fstring("NameProperty"), new Uint8Array([0])));
const byteArray = (name: string, value: Uint8Array) => property(name, "ArrayProperty", join(i32(value.length), value), join(fstring("ByteProperty"), new Uint8Array([0])));

test("Level.sav 角色表可提取物种、性别、中文词条和三项潜力", () => {
  const saveParameter = properties(
    boolProperty("IsPlayer", false),
    nameProperty("CharacterID", "SheepBall"),
    stringProperty("NickName", "育种一号"),
    intProperty("Level", 42),
    enumProperty("Gender", "EPalGenderType::Male"),
    intProperty("Talent_HP", 91),
    intProperty("Talent_Shot", 87),
    intProperty("Talent_Defense", 76),
    nameArray("PassiveSkillList", ["MoveSpeed_up_3", "Legend"]),
    guidProperty("OwnerPlayerUId", guid(3)),
  );
  const wrapped = property("SaveParameter", "StructProperty", saveParameter, join(fstring("PalIndividualCharacterSaveParameter"), new Uint8Array(16), new Uint8Array([0])));
  const map = join(
    i32(0), i32(1),
    properties(guidProperty("InstanceId", guid(7))),
    properties(byteArray("RawData", wrapped)),
  );
  const result = parseCharacterMap(map, { pals: { SheepBall: "1:0" }, passives: { MoveSpeed_up_3: "神速", Legend: "传说" }, passiveRanks: { MoveSpeed_up_3: 4, Legend: 4 } });
  assert.equal(result.pals.length, 1);
  assert.deepEqual(result.pals[0], {
    id: "save-07070707-0707-0707-0707-070707070707",
    palId: "1:0",
    sex: "M",
    passives: ["神速", "传说"],
    elitePassives: ["神速", "传说"],
    hp: 91,
    attack: 87,
    defense: 76,
    nickname: "育种一号",
    ownerUid: "03030303-0303-0303-0303-030303030303",
    level: 42,
  });
  const imported = result.pals as SaveImportedPal[];
  assert.equal(filterSaveImportedPals(imported, true).length, 1);
  assert.equal(filterSaveImportedPals([{ ...imported[0], elitePassives: [] }], true).length, 0);
});

test("浏览器兼容的 Level.sav.json 夹具可走完整解析入口", async () => {
  const json = await readFile(new URL("./fixtures/Level.sav.json", import.meta.url), "utf8");
  const result = parseUesaveJson(json, { pals: { SheepBall: "1:0" }, passives: { MoveSpeed_up_3: "神速", Legend: "传说" }, passiveRanks: { MoveSpeed_up_3: 4, Legend: 4 } });
  assert.equal(result.pals.length, 1);
  assert.equal(result.pals[0].nickname, "浏览器验收");
  assert.deepEqual(result.pals[0].passives, ["神速", "传说"]);
});
