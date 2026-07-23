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

## 标准操作流程

### A. 人工修正一只或少量帕鲁

适用于核实出等级、Boss、常见野生区间等个别字段有误的情况。

1. 使用至少两个可信来源交叉核验，并区分普通野生、Alpha、袭击、随机事件、垂钓池、
   笼中救援、商人和帕鲁蛋。
2. 在 `data/habitat-corrections.json` 中按 `pal_id` 添加或修改字段。不要直接只改
   `public/data/breeding-data.json`、`planner-core.json` 或 Supabase。
3. 在 `web` 目录执行完整重建与验证：

   ```bash
   npm run data:verify
   ```

4. 用帕鲁 ID 检查修正层、完整数据和运行时快照是否一致：

   ```bash
   npm run data:inspect -- 174:0
   ```

   命令必须输出 `"synchronized": true`。若三层不一致，禁止发布。
5. 检查 Git diff，至少应该包含：

   - `data/habitat-corrections.json`；
   - `public/data/breeding-data.json`；
   - `public/data/runtime/planner-core.json`；
   - 如果继续维护 Supabase 镜像，还应同步 `supabase/csv/04_pal_habitats.csv`。

6. 提交并推送 `main`，等待 GitHub Actions 的 `Deploy to GitHub Pages` 成功。
7. 最终验收必须打开线上网站，在完整图鉴中搜索该帕鲁并查看弹窗。不能只检查本地文件、
   GitHub 仓库内容、Supabase SQL 结果或直接访问 JSON。
8. 如果页面在部署前已经打开，至少刷新一次。后续数据请求会携带本次 Git commit
   版本号，避免继续使用旧快照。

### B. 从 PalDB 重新抓取全量栖息地

适用于游戏版本更新或需要整体刷新快照的情况：

```bash
python3 scripts/enrich_habitats.py
npm run data:verify
```

全量抓取不会替代 `habitat-corrections.json`；人工核验修正会在构建时再次覆盖抓取结果。
抓取完成后应抽查袭击、事件、垂钓专属和世界树帕鲁，确认来源类型没有混入
`wild_*`。

## 禁止的更新方式

- 只执行 Supabase SQL：不会改变 GitHub Pages 静态数据。
- 只修改 `public/data/runtime/planner-core.json`：下次构建会被覆盖。
- 只修改 `public/data/breeding-data.json`：修正没有进入持久来源层。
- 只确认 GitHub Actions 成功：构建成功不等于页面业务数据正确，仍须查看线上弹窗。
- 用普通刷新前的旧标签页判断部署结果：旧页面进程可能仍持有内存中的旧数据。

## 发布后的故障定位顺序

如果线上仍显示旧数据，按以下顺序检查：

1. `npm run data:inspect -- <pal_id>` 是否同步；
2. GitHub Actions 是否由最新 commit 触发并部署成功；
3. 线上页面加载的静态数据 URL 是否包含 `?v=<最新 commit>`；
4. 刷新页面后重新打开图鉴弹窗；
5. 最后才检查 CDN 或浏览器缓存，不要先去修改 Supabase。

GitHub Pages 工作流在每次构建时还会再次执行 `build:runtime-data`，因此最终部署以
提交中的静态源数据和修正层为准。工作流同时把 Git commit SHA 写入
`NEXT_PUBLIC_DATA_VERSION`；浏览器会用 `?v=<commit>` 请求静态 JSON，并进行缓存
校验，避免文件名不变时继续使用上一次部署的旧快照。
