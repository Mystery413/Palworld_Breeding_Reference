"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BreedingData,
  findTargetPlan,
  InventoryPal,
  Pal,
  PlanResult,
  Profile,
  Recommendation,
  recommendTargets,
  searchBreedingPlans,
  summarizeSearch,
} from "@/lib/planner";

const STORAGE_KEY = "palworld-breeding-lab-v1";

const PASSIVE_PRESETS = [
  "破坏神",
  "双刃圣剑",
  "守护圣盾",
  "恶魔之手",
  "卓绝技艺",
  "金刚之躯",
  "传说",
  "稀有",
  "鬼神",
  "神速",
  "明镜止水",
  "永动机",
  "吸血鬼",
  "不死之身",
  "特殊体质",
  "重装甲",
  "身轻如燕",
  "育婴师",
  "工匠精神",
  "博爱主义者",
  "沉着冷静",
  "无限精力",
  "凶猛",
];

const PROFILE_COPY: Record<Profile, { label: string; short: string; icon: string }> = {
  combat: { label: "综合战斗", short: "生命、攻击、防御与稀有度", icon: "⚔" },
  attack: { label: "极限输出", short: "优先基础攻击和稀有度", icon: "✦" },
  worker: { label: "据点王牌", short: "工作等级、种类与速度", icon: "⌂" },
  balanced: { label: "全能培养", short: "兼顾战斗与据点价值", icon: "◈" },
};

type SavedState = {
  inventory: InventoryPal[];
  desiredPassives: string[];
  profile: Profile;
  exactTargetId: string;
};

type DraftPal = {
  palId: string;
  sex: "M" | "F";
  passives: string[];
  hp: string;
  attack: string;
  defense: string;
  nickname: string;
};

const EMPTY_DRAFT: DraftPal = {
  palId: "",
  sex: "F",
  passives: [],
  hp: "",
  attack: "",
  defense: "",
  nickname: "",
};

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value) || value > 9999) return "大量";
  if (value < 10) return value.toFixed(1).replace(".0", "");
  return Math.round(value).toLocaleString("zh-CN");
}

function genderLabel(value: string): string {
  if (value === "MALE" || value === "M") return "♂ 雄";
  if (value === "FEMALE" || value === "F") return "♀ 雌";
  return "异性配对";
}

function potentialTargetLabel(potentials: { hp: number | null; attack: number | null; defense: number | null }): string {
  const parts = [
    potentials.hp == null ? "" : `生命≥${potentials.hp}`,
    potentials.attack == null ? "" : `攻击≥${potentials.attack}`,
    potentials.defense == null ? "" : `防御≥${potentials.defense}`,
  ].filter(Boolean);
  return parts.join("、");
}

function maskCsvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseInventoryCsv(text: string, pals: Pal[]): InventoryPal[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((value) => value.trim().toLowerCase());
  const index = (name: string) => headers.indexOf(name);
  const palMap = new Map(pals.flatMap((pal) => [[pal.id.toLowerCase(), pal.id], [pal.name.toLowerCase(), pal.id], [pal.nameZh.toLowerCase(), pal.id]]));
  return lines.slice(1).flatMap((line, rowIndex) => {
    const cells = line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)?.map((cell) => cell.replace(/^,/, "").replace(/^"|"$/g, "").replaceAll('""', '"')) ?? [];
    const rawPal = cells[index("pal_id")] || cells[index("pal")] || cells[index("name")] || "";
    const palId = palMap.get(rawPal.trim().toLowerCase());
    if (!palId) return [];
    const sexRaw = (cells[index("sex")] || "F").toUpperCase();
    const passives = unique((cells[index("passives")] || "").split(/[|;；、]/));
    const value = (field: string) => {
      const raw = cells[index(field)];
      return raw && !Number.isNaN(Number(raw)) ? Number(raw) : null;
    };
    return [{
      id: `import-${Date.now()}-${rowIndex}`,
      palId,
      sex: sexRaw.startsWith("M") || sexRaw === "雄" ? "M" as const : "F" as const,
      passives,
      hp: value("hp"),
      attack: value("attack"),
      defense: value("defense"),
      nickname: cells[index("nickname")] || "",
    }];
  });
}

