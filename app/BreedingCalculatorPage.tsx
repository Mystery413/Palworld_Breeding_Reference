"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import type { BreedingCalculatorMatch, BreedingData, Pal } from "@/lib/planner";
import { filterBreedingCombos, selfBreedingOnlyCombo } from "@/lib/planner";
import { loadBreedingData } from "@/lib/supabase-data";
import { calculatorPalOptions, compareCalculatorPals } from "@/lib/calculator-pal-options";
import { PalDetailModal } from "./PalDetailModal";
import { ToolHeader } from "./ToolHeader";

const RESULT_BATCH = 100;

function PalCombobox({ label, value, pals, onChange }: { label: string; value: string; pals: Pal[]; onChange: (id: string) => void }) {
  const selected = pals.find((pal) => pal.id === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const options = useMemo(() => calculatorPalOptions(pals, query), [pals, query]);
  const text = open ? query : selected ? `${selected.nameZh} · No.${selected.dex}` : query;

  return <label className="formula-combobox">
    <span>{label}</span>
    <div className={open ? "open" : ""}>
      <input value={text} onFocus={() => { setQuery(selected ? selected.nameZh : query); setOpen(true); }} onBlur={() => window.setTimeout(() => setOpen(false), 120)} onChange={(event) => { setQuery(event.target.value); onChange(""); setOpen(true); }} placeholder="任意帕鲁 · 模糊搜索" autoComplete="off" />
      {(value || query) && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(""); setQuery(""); setOpen(false); }} aria-label={`清除${label}`}>×</button>}
      {open && <div className="formula-options">
        {options.map((pal) => <button type="button" key={pal.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(pal.id); setQuery(pal.nameZh); setOpen(false); }}>
          <img src={pal.image} alt="" loading="lazy" decoding="async" /><span><b>{pal.nameZh}</b><small>No.{pal.dex} · {pal.name}</small></span>
        </button>)}
        {!options.length && <p>没有匹配帕鲁，请换个名称或编号。</p>}
      </div>}
    </div>
  </label>;
}

function genderText(value: BreedingCalculatorMatch["parentASex"]): string {
  if (value === "MALE") return "限定雄性";
  if (value === "FEMALE") return "限定雌性";
  return "";
}

function wildLevel(pal?: Pal): string {
  const habitat = pal?.habitat;
  const min = habitat?.commonWildMinLevel ?? habitat?.wildMinLevel;
  const max = habitat?.commonWildMaxLevel ?? habitat?.wildMaxLevel;
  if (min == null) return "无普通野生";
  return max != null && max > min ? `野生 Lv.${min}–${max}` : `野生 Lv.${min}`;
}

function commonWildMinLevel(pal?: Pal): number {
  return pal?.habitat?.commonWildMinLevel ?? pal?.habitat?.wildMinLevel ?? Number.POSITIVE_INFINITY;
}

function FormulaPal({ pal, sex, child, onOpen }: { pal?: Pal; sex?: BreedingCalculatorMatch["parentASex"]; child?: boolean; onOpen: () => void }) {
  return <button className={child ? "formula-pal child" : "formula-pal"} onClick={onOpen} disabled={!pal}>
    {pal?.image && <img src={pal.image} alt="" loading="lazy" decoding="async" />}
    <span><b>{pal?.nameZh ?? "未知帕鲁"}</b><small>No.{pal?.dex ?? "—"} · {wildLevel(pal)}</small>{sex && genderText(sex) && <em>{genderText(sex)}</em>}</span>
  </button>;
}

