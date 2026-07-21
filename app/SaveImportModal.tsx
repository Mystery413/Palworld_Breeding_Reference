"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { InventoryPal, Pal } from "@/lib/planner";
import { filterSaveImportedPals } from "@/lib/save-import";
import type { SaveImportedPal } from "@/lib/save-import";
import { loadSaveImportIndex } from "@/lib/supabase-data";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type ParseResult = {
  pals: SaveImportedPal[];
  totalCharacters: number;
  unknownSpecies: string[];
  unknownPassives: string[];
};

export function SaveImportModal({ pals, onClose, onImport }: {
  pals: Pal[];
  onClose: () => void;
  onImport: (items: InventoryPal[], mode: "merge" | "replace") => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [ownerUid, setOwnerUid] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("replace");
  const [eliteOnly, setEliteOnly] = useState(false);
  const palById = useMemo(() => new Map(pals.map((pal) => [pal.id, pal])), [pals]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const ownerGroups = useMemo(() => {
    const groups = new Map<string, SaveImportedPal[]>();
    for (const pal of result?.pals ?? []) groups.set(pal.ownerUid, [...(groups.get(pal.ownerUid) ?? []), pal]);
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [result]);
  const selectedAll = ownerGroups.find(([uid]) => uid === ownerUid)?.[1] ?? [];
  const selected = filterSaveImportedPals(selectedAll, eliteOnly);

  const parseFile = async (file?: File) => {
    if (!file) return;
    if (!/\.(sav|json)$/i.test(file.name)) {
      setError("请选择 Level.sav，或存档工具转换出的 Level.sav.json。");
      return;
    }
    workerRef.current?.terminate();
    setFileName(file.name); setStatus("正在准备存档…"); setError(""); setResult(null);
    try {
      const [buffer, index] = await Promise.all([file.arrayBuffer(), loadSaveImportIndex()]);
      const worker = new Worker(`${BASE_PATH}/pal-save-worker.js`, { type: "module" });
      workerRef.current = worker;
      worker.onmessage = (event) => {
        if (event.data.type === "progress") setStatus(event.data.message);
        if (event.data.type === "error") { setStatus(""); setError(event.data.message); worker.terminate(); }
        if (event.data.type === "result") {
          const next = event.data.result as ParseResult;
          setResult(next); setStatus("");
          const counts = new Map<string, number>();
          next.pals.forEach((pal) => counts.set(pal.ownerUid, (counts.get(pal.ownerUid) ?? 0) + 1));
          setOwnerUid([...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "");
          worker.terminate();
        }
      };
      worker.onerror = () => { setStatus(""); setError("存档读取器启动失败，请刷新页面后重试。"); };
      worker.postMessage({ fileName: file.name, buffer, index }, [buffer]);
    } catch (loadError) {
      console.error("Save import index load failed", loadError);
      setStatus("");
      setError("无法从数据库读取存档映射，请稍后重试。");
    }
  };

  const drop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    void parseFile(event.dataTransfer.files[0]);
  };

  return <div className="modal-backdrop save-import-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="save-import-modal" role="dialog" aria-modal="true" aria-labelledby="save-import-title">
      <header><div><span>LOCAL SAVE · PRIVATE</span><h2 id="save-import-title">从游戏存档读取我的帕鲁</h2><p>解压和解析只在此浏览器标签页中进行，不会上传文件。</p></div><button onClick={onClose} aria-label="关闭">×</button></header>
      <div className="save-import-body">
        <aside className="save-path-guide">
          <h3>Windows Steam 存档位置</h3>
          <ol>
            <li><b>Win + R</b><span>打开“运行”</span></li>
            <li><code>%LOCALAPPDATA%\Pal\Saved\SaveGames</code><span>粘贴后回车</span></li>
            <li><b>进入 Steam ID 文件夹</b><span>再进入最近修改的世界文件夹</span></li>
            <li><b>选择 Level.sav</b><span>不要选择 Players 文件夹里的单人文件</span></li>
          </ol>
          <small>建议先在游戏主菜单退出世界，确保最新进度已写入磁盘。</small>
        </aside>
        <div className="save-import-main">
          <input ref={inputRef} type="file" accept=".sav,.json" onChange={(event: ChangeEvent<HTMLInputElement>) => void parseFile(event.target.files?.[0])} hidden />
          <button className={`save-dropzone ${status ? "loading" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={drop} disabled={Boolean(status)}>
            <b>{status ? "◌" : "⇧"}</b><strong>{status || (fileName ? "重新选择存档" : "选择或拖入 Level.sav")}</strong><span>{fileName || "支持 Steam 的 PlZ / PlM 存档，也支持 Level.sav.json"}</span>
          </button>
          {error && <div className="save-error"><strong>读取失败</strong><span>{error}</span><small>确认文件名是 Level.sav；如果游戏更新导致格式变化，可先用 PalworldSaveTools 转成 JSON 再选择。</small></div>}
          {result && <div className="save-preview">
            <div className="save-preview-metrics"><span><b>{result.pals.length}</b>已识别个体</span><span><b>{ownerGroups.length}</b>名玩家</span><span><b>{result.unknownSpecies.length}</b>未知物种</span></div>
            {!result.pals.length ? <p>存档已打开，但没有识别到可导入的帕鲁。请确认选择的是当前世界的 Level.sav。</p> : <>
              <label>选择要导入的玩家<select value={ownerUid} onChange={(event) => setOwnerUid(event.target.value)}>{ownerGroups.map(([uid, items], index) => <option value={uid} key={uid}>{index === 0 ? "主要玩家" : `玩家 ${index + 1}`} · {items.length} 只 · {uid.slice(0, 8)}</option>)}</select></label>
              <label className={`elite-filter-toggle ${eliteOnly ? "active" : ""}`}><input type="checkbox" checked={eliteOnly} onChange={(event) => setEliteOnly(event.target.checked)} /><span><b>仅看有彩色／顶级词条的</b><small>开启后只导入带等级 4–5 词条的帕鲁；路线计算会认为你只有这 {selected.length} 只</small></span><i>{eliteOnly ? `${selected.length} / ${selectedAll.length}` : "全部"}</i></label>
              {eliteOnly && !selected.length && <div className="save-empty-filter">这个玩家的存档中没有识别到带彩色／世界树顶级词条的帕鲁。</div>}
              <div className="save-pal-sample">{selected.slice(0, 8).map((item) => { const pal = palById.get(item.palId); return <div key={item.id}>{pal?.image && <img src={pal.image} alt="" />}<span><b>{item.nickname || pal?.nameZh || item.palId}</b><small>Lv.{item.level ?? "?"} · {item.sex === "M" ? "♂" : "♀"} · {item.passives.length ? item.passives.join(" / ") : "无词条"}</small></span></div>; })}</div>
              {selected.length > 8 && <small className="save-more">另有 {selected.length - 8} 只将在确认后一起导入。</small>}
              {(result.unknownSpecies.length > 0 || result.unknownPassives.length > 0) && <small className="save-warning">有 {result.unknownSpecies.length} 个物种、{result.unknownPassives.length} 个词条尚无中文映射；已识别词条会正常导入。</small>}
            </>}
          </div>}
        </div>
      </div>
      <footer><div className="save-mode"><button className={mode === "replace" ? "active" : ""} onClick={() => setMode("replace")}>替换现有库存</button><button className={mode === "merge" ? "active" : ""} onClick={() => setMode("merge")}>合并并去重</button></div><button className="ghost-button" onClick={onClose}>取消</button><button className="primary-button" disabled={!selected.length} onClick={() => onImport(selected, mode)}>{selected.length ? `导入 ${selected.length} 只帕鲁` : "等待读取存档"}</button></footer>
    </section>
  </div>;
}
