"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InventoryPal, Pal } from "@/lib/planner";
import { filterSaveImportedPals } from "@/lib/save-import";
import type { SaveImportedPal } from "@/lib/save-import";
import { loadSaveImportIndex } from "@/lib/supabase-data";
import { useSaveFileMonitor } from "@/app/useSaveFileMonitor";

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

  const parseBuffer = useCallback(async (buffer: ArrayBuffer, file: File) => {
    if (!/\.(sav|json)$/i.test(file.name)) {
      throw new Error("请选择 Level.sav，或存档工具转换出的 Level.sav.json。");
    }
    workerRef.current?.terminate();
    setFileName(file.name); setStatus("正在准备存档…"); setError("");
    try {
      let index;
      try {
        index = await loadSaveImportIndex();
      } catch (loadError) {
        console.error("Save import index load failed", loadError);
        throw new Error("无法从数据库读取存档映射，请稍后重试。");
      }
      const worker = new Worker(`${BASE_PATH}/pal-save-worker.js`, { type: "module" });
      workerRef.current = worker;
      await new Promise<void>((resolve, reject) => {
        const finish = () => {
          worker.terminate();
          if (workerRef.current === worker) workerRef.current = null;
        };
        worker.onmessage = (event) => {
          if (event.data.type === "progress") setStatus(event.data.message);
          if (event.data.type === "error") {
            finish();
            reject(new Error(event.data.message));
          }
          if (event.data.type === "result") {
            const next = event.data.result as ParseResult;
            setResult(next);
            const counts = new Map<string, number>();
            next.pals.forEach((pal) => counts.set(pal.ownerUid, (counts.get(pal.ownerUid) ?? 0) + 1));
            setOwnerUid([...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "");
            finish();
            resolve();
          }
        };
        worker.onerror = () => {
          finish();
          reject(new Error("存档读取器启动失败，请刷新页面后重试。"));
        };
        worker.postMessage({ fileName: file.name, buffer, index }, [buffer]);
      });
    } finally {
      setStatus("");
    }
  }, []);

  const monitor = useSaveFileMonitor(parseBuffer);
  const [monitorFlash, setMonitorFlash] = useState(false);
  const previousRefreshCount = useRef(0);

  useEffect(() => {
    if (monitor.refreshCount <= previousRefreshCount.current) return;
    const isUpdate = previousRefreshCount.current > 0;
    previousRefreshCount.current = monitor.refreshCount;
    if (!isUpdate) return;
    setMonitorFlash(true);
    const timer = window.setTimeout(() => setMonitorFlash(false), 1800);
    return () => window.clearTimeout(timer);
  }, [monitor.refreshCount]);

  const parseFallbackFile = async (file?: File) => {
    if (!file) return;
    if (!/\.(sav|json)$/i.test(file.name)) {
      setError("请选择 Level.sav，或存档工具转换出的 Level.sav.json。");
      return;
    }
    setResult(null);
    try {
      await parseBuffer(await file.arrayBuffer(), file);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "无法读取存档，请稍后重试。");
    }
  };

  const drop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    void parseFallbackFile(event.dataTransfer.files[0]);
  };

  const formatTime = (value: Date | null) => value?.toLocaleTimeString("zh-CN", { hour12: false }) ?? "尚未刷新";
  const monitorVisible = monitor.isSupported === true && Boolean(monitor.fileName);
  const busy = Boolean(status) || monitor.parsing;

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
          <input ref={inputRef} type="file" accept=".sav,.json" onChange={(event: ChangeEvent<HTMLInputElement>) => void parseFallbackFile(event.target.files?.[0])} hidden />
          <button className={`save-dropzone ${busy ? "loading" : ""}`} onClick={() => monitor.isSupported ? void monitor.pickFile() : inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={drop} disabled={busy}>
            <b>{busy ? "◌" : "⇧"}</b><strong>{status || (fileName ? "重新选择存档" : "选择或拖入 Level.sav")}</strong><span>{fileName || "支持 Steam 的 PlZ / PlM 存档，也支持 Level.sav.json"}</span>
          </button>
          <small className="save-default-path">默认路径：<code>%LocalAppData%\Pal\Saved\SaveGames\&lt;SteamID&gt;\&lt;世界ID&gt;\Level.sav</code></small>
          {monitor.isSupported === false && <small className="save-monitor-unsupported">当前浏览器不支持自动监控，仍可正常手动选择存档。</small>}
          {monitorVisible && <div className={`save-monitor ${monitor.status} ${monitorFlash ? "updated" : ""}`}>
            <div className="save-monitor-summary">
              <span className="save-monitor-dot" aria-hidden="true" />
              <span><b>{monitor.fileName}</b><small>{monitor.status === "handle-lost" ? "句柄已失效" : monitor.status === "paused" ? "自动刷新已暂停" : "每 30 秒自动刷新"} · 上次刷新 {formatTime(monitor.lastRefreshTime)}</small></span>
              {monitorFlash && <em>存档已更新</em>}
            </div>
            {monitor.lastError && <p>{monitor.lastError}</p>}
            <div className="save-monitor-actions">
              <button onClick={monitor.status === "paused" ? monitor.resume : monitor.pause} disabled={monitor.status === "handle-lost"}>{monitor.status === "paused" ? "恢复" : "暂停"}</button>
              <button onClick={() => void monitor.refresh()} disabled={monitor.parsing || monitor.status === "handle-lost"}>{monitor.parsing ? "读取中…" : "立即刷新"}</button>
              <button onClick={() => void monitor.pickFile()} disabled={monitor.parsing}>重新选择</button>
            </div>
          </div>}
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
