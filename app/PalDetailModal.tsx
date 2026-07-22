"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import type { Pal } from "@/lib/planner";
import { loadPalHabitatLocations } from "@/lib/supabase-data";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const WORK_COPY: Record<string, { label: string; icon: string; color: string }> = {
  Kindling: { label: "生火", icon: "🔥", color: "#db643f" },
  Watering: { label: "浇水", icon: "💧", color: "#4b9bd8" },
  Planting: { label: "播种", icon: "🌱", color: "#70a84b" },
  Electricity: { label: "发电", icon: "⚡", color: "#d4a62e" },
  Handiwork: { label: "手工作业", icon: "🛠", color: "#c28347" },
  Gathering: { label: "采集", icon: "🌾", color: "#97a543" },
  Lumbering: { label: "伐木", icon: "🪵", color: "#8f6546" },
  Mining: { label: "采矿", icon: "⛏", color: "#687686" },
  Production: { label: "制药", icon: "🧪", color: "#a06bb1" },
  Cooling: { label: "冷却", icon: "❄", color: "#62aaca" },
  Transporting: { label: "搬运", icon: "📦", color: "#a97954" },
  Farming: { label: "牧场", icon: "🐾", color: "#d18a9d" },
};

const MAP_BOUNDS = {
  palpagos: { minX: -1099400, minY: -724400, maxX: 349400, maxY: 724400 },
  worldTree: { minX: 347351.5, minY: -818197, maxX: 689148.5, maxY: -476400 },
};