export default function PlannerApp() {
  const [data, setData] = useState<BreedingData | null>(null);
  const [inventory, setInventory] = useState<InventoryPal[]>([]);
  const [desiredPassives, setDesiredPassives] = useState<string[]>([]);
  const [profile, setProfile] = useState<Profile>("combat");
  const [mode, setMode] = useState<"recommend" | "exact">("recommend");
  const [exactTargetId, setExactTargetId] = useState("");
  const [selectedPalId, setSelectedPalId] = useState("");
  const [isInventoryOpen, setInventoryOpen] = useState(false);
  const [draft, setDraft] = useState<DraftPal>(EMPTY_DRAFT);
  const [palSearch, setPalSearch] = useState("");
  const [passiveInput, setPassiveInput] = useState("");
  const [desiredInput, setDesiredInput] = useState("");
  const [notice, setNotice] = useState("");
  const [isHydrated, setHydrated] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/data/breeding-data.json")
      .then((response) => {
        if (!response.ok) throw new Error("数据加载失败");
        return response.json() as Promise<BreedingData>;
      })
      .then(setData)
      .catch(() => setNotice("无法加载 1.0 配种数据，请刷新页面重试。"));
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<SavedState>;
          if (Array.isArray(parsed.inventory)) setInventory(parsed.inventory);
          if (Array.isArray(parsed.desiredPassives)) setDesiredPassives(parsed.desiredPassives.slice(0, 4));
          if (parsed.profile) setProfile(parsed.profile);
          if (parsed.exactTargetId) setExactTargetId(parsed.exactTargetId);
        }
      } catch {
        setNotice("本地存档无法读取，已使用空白库存。你可以重新录入或导入备份。");
      } finally {
        setHydrated(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const saved: SavedState = { inventory, desiredPassives, profile, exactTargetId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [inventory, desiredPassives, profile, exactTargetId, isHydrated]);

  const palById = useMemo(() => new Map(data?.pals.map((pal) => [pal.id, pal]) ?? []), [data]);
  const availablePassives = useMemo(() => unique(inventory.flatMap((item) => item.passives)), [inventory]);

  const search = useMemo(() => {
    if (!data || !inventory.length) return null;
    return searchBreedingPlans(data, inventory, desiredPassives);
  }, [data, inventory, desiredPassives]);

  const recommendations = useMemo(() => {
    if (!data || !search) return [];
    return recommendTargets(data, search, profile, 10);
  }, [data, search, profile]);

  const exactPlan = useMemo(() => {
    if (!search || !exactTargetId) return null;
    return findTargetPlan(search, exactTargetId);
  }, [search, exactTargetId]);

  const activeResult: (Recommendation | PlanResult) | null = useMemo(() => {
    if (mode === "exact") return exactPlan;
    return recommendations.find((item) => item.pal.id === selectedPalId) ?? recommendations[0] ?? null;
  }, [mode, exactPlan, recommendations, selectedPalId]);

  const activePal = mode === "exact" ? palById.get(exactTargetId) : (activeResult as Recommendation | null)?.pal;
  const summary = search ? summarizeSearch(search) : { reachablePals: inventory.length ? new Set(inventory.map((item) => item.palId)).size : 0, fullTraitPals: 0 };

  const filteredPals = useMemo(() => {
    if (!data) return [];
    const query = palSearch.trim().toLowerCase();
    return data.pals
      .filter((pal) => !query || `${pal.dex} ${pal.name} ${pal.nameZh}`.toLowerCase().includes(query))
      .sort((a, b) => a.dex.localeCompare(b.dex, undefined, { numeric: true }))
      .slice(0, 80);
  }, [data, palSearch]);

  const addDraftPassive = (passive: string) => {
    if (!passive.trim()) return;
    setDraft((current) => ({ ...current, passives: unique([...current.passives, passive]) }));
    setPassiveInput("");
  };

  const addDesiredPassive = (passive: string) => {
    if (!passive.trim() || desiredPassives.includes(passive) || desiredPassives.length >= 4) return;
    setDesiredPassives((current) => [...current, passive.trim()]);
    setDesiredInput("");
  };

  const saveDraft = () => {
    if (!draft.palId) {
      setNotice("请先选择一个帕鲁。然后再保存到库存。");
      return;
    }
    const numberOrNull = (value: string) => value === "" ? null : Math.max(0, Math.min(100, Number(value)));
    const item: InventoryPal = {
      id: `pal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      palId: draft.palId,
      sex: draft.sex,
      passives: unique(draft.passives),
      hp: numberOrNull(draft.hp),
      attack: numberOrNull(draft.attack),
      defense: numberOrNull(draft.defense),
      nickname: draft.nickname.trim(),
    };
    setInventory((current) => [...current, item]);
    setDraft(EMPTY_DRAFT);
    setPalSearch("");
    setInventoryOpen(false);
    setNotice(`${palById.get(item.palId)?.nameZh ?? "帕鲁"} 已加入库存。`);
  };

  const loadExample = () => {
    const example: InventoryPal[] = [
      { id: "demo-1", palId: "1:0", sex: "F", passives: ["卓绝技艺"], hp: 44, attack: 62, defense: 55, nickname: "钓到的彩词条" },
      { id: "demo-2", palId: "2:0", sex: "M", passives: ["破坏神"], hp: 71, attack: 68, defense: 48 },
      { id: "demo-3", palId: "3:0", sex: "F", passives: ["神速"], hp: 39, attack: 51, defense: 64 },
      { id: "demo-4", palId: "4:0", sex: "M", passives: ["不死之身"], hp: 83, attack: 74, defense: 70 },
      { id: "demo-5", palId: "6:0", sex: "F", passives: ["传说"], hp: 92, attack: 89, defense: 78 },
    ];
    setInventory(example);
    setDesiredPassives(["破坏神", "不死之身", "神速", "传说"]);
    setProfile("combat");
    setMode("recommend");
    setNotice("示例已载入：5 只前期帕鲁，各携带一个高阶词条。可以直接查看推荐路线。 ");
  };

  const exportJson = () => {
    downloadFile("palworld-breeding-inventory.json", JSON.stringify({ version: 1, inventory, desiredPassives, profile, exactTargetId }, null, 2), "application/json");
  };

  const exportCsv = () => {
    const rows = inventory.map((item) => [item.palId, item.sex, item.passives.join("|"), item.hp ?? "", item.attack ?? "", item.defense ?? "", item.nickname ?? ""].map(String).map(maskCsvCell).join(","));
    downloadFile("palworld-breeding-inventory.csv", `pal_id,sex,passives,hp,attack,defense,nickname\n${rows.join("\n")}`, "text/csv;charset=utf-8");
  };

  const importInventory = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !data) return;
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(text) as Partial<SavedState> & { version?: number };
        if (!Array.isArray(parsed.inventory)) throw new Error("missing inventory");
        setInventory(parsed.inventory);
        if (Array.isArray(parsed.desiredPassives)) setDesiredPassives(parsed.desiredPassives.slice(0, 4));
        if (parsed.profile) setProfile(parsed.profile);
        if (parsed.exactTargetId) setExactTargetId(parsed.exactTargetId);
      } else {
        const imported = parseInventoryCsv(text, data.pals);
        if (!imported.length) throw new Error("no rows");
        setInventory(imported);
      }
      setNotice("库存导入成功，路线已重新计算。 ");
    } catch {
      setNotice("导入失败。请使用本工具导出的 JSON，或包含 pal_id、sex、passives 列的 CSV。 ");
    } finally {
      event.target.value = "";
    }
  };

  const palLabel = (palId: string) => {
    const pal = palById.get(palId);
    return pal ? `${pal.nameZh} · ${pal.name}` : palId;
  };

  const passiveKeyDown = (event: KeyboardEvent<HTMLInputElement>, type: "draft" | "desired") => {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    if (type === "draft") addDraftPassive(passiveInput);
    else addDesiredPassive(desiredInput);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="返回顶部">
          <span className="brand-mark">P</span>
          <span><strong>帕鲁育种实验室</strong><small>PAL GENETICS · 1.0</small></span>
        </a>
        <nav className="topnav" aria-label="主导航">
          <a href="#inventory">我的帕鲁</a>
          <a href="#planner">智能规划</a>
          <a href="#steps">操作清单</a>
          <a href="#mechanics">机制说明</a>
        </nav>
        <div className="data-badge"><i /> 1.0 数据 · {data ? `${data.pals.length} 帕鲁` : "加载中"}</div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">BREED SMARTER, NOT HARDER</p>
          <h1>把散落的彩色词条，<br /><em>炼成你的终极帕鲁。</em></h1>
          <p className="hero-lede">录入你已有的低阶帕鲁、性别、词条与潜力。系统会从 44,486 条 1.0 配方中找到当前可达的强力目标，并拆成每一步可照做的育种清单。</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setInventoryOpen(true)}>+ 录入第一只帕鲁</button>
            <button className="ghost-button" onClick={loadExample}>用示例体验</button>
          </div>
        </div>
        <div className="hero-console" aria-label="规划器概览">
          <div className="console-header"><span>当前育种盘面</span><small>自动保存在本机</small></div>
          <div className="console-metrics">
            <div><strong>{inventory.length}</strong><span>已有个体</span></div>
            <div><strong>{summary.reachablePals}</strong><span>可达物种</span></div>
            <div><strong>{summary.fullTraitPals}</strong><span>完整词条可达</span></div>
          </div>
          <div className="gene-track">
            <span>目标基因组</span>
            <div>{desiredPassives.length ? desiredPassives.map((passive, index) => <b key={passive} style={{ "--gene-index": index } as React.CSSProperties}>{passive}</b>) : <i>尚未设置目标词条</i>}</div>
          </div>
          <div className="console-status"><i className={data ? "ready" : ""} />{data ? "配种图谱已就绪" : "正在装载配种图谱…"}</div>
        </div>
      </section>

      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="关闭提示">×</button></div>}

      <section className="workspace" id="planner">
        <aside className="inventory-panel" id="inventory">
          <div className="section-heading compact">
            <div><span>01</span><h2>我的帕鲁</h2></div>
            <button className="small-add" onClick={() => setInventoryOpen(true)}>＋ 添加</button>
          </div>
          <p className="panel-help">每个个体都要单独记录；性别和杂词条会影响路线。</p>
          <div className="inventory-list">
            {!inventory.length ? (
              <button className="empty-inventory" onClick={() => setInventoryOpen(true)}><b>＋</b><span>还没有库存</span><small>先录入钓鱼或抓到的帕鲁</small></button>
            ) : inventory.map((item) => {
              const pal = palById.get(item.palId);
              return <article className="inventory-card" key={item.id}>
                {pal?.image ? <img src={pal.image} alt="" /> : <div className="pal-placeholder">P</div>}
                <div className="inventory-main">
                  <div><strong>{pal?.nameZh ?? item.palId}</strong><span className={item.sex === "M" ? "male" : "female"}>{item.sex === "M" ? "♂" : "♀"}</span></div>
                  <small>No.{pal?.dex} · {pal?.name}</small>
                  <div className="mini-passives">{item.passives.length ? item.passives.map((passive) => <span key={passive}>{passive}</span>) : <em>无词条</em>}</div>
                </div>
                <button className="remove-button" onClick={() => setInventory((current) => current.filter((entry) => entry.id !== item.id))} aria-label={`删除${pal?.nameZh ?? "帕鲁"}`}>×</button>
              </article>;
            })}
          </div>
          <div className="inventory-tools">
            <input ref={importRef} type="file" accept=".json,.csv" onChange={importInventory} hidden />
            <button onClick={() => importRef.current?.click()}>导入</button>
            <button onClick={exportJson} disabled={!inventory.length}>备份 JSON</button>
            <button onClick={exportCsv} disabled={!inventory.length}>导出 CSV</button>
          </div>
        </aside>

        <div className="planner-panel">
          <div className="section-heading">
            <div><span>02</span><h2>定义你的“最强”</h2></div>
            <p>推荐分数透明可解释，可随目标切换。</p>
          </div>

          <div className="mode-switch" role="tablist" aria-label="规划模式">
            <button className={mode === "recommend" ? "active" : ""} onClick={() => setMode("recommend")} role="tab">系统推荐</button>
            <button className={mode === "exact" ? "active" : ""} onClick={() => setMode("exact")} role="tab">指定目标</button>
          </div>

          <div className="goal-builder">
            <div className="goal-block">
              <label>目标词条 <small>{desiredPassives.length}/4</small></label>
              <div className="tag-input">
                {desiredPassives.map((passive) => <span key={passive}>{passive}<button onClick={() => setDesiredPassives((current) => current.filter((item) => item !== passive))}>×</button></span>)}
                {desiredPassives.length < 4 && <input value={desiredInput} onChange={(event) => setDesiredInput(event.target.value)} onKeyDown={(event) => passiveKeyDown(event, "desired")} placeholder={desiredPassives.length ? "继续添加…" : "输入词条，回车添加"} list="passive-presets" />}
              </div>
              <div className="quick-passives">
                {availablePassives.filter((passive) => !desiredPassives.includes(passive)).slice(0, 8).map((passive) => <button key={passive} onClick={() => addDesiredPassive(passive)}>+ {passive}</button>)}
                {!availablePassives.length && <small>录入库存后，这里会显示你已经拥有的词条。</small>}
              </div>
            </div>

            {mode === "recommend" ? (
              <div className="profile-grid">
                {(Object.keys(PROFILE_COPY) as Profile[]).map((key) => <button key={key} className={profile === key ? "active" : ""} onClick={() => setProfile(key)}>
                  <span>{PROFILE_COPY[key].icon}</span><strong>{PROFILE_COPY[key].label}</strong><small>{PROFILE_COPY[key].short}</small>
                </button>)}
              </div>
            ) : (
              <div className="exact-target">
                <label htmlFor="target-pal">想要孵化的帕鲁</label>
                <select id="target-pal" value={exactTargetId} onChange={(event) => setExactTargetId(event.target.value)}>
                  <option value="">选择目标帕鲁…</option>
                  {data?.pals.slice().sort((a, b) => a.dex.localeCompare(b.dex, undefined, { numeric: true })).map((pal) => <option value={pal.id} key={pal.id}>No.{pal.dex} {pal.nameZh} · {pal.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {!inventory.length ? (
            <div className="planner-empty">
              <span>◎</span><h3>先告诉我你手里有什么</h3><p>至少录入两只异性帕鲁，系统才可以从你的真实库存出发计算路线。</p><button className="primary-button" onClick={() => setInventoryOpen(true)}>录入帕鲁</button>
            </div>
          ) : !data || !search ? (
            <div className="planner-empty"><span className="spinner">◌</span><h3>正在计算可达图谱</h3><p>第一次计算会遍历 44,486 条配方。</p></div>
          ) : mode === "recommend" ? (
            <div className="recommendations">
              <div className="result-title"><div><span>03</span><h2>当前最值得孵化</h2></div><small>综合强度 − 路线成本 − 缺失词条</small></div>
              {recommendations.length ? <div className="recommendation-grid">
                {recommendations.map((item, index) => <button key={item.pal.id} className={`recommend-card ${(activeResult as Recommendation | null)?.pal?.id === item.pal.id ? "active" : ""}`} onClick={() => setSelectedPalId(item.pal.id)}>
                  <span className="rank">#{index + 1}</span>
                  <img src={item.pal.image} alt="" />
                  <div className="recommend-name"><strong>{item.pal.nameZh}</strong><small>{item.pal.name} · No.{item.pal.dex}</small></div>
                  <div className="recommend-stats"><span><b>{Math.round(item.qualityScore)}</b>强度</span><span><b>{item.generations}</b>代</span><span><b>{item.coveredPassives.length}/{desiredPassives.length || 0}</b>词条</span></div>
                  <div className="scorebar"><i style={{ width: `${Math.max(8, Math.min(100, item.score / 2.1))}%` }} /></div>
                </button>)}
              </div> : <div className="no-route">没有找到满足当前性别条件的配种入口。补录另一性别个体，或先指定一个已有帕鲁作为目标。</div>}
            </div>
          ) : (
            <div className="exact-result">
              {!exactTargetId ? <div className="no-route">选择一个目标帕鲁后，这里会显示从当前库存出发的最短路线。</div> : !exactPlan ? <div className="no-route"><strong>{activePal?.nameZh} 当前不可达</strong><span>你的库存还不能组成通往该物种的有效异性配对。先扩大种源，或查看系统推荐。</span></div> : <TargetOverview pal={activePal} result={exactPlan} desiredCount={desiredPassives.length} />}
            </div>
          )}

          {activeResult && activePal && <PlanDetails result={activeResult} pal={activePal} palById={palById} desiredCount={desiredPassives.length} palLabel={palLabel} />}
        </div>
      </section>

      <section className="mechanics" id="mechanics">
        <div className="section-heading light"><div><span>规则</span><h2>为什么这样规划</h2></div><p>每个结果都基于同一套 1.0 规则。</p></div>
        <div className="mechanic-grid">
          <article><b>01</b><h3>物种先查表</h3><p>特殊配方、同种繁殖和性别限定会覆盖简单平均公式；本工具直接查询当前 1.0 组合表。</p></article>
          <article><b>02</b><h3>词条先合并去重</h3><p>2+2、3+1、4+0 只要最终词条池相同，基础遗传概率相同。杂词条才是真正的污染。</p></article>
          <article><b>03</b><h3>潜力逐项独立</h3><p>生命、攻击、防御各自约 30% 继承父方、30% 继承母方、40% 重新随机。</p></article>
          <article><b>04</b><h3>中间体要筛选</h3><p>每一步只保留目标词条干净、性别正确、潜力更高的子代，再进入下一代，路线才不会失控。</p></article>
        </div>
        <a className="mechanics-link" href="https://palworld.wiki.gg/wiki/Breeding" target="_blank" rel="noreferrer">查看 1.0 机制来源 ↗</a>
      </section>

      <footer><span>帕鲁育种实验室 · 非官方玩家工具</span><span>数据快照 2026-07-16 · 结果请以游戏 1.0 当前版本为准</span></footer>

      <datalist id="passive-presets">{PASSIVE_PRESETS.map((passive) => <option value={passive} key={passive} />)}</datalist>

      {isInventoryOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setInventoryOpen(false)}>
        <section className="inventory-modal" role="dialog" aria-modal="true" aria-labelledby="add-pal-title">
          <header><div><span>NEW SPECIMEN</span><h2 id="add-pal-title">录入帕鲁个体</h2></div><button onClick={() => setInventoryOpen(false)} aria-label="关闭">×</button></header>
          <div className="modal-body">
            <div className="pal-picker">
              <label htmlFor="pal-search">选择帕鲁 *</label>
              <input id="pal-search" value={palSearch} onChange={(event) => setPalSearch(event.target.value)} placeholder="搜索中文名、英文名或编号" autoFocus />
              <div className="pal-options">
                {filteredPals.map((pal) => <button key={pal.id} className={draft.palId === pal.id ? "selected" : ""} onClick={() => { setDraft((current) => ({ ...current, palId: pal.id })); setPalSearch(`${pal.nameZh} · ${pal.name}`); }}>
                  <img src={pal.image} alt="" /><span><strong>{pal.nameZh}</strong><small>No.{pal.dex} · {pal.name}</small></span><i>{draft.palId === pal.id ? "✓" : ""}</i>
                </button>)}
              </div>
            </div>
            <div className="draft-fields">
              <div className="field-row">
                <label>性别 *</label>
                <div className="sex-picker"><button className={draft.sex === "M" ? "selected male" : ""} onClick={() => setDraft((current) => ({ ...current, sex: "M" }))}>♂ 雄性</button><button className={draft.sex === "F" ? "selected female" : ""} onClick={() => setDraft((current) => ({ ...current, sex: "F" }))}>♀ 雌性</button></div>
              </div>
              <div className="field-row">
                <label htmlFor="nickname">备注名 <small>可选</small></label>
                <input id="nickname" value={draft.nickname} onChange={(event) => setDraft((current) => ({ ...current, nickname: event.target.value }))} placeholder="例如：钓鱼获得 / 备用雄性" />
              </div>
              <div className="field-row">
                <label>已有词条 <small>请把杂词条也录入</small></label>
                <div className="tag-input draft-tags">
                  {draft.passives.map((passive) => <span key={passive}>{passive}<button onClick={() => setDraft((current) => ({ ...current, passives: current.passives.filter((item) => item !== passive) }))}>×</button></span>)}
                  <input value={passiveInput} onChange={(event) => setPassiveInput(event.target.value)} onKeyDown={(event) => passiveKeyDown(event, "draft")} placeholder="输入词条后回车" list="passive-presets" />
                </div>
                <div className="preset-row">{PASSIVE_PRESETS.slice(0, 10).filter((passive) => !draft.passives.includes(passive)).map((passive) => <button key={passive} onClick={() => addDraftPassive(passive)}>+ {passive}</button>)}</div>
              </div>
              <div className="field-row">
                <label>潜力值 <small>没有能力眼镜可以留空</small></label>
                <div className="potential-grid">{(["hp", "attack", "defense"] as const).map((field) => <label key={field}><span>{field === "hp" ? "生命" : field === "attack" ? "攻击" : "防御"}</span><input type="number" min="0" max="100" value={draft[field]} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} placeholder="—" /></label>)}</div>
              </div>
            </div>
          </div>
          <footer><button className="ghost-button" onClick={() => setInventoryOpen(false)}>取消</button><button className="primary-button" onClick={saveDraft}>保存到库存</button></footer>
        </section>
      </div>}
    </main>
  );
}

function TargetOverview({ pal, result, desiredCount }: { pal?: Pal; result: PlanResult; desiredCount: number }) {
  if (!pal) return null;
  return <article className="target-overview">
    <img src={pal.image} alt="" />
    <div><span>指定目标路线</span><h3>{pal.nameZh} <small>{pal.name}</small></h3><p>{result.generations ? `从当前库存出发需要 ${result.generations} 代。` : "你已经拥有这个目标。"}</p></div>
    <div className="overview-metrics"><span><b>{result.generations}</b>代数</span><span><b>{result.coveredPassives.length}/{desiredCount}</b>词条</span><span><b>{formatNumber(result.expectedEggs)}</b>预计蛋数</span></div>
  </article>;
}

function PlanDetails({ result, pal, palById, desiredCount, palLabel }: { result: PlanResult; pal: Pal; palById: Map<string, Pal>; desiredCount: number; palLabel: (id: string) => string }) {
  return <section className="plan-details" id="steps">
    <div className="plan-summary">
      <div className="plan-target"><img src={pal.image} alt="" /><div><span>已选路线</span><h2>{pal.nameZh}</h2><small>{pal.name} · No.{pal.dex}</small></div></div>
      <div className="plan-numbers"><span><b>{result.generations}</b>最短代数</span><span><b>{result.steps.length}</b>实际步骤</span><span><b>{formatNumber(result.expectedEggs)}</b>预计总蛋数</span><span><b>{result.coveredPassives.length}/{desiredCount}</b>目标词条</span></div>
    </div>
    {result.missingPassives.length > 0 && <div className="warning-box"><b>还有词条种源缺口</b><span>{result.missingPassives.join("、")} 未在当前库存的可达链中。路线会先给出最接近结果；若想稳定遗传，请先抓到携带这些词条的帕鲁。</span></div>}
    {!result.steps.length ? <div className="owned-result">✓ 目标已经在你的库存中，不需要额外配种。</div> : <div className="step-list">
      {result.steps.map((step) => {
        const child = palById.get(step.childId);
        const a = palById.get(step.parentA.palId);
        const b = palById.get(step.parentB.palId);
        return <article className="plan-step" key={step.id}>
          <div className="step-index"><small>STEP</small><strong>{String(step.index).padStart(2, "0")}</strong></div>
          <div className="step-content">
            <div className="step-breed">
              <ParentChip pal={a} parent={step.parentA} gender={step.genderA} />
              <span className="breed-plus">＋</span>
              <ParentChip pal={b} parent={step.parentB} gender={step.genderB} />
              <span className="breed-arrow">→</span>
              <div className="child-chip">{child?.image && <img src={child.image} alt="" />}<span><small>筛选子代</small><strong>{child?.nameZh ?? step.childId}</strong></span></div>
            </div>
            <div className="step-instructions">
              <p><b>你要做：</b>把 {palLabel(step.parentA.palId)} 与 {palLabel(step.parentB.palId)} 放入配种牧场，使用普通蛋糕；孵化后只保留<strong>{step.inheritedPassives.length ? `带有 ${step.inheritedPassives.join("、")}` : "性别正确"}{potentialTargetLabel(step.potentialTargets) ? `，且 ${potentialTargetLabel(step.potentialTargets)}` : ""}</strong>的 {child?.nameZh}。</p>
              <div><span>精确词条率 <b>{Math.round(step.chance * 1000) / 10}%</b></span>{potentialTargetLabel(step.potentialTargets) && <span>潜力达标率 <b>{Math.round(step.potentialChance * 1000) / 10}%</b></span>}<span>两项同时达标平均约 <b>{formatNumber(step.expectedEggs)}</b> 枚蛋</span>{step.duplicateParent && <span className="duplicate-note">需额外孵化一只异性副本</span>}</div>
            </div>
          </div>
        </article>;
      })}
    </div>}
    <div className="final-checklist">
      <h3>最终验收清单</h3>
      <label><input type="checkbox" /> 目标物种与性别符合后续用途</label>
      <label><input type="checkbox" /> 只保留目标词条，没有杂词条污染</label>
      <label><input type="checkbox" /> 用能力眼镜检查生命、攻击、防御潜力</label>
      <label><input type="checkbox" /> 主动技能槽只设置希望遗传的技能</label>
      <label><input type="checkbox" /> 近满潜力可用生命/力量/坚硬果实补齐</label>
    </div>
  </section>;
}

function ParentChip({ pal, parent, gender }: { pal?: Pal; parent: { source: "owned" | "bred"; nickname?: string; passives: string[] }; gender: string }) {
  return <div className="parent-chip">{pal?.image && <img src={pal.image} alt="" />}<span><small>{parent.source === "owned" ? "库存个体" : "上一步子代"} · {genderLabel(gender)}</small><strong>{pal?.nameZh ?? "未知帕鲁"}</strong><em>{parent.passives.join(" · ") || parent.nickname || "优先高潜力"}</em></span></div>;
}
