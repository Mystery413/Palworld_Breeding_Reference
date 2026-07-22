"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import type { BreedingData } from "@/lib/planner";
import { loadBreedingData } from "@/lib/supabase-data";
import { PalDetailModal } from "./PalDetailModal";
import { ToolHeader } from "./ToolHeader";

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("zh-CN").replaceAll(/\s+/g, "");
}

function fuzzyMatches(value: string, rawQuery: string): boolean {
  const haystack = normalize(value);
  const query = normalize(rawQuery);
  if (!query || haystack.includes(query)) return true;
  let cursor = 0;
  for (const char of haystack) if (char === query[cursor]) cursor += 1;
  return cursor === query.length;
}

function compareDex(left: BreedingData["pals"][number], right: BreedingData["pals"][number]): number {
  if (left.dex === "-" && right.dex !== "-") return 1;
  if (right.dex === "-" && left.dex !== "-") return -1;
  return left.dex.localeCompare(right.dex, "zh-CN", { numeric: true });
}

export default function PaldexPage() {
  const [data, setData] = useState<BreedingData | null>(null);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(60);
  const [detailPalId, setDetailPalId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadBreedingData().then(setData).catch(() => setError("图鉴数据加载失败，请刷新页面重试。"));
  }, []);

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && setDetailPalId("");
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const pals = useMemo(() => (data?.pals ?? [])
    .filter((pal) => fuzzyMatches(`${pal.dex}${pal.nameZh}${pal.name}`, query))
    .sort(compareDex), [data, query]);
  const visiblePals = pals.slice(0, visibleCount);
  const detailPal = data?.pals.find((pal) => pal.id === detailPalId);

  return <main className="app-shell tool-page-shell">
    <ToolHeader active="paldex" />
    <section className="tool-page-hero">
      <p>PALDECK · ALL ENTRIES</p>
      <h1>完整帕鲁图鉴</h1>
      <span>独立浏览全部帕鲁；点击条目可查看属性、工作适应性、普通野生等级与栖息地图。</span>
    </section>
    <section className="paldex-page-content">
      <div className="paldex-page-tools">
        <label htmlFor="standalone-paldex-search"><span>搜索图鉴</span><input id="standalone-paldex-search" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(60); }} placeholder="输入中文名、英文名或图鉴编号，支持模糊匹配" autoFocus /></label>
        <span>匹配 <b>{pals.length}</b> / {data?.pals.length ?? 0} 个条目</span>
      </div>
      {error ? <div className="tool-error">{error}</div> : !data ? <div className="tool-loading"><i />正在加载图鉴数据…</div> : <>
        <div className="paldex-grid standalone" role="list">
          {visiblePals.map((pal) => <button key={pal.id} role="listitem" onClick={() => setDetailPalId(pal.id)}>
            <img src={pal.image} alt="" loading="lazy" decoding="async" />
            <span><small>No.{pal.dex}</small><strong>{pal.nameZh}</strong><em>{pal.name}</em></span>
            <i>查看图鉴 →</i>
          </button>)}
          {!pals.length && <div className="paldex-empty">没有找到匹配的帕鲁，请换一个名称或编号。</div>}
        </div>
        {visiblePals.length < pals.length && <button className="standalone-load-more" onClick={() => setVisibleCount((count) => count + 60)}>继续加载 {Math.min(60, pals.length - visiblePals.length)} 个条目</button>}
      </>}
    </section>
    {detailPal && <PalDetailModal key={detailPal.id} pal={detailPal} onClose={() => setDetailPalId("")} />}
  </main>;
}
