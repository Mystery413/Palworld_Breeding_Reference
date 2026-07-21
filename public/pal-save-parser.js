const decoder = new TextDecoder();

class Reader {
  constructor(bytes) {
    this.bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this.view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
    this.offset = 0;
  }

  ensure(length) {
    if (this.offset + length > this.bytes.length) throw new Error("存档字段不完整");
  }

  u8() { this.ensure(1); return this.view.getUint8(this.offset++); }
  u16() { this.ensure(2); const value = this.view.getUint16(this.offset, true); this.offset += 2; return value; }
  i32() { this.ensure(4); const value = this.view.getInt32(this.offset, true); this.offset += 4; return value; }
  u32() { this.ensure(4); const value = this.view.getUint32(this.offset, true); this.offset += 4; return value; }
  i64() { this.ensure(8); const value = Number(this.view.getBigInt64(this.offset, true)); this.offset += 8; return value; }
  u64() { this.ensure(8); const value = Number(this.view.getBigUint64(this.offset, true)); this.offset += 8; return value; }
  f32() { this.ensure(4); const value = this.view.getFloat32(this.offset, true); this.offset += 4; return value; }
  take(length) { this.ensure(length); const value = this.bytes.subarray(this.offset, this.offset + length); this.offset += length; return value; }

  fstring() {
    const length = this.i32();
    if (length === 0) return "";
    if (length < 0) {
      const bytes = this.take((-length) * 2 - 2);
      this.take(2);
      return new TextDecoder("utf-16le").decode(bytes);
    }
    const bytes = this.take(length - 1);
    this.take(1);
    return decoder.decode(bytes);
  }

  guid() {
    const bytes = this.take(16);
    const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  optionalGuid() { return this.u8() ? this.guid() : null; }
}

function readProperties(reader) {
  const result = {};
  while (reader.offset < reader.bytes.length) {
    const name = reader.fstring();
    if (name === "None") break;
    const type = reader.fstring();
    const size = reader.u64();
    try {
      result[name] = readPropertyValue(reader, type, size);
    } catch (error) {
      throw new Error(`${name}/${type}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return result;
}

function readPropertyValue(reader, type, size) {
  if (type === "BoolProperty") {
    const value = reader.u8() !== 0;
    reader.optionalGuid();
    return value;
  }

  if (type === "StructProperty") {
    const structType = reader.fstring();
    reader.guid();
    reader.optionalGuid();
    const end = reader.offset + size;
    let value;
    if (structType === "Guid") value = reader.guid();
    else if (structType === "DateTime") value = reader.u64();
    else if (["PalIndividualCharacterSaveParameter", "StructProperty"].includes(structType)) value = readProperties(reader);
    else value = reader.take(size);
    reader.offset = end;
    return value;
  }

  if (type === "EnumProperty") {
    reader.fstring();
    reader.optionalGuid();
    return reader.fstring();
  }

  if (type === "ByteProperty") {
    const enumType = reader.fstring();
    reader.optionalGuid();
    return enumType === "None" ? reader.u8() : reader.fstring();
  }

  if (type === "ArrayProperty") {
    const innerType = reader.fstring();
    reader.optionalGuid();
    const end = reader.offset + size;
    const count = reader.u32();
    let value;
    if (innerType === "ByteProperty") value = reader.take(count);
    else if (["NameProperty", "StrProperty", "EnumProperty"].includes(innerType)) value = Array.from({ length: count }, () => reader.fstring());
    else value = [];
    reader.offset = end;
    return value;
  }

  reader.optionalGuid();
  const end = reader.offset + size;
  let value;
  if (type === "IntProperty") value = reader.i32();
  else if (type === "UInt16Property") value = reader.u16();
  else if (type === "UInt32Property") value = reader.u32();
  else if (type === "UInt64Property") value = reader.u64();
  else if (type === "Int64Property" || type === "FixedPoint64Property") value = reader.i64();
  else if (type === "FloatProperty") value = reader.f32();
  else if (type === "StrProperty" || type === "NameProperty") value = reader.fstring();
  else value = reader.take(size);
  reader.offset = end;
  return value;
}

function findCharacterMapBytes(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith("CharacterSaveParameterMap") && Array.isArray(child) && child.every((item) => Number.isInteger(item))) return new Uint8Array(child);
  }
  for (const child of Object.values(value)) {
    const found = findCharacterMapBytes(child, seen);
    if (found) return found;
  }
  return null;
}

function normalizeGender(value) {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("female")) return "F";
  if (text.includes("male")) return "M";
  return null;
}

function stripCharacterPrefix(asset) {
  return String(asset ?? "").replace(/^(?:BOSS_|RAID_|PREDATOR_|GYM_|SUMMON_)+/g, "");
}

export function parseCharacterMap(bytes, index) {
  const reader = new Reader(bytes);
  reader.u32();
  const count = reader.u32();
  if (count > 100000) throw new Error("存档中的角色数量异常");
  const pals = [];
  const unknownSpecies = new Set();
  const unknownPassives = new Set();

  for (let entryIndex = 0; entryIndex < count; entryIndex += 1) {
    const key = readProperties(reader);
    const value = readProperties(reader);
    const raw = value.RawData;
    if (!(raw instanceof Uint8Array)) continue;
    const decoded = readProperties(new Reader(raw));
    const save = decoded.SaveParameter ?? decoded;
    if (save.IsPlayer) continue;
    const rawAsset = String(save.CharacterID ?? value.DebugName ?? "");
    const asset = stripCharacterPrefix(rawAsset);
    const palId = index.pals[rawAsset] ?? index.pals[asset];
    if (!palId) {
      if (rawAsset) unknownSpecies.add(rawAsset);
      continue;
    }
    const passiveAssets = Array.isArray(save.PassiveSkillList) ? save.PassiveSkillList : [];
    const passives = passiveAssets.map((passive) => {
      const translated = index.passives[passive];
      if (!translated) unknownPassives.add(passive);
      return translated ?? passive;
    });
    const elitePassives = passiveAssets
      .filter((passive) => Number(index.passiveRanks?.[passive] ?? 0) >= 4)
      .map((passive) => index.passives[passive] ?? passive);
    const sex = normalizeGender(save.Gender);
    if (!sex) continue;
    pals.push({
      id: `save-${key.InstanceId ?? value.InstanceId ?? entryIndex}`,
      palId,
      sex,
      passives: [...new Set(passives)],
      elitePassives: [...new Set(elitePassives)],
      hp: Number.isFinite(save.Talent_HP) ? save.Talent_HP : null,
      attack: Number.isFinite(save.Talent_Shot) ? save.Talent_Shot : null,
      defense: Number.isFinite(save.Talent_Defense) ? save.Talent_Defense : null,
      nickname: typeof save.NickName === "string" ? save.NickName : "",
      ownerUid: String(save.OwnerPlayerUId ?? "未标记玩家"),
      level: Number.isFinite(save.Level) ? save.Level : null,
    });
  }

  return { pals, totalCharacters: count, unknownSpecies: [...unknownSpecies], unknownPassives: [...unknownPassives] };
}

export function parseUesaveJson(json, index) {
  const root = typeof json === "string" ? JSON.parse(json) : json;
  const bytes = findCharacterMapBytes(root);
  if (!bytes) throw new Error("没有在 Level.sav 中找到帕鲁角色表");
  return parseCharacterMap(bytes, index);
}