export default function BreedingCalculatorPage() {
  const [data, setData] = useState<BreedingData | null>(null);
  const [parentAId, setParentAId] = useState("");
  const [parentBId, setParentBId] = useState("");
  const [childId, setChildId] = useState("");
  const [visibleCount, setVisibleCount] = useState(RESULT_BATCH);
  const [detailPalId, setDetailPalId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadBreedingData().then(setData).catch(() => setError("配方数据加载失败，请刷新页面重试。"));
  }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && setDetailPalId("");
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const pals = useMemo(() => [...(data?.pals ?? [])].sort(compareCalculatorPals), [data]);
  const palById = useMemo(() => new Map(pals.map((pal) => [pal.id, pal])), [pals]);
  const matches = useMemo(() => data ? filterBreedingCombos(data, { parentAId, parentBId, childId })
    .sort((left, right) => {
      const leftLevels = [commonWildMinLevel(palById.get(left.parentAId)), commonWildMinLevel(palById.get(left.parentBId))];
      const rightLevels = [commonWildMinLevel(palById.get(right.parentAId)), commonWildMinLevel(palById.get(right.parentBId))];
      const unavailable = leftLevels.filter((level) => !Number.isFinite(level)).length - rightLevels.filter((level) => !Number.isFinite(level)).length;
      if (unavailable) return unavailable;
      const levelCost = leftLevels.reduce((sum, level) => sum + (Number.isFinite(level) ? level : 999), 0) - rightLevels.reduce((sum, level) => sum + (Number.isFinite(level) ? level : 999), 0);
      if (levelCost) return levelCost;
      const idsLeft = [left.parentAId, left.parentBId, left.childId].map((id) => palById.get(id)?.dex ?? id).join("|");
      const idsRight = [right.parentAId, right.parentBId, right.childId].map((id) => palById.get(id)?.dex ?? id).join("|");
      return idsLeft.localeCompare(idsRight, "zh-CN", { numeric: true });
    }) : [], [data, parentAId, parentBId, childId, palById]);
  const selfOnly = useMemo(() => data && childId ? selfBreedingOnlyCombo(data, childId) : null, [data, childId]);
  const hasFilter = Boolean(parentAId || parentBId || childId);
  const visibleMatches = matches.slice(0, visibleCount);
  const detailPal = palById.get(detailPalId);

  return <main className="app-shell tool-page-shell calculator-page-shell">
    <ToolHeader active="calculator" />
    <section className="tool-page-hero compact">
      <p>BREEDING FORMULA · 1.0</p>
      <h1>帕鲁配种计算器</h1>
      <span>三个框没有模式限制。任选一个、两个或三个条件，页面都会立即列出所有符合的 A ＋ B ＝ C。</span>
    </section>
    <section className="calculator-page-content">
      <div className="formula-builder">
        <PalCombobox key={`a-${parentAId}`} label="亲代 A" value={parentAId} pals={pals} onChange={(id) => { setParentAId(id); setVisibleCount(RESULT_BATCH); }} /><b>＋</b>
        <PalCombobox key={`b-${parentBId}`} label="亲代 B" value={parentBId} pals={pals} onChange={(id) => { setParentBId(id); setVisibleCount(RESULT_BATCH); }} /><b>＝</b>
        <PalCombobox key={`c-${childId}`} label="子代 C" value={childId} pals={pals} onChange={(id) => { setChildId(id); setVisibleCount(RESULT_BATCH); }} />
      </div>
      <div className="formula-summary">
        <span>{hasFilter ? <>找到 <b>{matches.length.toLocaleString("zh-CN")}</b> 个配种公式</> : "先在任意一个框里选择帕鲁"}</span>
        <small>亲代遵守交换律：A＋B 与 B＋A 会得到同一结果，性别限定也会随位置正确交换。</small>
        {hasFilter && <button onClick={() => { setParentAId(""); setParentBId(""); setChildId(""); setVisibleCount(RESULT_BATCH); }}>清除全部</button>}
      </div>
      {selfOnly && <div className="self-breeding-notice compact">
        <span>同种限定</span>
        <div><strong>{palById.get(childId)?.nameZh} 仅能通过同种配种获得</strong><small>配种表中没有其他亲代组合：准备一雄一雌两只 {palById.get(childId)?.nameZh}，即可直接自交，不需要计算多代路径。</small></div>
      </div>}
      {error ? <div className="tool-error">{error}</div> : !data ? <div className="tool-loading"><i />正在加载 1.0 配方表…</div> : !hasFilter ? <div className="formula-empty"><span>A</span><i>＋</i><span>B</span><i>＝</i><span>C</span><p>例如只选“子代 C”，就能查看它的全部配方；选择“亲代 B＋子代 C”，也能反查另一个亲代。</p></div> : matches.length ? <>
        <div className="formula-grid" role="list">
          {visibleMatches.map((match) => <article className="formula-row" role="listitem" key={`${match.parentAId}|${match.parentBId}|${match.childId}|${match.parentASex}|${match.parentBSex}`}>
            <FormulaPal pal={palById.get(match.parentAId)} sex={match.parentASex} onOpen={() => setDetailPalId(match.parentAId)} /><i>＋</i>
            <FormulaPal pal={palById.get(match.parentBId)} sex={match.parentBSex} onOpen={() => setDetailPalId(match.parentBId)} /><i>＝</i>
            <FormulaPal pal={palById.get(match.childId)} child onOpen={() => setDetailPalId(match.childId)} />
          </article>)}
        </div>
        {visibleMatches.length < matches.length && <button className="standalone-load-more" onClick={() => setVisibleCount((count) => count + RESULT_BATCH)}>继续显示 {Math.min(RESULT_BATCH, matches.length - visibleMatches.length)} 个公式</button>}
      </> : <div className="formula-empty no-result"><b>没有符合条件的配方</b><p>可以清除一个条件，逐步确认是哪一项限制了结果。</p></div>}
    </section>
    {detailPal && <PalDetailModal key={detailPal.id} pal={detailPal} onClose={() => setDetailPalId("")} />}
  </main>;
}
