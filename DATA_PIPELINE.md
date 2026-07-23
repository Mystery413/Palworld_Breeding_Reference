# 线上数据链路

## 哪份数据真正驱动网页

GitHub Pages 不会在访客打开页面时查询 Supabase 的帕鲁、配种、词条或栖息地参考表。浏览器实际读取：

- `public/data/runtime/planner-core.json`：规划器和图鉴所需的核心数据；
- `public/data/runtime/habitats/*.json`：按帕鲁延迟加载的栖息点；
- `public/data/save-import-index.json`：存档导入索引。

Supabase 运行时只用于共享用户列表和共享库存。修改 Supabase 参考表不会改变已部署网页中的帕鲁资料。

## 数据生成顺序

```text
data/pal-metadata-1.0.json（抓取快照）
        +
data/habitat-corrections.json（人工核验修正）
        +
仓库配种 CSV
        ↓
public/data/breeding-data.json（完整中间数据）
        ↓
public/data/runtime/planner-core.json
public/data/runtime/habitats/*.json（线上静态数据）
```

`habitat-corrections.json` 是经过人工核验的持久修正层。`build_dataset.py` 和
`build-runtime-data.mjs` 都会应用它：前者保证完整数据集正确，后者保证即使有人忘记重建
中间数据，GitHub Pages 构建仍不会重新发布已知错误。

## 栖息地来源边界

`wild_*` 和 `common_wild_*` 只表示可作为普通野生捕获来源的刷新。以下 PalDB
Spawner 条目不得混入普通野生等级：

- 袭击（Raid）；
- `IncidentSpawner` 随机事件；
- 垂钓池；
- Captured Cage；
- 帕鲁中介；
- 帕鲁蛋。

这些来源以后如需进入路线规划，必须先增加明确的来源类型和对应 UI，不能伪装为
`wild`。

## 更新与发布检查

从抓取源重新生成栖息地时：

```bash
python3 scripts/enrich_habitats.py
python3 scripts/build_dataset.py
npm run build:runtime-data
npm test
npm run build:pages
```

只修改已核验修正时，可以跳过第一次抓取，但仍须从 `build_dataset.py` 开始执行。
发布前必须直接检查 `public/data/runtime/planner-core.json`，不能以 Supabase SQL
查询结果作为线上数据已更新的证明。

GitHub Pages 工作流在每次构建时还会再次执行 `build:runtime-data`，因此最终部署以
提交中的静态源数据和修正层为准。