export function PalDetailModal({ pal, onClose }: { pal: Pal; onClose: () => void }) {
  const habitat = pal.habitat;
  const [loadedLocations, setLoadedLocations] = useState(habitat?.locations ?? []);
  const [locationsLoading, setLocationsLoading] = useState(Boolean(habitat));
  useEffect(() => {
    if (!habitat) return;
    let active = true;
    loadPalHabitatLocations(pal.id)
      .then((locations) => { if (active) setLoadedLocations(locations); })
      .catch(() => { if (active) setLoadedLocations([]); })
      .finally(() => { if (active) setLocationsLoading(false); });
    return () => { active = false; };
  }, [pal.id, habitat]);
  const worlds = (["palpagos", "worldTree"] as const).filter((world) => world === "palpagos"
    ? habitat?.hasPalpagosLocations ?? loadedLocations.some((location) => location.world === world)
    : habitat?.hasWorldTreeLocations ?? loadedLocations.some((location) => location.world === world));
  const [world, setWorld] = useState<"palpagos" | "worldTree">(worlds[0] ?? "palpagos");
  const [imageExpanded, setImageExpanded] = useState(false);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapDragging, setMapDragging] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ x: 0, y: 0, left: 0, top: 0 });
  const locations = loadedLocations.filter((location) => location.world === world);
  const bounds = MAP_BOUNDS[world];
  const pointStyle = (location: (typeof locations)[number]) => ({
    left: `${Math.max(0, Math.min(100, ((location.y - bounds.minY) / (bounds.maxY - bounds.minY)) * 100))}%`,
    top: `${Math.max(0, Math.min(100, (1 - (location.x - bounds.minX) / (bounds.maxX - bounds.minX)) * 100))}%`,
  });
  const workEntries = Object.entries(pal.work).sort((a, b) => b[1] - a[1]);
  const range = (min?: number | null, max?: number | null) => min == null ? "无记录" : max != null && max > min ? `Lv.${min}–${max}` : `Lv.${min}`;
  const wildRange = range(habitat?.commonWildMinLevel ?? habitat?.wildMinLevel, habitat?.commonWildMaxLevel ?? habitat?.wildMaxLevel);
  const bossRange = range(habitat?.bossMinLevel, habitat?.bossMaxLevel);
  const startMapDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mapZoom <= 1 || !mapRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, left: mapRef.current.scrollLeft, top: mapRef.current.scrollTop };
    setMapDragging(true);
  };
  const moveMap = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!mapDragging || !mapRef.current) return;
    mapRef.current.scrollLeft = dragRef.current.left - (event.clientX - dragRef.current.x);
    mapRef.current.scrollTop = dragRef.current.top - (event.clientY - dragRef.current.y);
  };
  const stopMapDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setMapDragging(false);
  };

  return <div className="modal-backdrop detail-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="pal-detail-modal" role="dialog" aria-modal="true" aria-labelledby="pal-detail-title">
      <header>
        <div className="detail-identity">{pal.image && <button className="portrait-button" onClick={() => setImageExpanded(true)} aria-label="放大帕鲁图片"><img src={pal.image} alt={pal.nameZh} /><i>放大</i></button>}<div><span>PALDECK · No.{pal.dex}</span><h2 id="pal-detail-title">{pal.nameZh} <small>{pal.name}</small></h2><p>{pal.elements.join(" · ") || "特殊条目"}</p></div></div>
        <button onClick={onClose} aria-label="关闭图鉴">×</button>
      </header>
      <div className="detail-layout">
        <div className="habitat-map-panel">
          <div className="map-toolbar"><div><b>内置栖息地图</b><small>橙色白天 · 紫色夜晚 · 红色昼夜 · 金色 Boss · 放大后按住拖动</small></div><div className="map-tools">{worlds.length > 1 && worlds.map((item) => <button className={world === item ? "active" : ""} onClick={() => { setWorld(item); setMapZoom(1); }} key={item}>{item === "palpagos" ? "群岛" : "世界树"}</button>)}<button onClick={() => setMapZoom((value) => Math.max(1, value - .5))} aria-label="缩小地图">−</button><b>{mapZoom.toFixed(1)}×</b><button onClick={() => setMapZoom((value) => Math.min(3, value + .5))} aria-label="放大地图">＋</button></div></div>
          {locationsLoading ? <div className="no-habitat-map">正在按需加载该帕鲁的栖息点…</div> : locations.length ? <div ref={mapRef} className={`habitat-map ${mapZoom > 1 ? "draggable" : ""} ${mapDragging ? "dragging" : ""}`} onPointerDown={startMapDrag} onPointerMove={moveMap} onPointerUp={stopMapDrag} onPointerCancel={stopMapDrag}>
            <div className="map-canvas" style={{ width: `${mapZoom * 100}%`, height: `${mapZoom * 100}%` }}><img src={`${BASE_PATH}/${world === "palpagos" ? "palpagos-map.webp" : "world-tree-map.webp"}`} alt={world === "palpagos" ? "帕洛斯群岛地图" : "世界树地图"} />
            <div className="map-points">{locations.map((location, index) => <i key={`${location.x}-${location.y}-${index}`} className={`${location.time} ${location.boss ? "boss" : ""}`} style={pointStyle(location)} title={`${location.boss ? "Boss · " : ""}${location.level ? `Lv.${location.level} · ` : ""}${location.time === "day" ? "白天" : location.time === "night" ? "夜晚" : "昼夜"}`} />)}</div></div>
          </div> : <div className="no-habitat-map">当前 1.0 数据没有记录普通野外分布；它可能只能通过配种、事件、召唤或其他特殊方式获得。</div>}
          <div className="map-counts"><span>☀ 白天点位 <b>{world === "palpagos" ? habitat?.dayCount ?? 0 : habitat?.worldTreeDayCount ?? 0}</b></span><span>☾ 夜晚点位 <b>{world === "palpagos" ? habitat?.nightCount ?? 0 : habitat?.worldTreeNightCount ?? 0}</b></span><span>常见野生 <b>{wildRange}</b></span><span>Alpha Boss <b>{bossRange}</b></span></div>
        </div>
        <aside className="paldex-info">
          <div className="paldex-stats"><span><b>{pal.stats.hp ?? "—"}</b>生命</span><span><b>{pal.stats.attack ?? "—"}</b>攻击</span><span><b>{pal.stats.defense ?? "—"}</b>防御</span></div>
          <section><h3>图鉴说明</h3><p>{habitat?.summary || "暂无说明。"}</p></section>
          <section className="level-guide"><h3>野外等级与捕捉难度</h3><div><span><b>普通野生常见等级</b><strong>{wildRange}</strong><small>按主要栖息点中出现最集中的等级段统计，已排除世界树高等级点等离群值。</small></span><span className="alpha"><b>Alpha Boss</b><strong>{bossRange}</strong><small>体型、血量与战斗压力更高；可在规划条件中完全排除额外捕捉 Boss。</small></span></div><p>开启等级＋8过滤时只保留当前可执行路线；关闭后可查看包含高等级种源的理论最短路线。</p></section>
          <section><h3>工作适应性</h3><div className="work-tags">{workEntries.length ? workEntries.map(([name, level]) => { const copy = WORK_COPY[name] ?? { label: name, icon: "◆", color: "#687686" }; return <span key={name} style={{ "--work-color": copy.color } as React.CSSProperties}><i>{copy.icon}</i><b>{copy.label}</b><strong>Lv.{level}</strong></span>; }) : <small>无据点工作数据</small>}</div></section>
          <section className="source-note"><h3>1.0 数据说明</h3><p>点位与等级快照采集于 2026-07-20。野外等级会受世界设置、地下城和特殊事件影响。</p>{habitat?.mapSourceUrl && <a href={habitat.mapSourceUrl} target="_blank" rel="noreferrer">在 PalDB 核对原始分布 ↗</a>}</section>
        </aside>
      </div>
      {imageExpanded && <button className="image-lightbox" onClick={() => setImageExpanded(false)} aria-label="关闭大图"><img src={pal.image} alt={pal.nameZh} /><span>点击任意位置关闭</span></button>}
    </section>
  </div>;
}
