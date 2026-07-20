# 帕鲁育种实验室

一个面向《幻兽帕鲁》1.0 的本地中文育种规划器。录入自己拥有的帕鲁个体、性别、被动词条和潜力值后，工具会遍历 44,486 条配种组合，推荐当前可达的强力目标，或为指定物种给出逐步育种路线。

## 功能

- 299 个 1.0 帕鲁条目及简体中文名
- 按物种、性别和被动词条计算可达图谱
- 支持库存与当前等级可挑战的野外种源混合规划，并分别计算普通野怪与 Alpha Boss 难度
- 默认最多显示四个实际配种步骤，可手动放宽到更多步骤
- 内置可缩放、可拖动的帕洛斯群岛与世界树地图、昼夜分布点、普通野生常见等级及 Boss 等级
- 帕鲁与词条选择支持中文名、英文名、编号和连续字符模糊搜索
- 内置 114 个 1.0 帕鲁被动词条供搜索，同时支持自定义录入
- 支持性别限定特殊配方
- 系统推荐与指定目标两种规划模式
- 按战斗、输出、据点和全能四种目标评分
- 每一步显示亲本、筛选词条、精确词条率和平均蛋数
- 库存在浏览器本地自动保存，支持 JSON 备份和 CSV 导入导出
- 生命、攻击、防御潜力值可随个体记录，供人工筛选

## 本地运行

需要 Node.js 22.13 或更高版本：

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。完整检查使用：

```bash
npm run check
```

## 数据更新

前端运行时数据由仓库根目录 CSV 与 `data/pal-metadata-1.0.json` 合并生成。更新栖息地快照后再构建浏览器数据：

```bash
python3 scripts/enrich_habitats.py
python3 scripts/build_dataset.py
```

生成文件位于 `public/data/breeding-data.json`。当前快照标记为 Palworld 1.0，导出日期为 2026-07-16；非 1.0 资料只有在与正式版更新说明或 1.0 数据交叉验证后才会写入规则说明。

## 规则边界

路线规划直接查 1.0 组合表，不用旧版配种力公式猜测结果。默认限制页面实际展示的配种步骤为四步，用户可以手动提高上限；允许补抓时，普通野生与 Alpha Boss 分别核验，常见野生等级高于“玩家当前等级＋8”的来源会被严格排除。常见等级取主要栖息点最集中的等级簇，排除世界树高等级点等离群值。可行来源会按等级计入路线成本，Alpha 额外增加难度惩罚。普通蛋糕的干净词条池概率按 1/2/3/4 个目标词条分别为 40%/24%/12%/10% 估算；功能蛋糕、突变和未公布倍率不会被伪装成精确概率。

详细依据见仓库根目录的 `PALWORLD_BREEDING_MECHANICS_1_0.md`。

## 数据来源

- [Palworld v1.0 官方更新说明（Steam）](https://store.steampowered.com/news/app/1623730/view/686383649529010623)
- [Palworld Wiki 配种机制](https://palworld.wiki.gg/wiki/Breeding)
- [PalDB 当前帕鲁数据](https://paldb.cc/en/Pals)
- [PalDB 1.0 栖息地图与分布数据](https://paldb.cc/cn/Palpagos_Islands)
- [PalDB 被动技能中文表](https://paldb.cc/cn/Passive_Skills)
- [Pal Breeding Calculator 1.0](https://palbreedingcalculator.org)

本项目是非官方玩家工具，与 Pocketpair 无隶属或背书关系。版本更新后请以游戏内结果为准。
