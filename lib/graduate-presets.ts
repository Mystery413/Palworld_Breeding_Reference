export type GraduatePresetGroup = "base" | "combat" | "mount";

export type GraduatePalCandidate = {
  palId: string;
  rank: number;
  stage: "开荒" | "中期" | "后期" | "终局";
  stats: string;
  note: string;
  passives?: string[];
};

export type GraduatePreset = {
  id: string;
  group: GraduatePresetGroup;
  icon: string;
  workIcon?: string;
  title: string;
  eyebrow: string;
  summary: string;
  defaultPassives: string[];
  passiveNote: string;
  candidates: GraduatePalCandidate[];
};

export type GraduatePassiveAlternative = {
  passive: string;
  replaces: string;
  label: string;
  note: string;
};

const WORK = ["恶魔之手", "卓绝技艺", "工匠精神", "社畜"];
const NIGHT_WORK = ["恶魔之手", "卓绝技艺", "工匠精神", "不眠"];
const TRANSPORT = ["卓绝技艺", "工匠精神", "神速", "不眠"];
const RANCH = ["牧场之主", "卓绝技艺", "工匠精神", "社畜"];
const SPEED = ["次元跳跃", "神速", "传说", "运动健将"];
const WATER_SPEED = ["次元跳跃", "破浪王者", "游泳健将", "神速"];
const WATER_ENDURANCE = ["破浪王者", "游泳健将", "神速", "永动机"];
const GLIDER = ["神速", "运动健将", "灵活", "永动机"];

const WORK_ALTERNATIVES: GraduatePassiveAlternative[] = [
  { passive: "认真", replaces: "恶魔之手", label: "稳定降级", note: "工作速度 +20%；不需要世界树词条，也没有额外 SAN 压力。" },
  { passive: "稀有", replaces: "恶魔之手", label: "泛用降级", note: "工作速度 +20%，同时兼顾战斗面板。" },
  { passive: "认真", replaces: "社畜", label: "无减攻替代", note: "工作速度比社畜低 10%，但不会降低攻击。" },
];

const NIGHT_WORK_ALTERNATIVES: GraduatePassiveAlternative[] = [
  { passive: "社畜", replaces: "恶魔之手", label: "白班高效", note: "工作速度 +30%；放弃世界树词条，但保留不眠的全天工作能力。" },
  { passive: "认真", replaces: "恶魔之手", label: "稳定降级", note: "工作速度 +20%；容易并入旧配种链且没有 SAN 副作用。" },
  { passive: "社畜", replaces: "不眠", label: "只做白班", note: "如果夜间停工可以接受，用额外工作速度换掉全天在线。" },
];

const TRANSPORT_ALTERNATIVES: GraduatePassiveAlternative[] = [
  { passive: "运动健将", replaces: "卓绝技艺", label: "偏移动", note: "移动速度 +20%；牺牲装卸工作速度，适合动线较长的仓储。" },
  { passive: "灵活", replaces: "工匠精神", label: "易得速度", note: "移动速度 +10%；成本低，适合中期物流帕鲁。" },
  { passive: "社畜", replaces: "不眠", label: "白班装卸", note: "夜间允许休息时，用工作速度换取更快的拾取与装卸。" },
];

const RANCH_ALTERNATIVES: GraduatePassiveAlternative[] = [
  { passive: "牧场之子", replaces: "牧场之主", label: "等级降级", note: "放牧适应性 +1；比牧场之主少一级，但更容易先做成可用个体。" },
  { passive: "认真", replaces: "卓绝技艺", label: "低成本产出", note: "工作速度 +20%；保留稳定增益，大幅降低稀有词条门槛。" },
  { passive: "不眠", replaces: "社畜", label: "全天放牧", note: "用白天工作速度换取非暗属性帕鲁夜间继续产出。" },
];

export const GRADUATE_PRESET_GROUPS: Array<{ id: GraduatePresetGroup; label: string; short: string }> = [
  { id: "base", label: "据点专家", short: "12 类生产岗位" },
  { id: "combat", label: "战斗主力", short: "输出与前排" },
  { id: "mount", label: "探索坐骑", short: "1.0 海陆空实际速度榜" },
];

export const GRADUATE_PRESETS: GraduatePreset[] = [
  {
    id: "kindling", group: "base", icon: "火", workIcon: "00", title: "生火", eyebrow: "KINDLING",
    summary: "熔炼与料理的固定工位专家，优先单项工作等级。",
    defaultPassives: WORK, passiveNote: "最高工作速度模板；使用恶魔之手时请配套优质食物、床与温泉。",
    candidates: [
      { palId: "183:0", rank: 1, stage: "终局", stats: "生火 Lv.8", note: "1.0 自然生火天花板" },
      { palId: "176:0", rank: 2, stage: "终局", stats: "生火 Lv.7", note: "兼顾高等级手工作业" },
      { palId: "121:1", rank: 3, stage: "中期", stats: "生火 Lv.7", note: "可配种，适合作为长期主力" },
      { palId: "137:1", rank: 4, stage: "后期", stats: "生火 Lv.6", note: "战斗、采矿、生火多用" },
      { palId: "188:0", rank: 5, stage: "中期", stats: "生火 Lv.6", note: "兼飞行与搬运" },
      { palId: "64:0", rank: 6, stage: "开荒", stats: "生火 Lv.2", note: "早期易抓的过渡选择" },
    ],
  },
  {
    id: "watering", group: "base", icon: "水", workIcon: "01", title: "浇水", eyebrow: "WATERING",
    summary: "磨粉、农田与流水线的持续岗位，夜间不停工更实用。",
    defaultPassives: NIGHT_WORK, passiveNote: "默认采用非暗属性夜班模板；若只在白天工作，可把不眠换回社畜。",
    candidates: [
      { palId: "192:0", rank: 1, stage: "终局", stats: "浇水 Lv.8", note: "1.0 浇水天花板" },
      { palId: "121:0", rank: 2, stage: "中期", stats: "浇水 Lv.7", note: "可较早配种，性价比极高" },
      { palId: "201:0", rank: 3, stage: "后期", stats: "浇水 Lv.7", note: "兼强力战斗与水上骑乘" },
      { palId: "188:1", rank: 4, stage: "后期", stats: "浇水 Lv.6", note: "兼搬运，适合农场流水线" },
      { palId: "97:0", rank: 5, stage: "中期", stats: "浇水 Lv.5", note: "同时是高速水上坐骑" },
      { palId: "17:0", rank: 6, stage: "开荒", stats: "浇水 Lv.1", note: "开局即可承担浇水与磨粉" },
    ],
  },
  {
    id: "planting", group: "base", icon: "芽", workIcon: "02", title: "播种", eyebrow: "PLANTING",
    summary: "大型农场的播种专家，综合型帕鲁需要锁定工作优先级。",
    defaultPassives: WORK, passiveNote: "固定工位生产模板；大型农场可另放花丽娜提供播种光环。",
    candidates: [
      { palId: "194:0", rank: 1, stage: "终局", stats: "播种 Lv.8", note: "1.0 播种天花板" },
      { palId: "186:0", rank: 2, stage: "后期", stats: "播种 Lv.7", note: "播种、采集、制药均强" },
      { palId: "175:0", rank: 3, stage: "后期", stats: "播种 Lv.7", note: "高播种并兼顾浇水" },
      { palId: "193:0", rank: 4, stage: "终局", stats: "播种 Lv.6", note: "适合综合型农药基地" },
      { palId: "108:0", rank: 5, stage: "中期", stats: "播种 Lv.5", note: "中前期可得的稳定主力" },
      { palId: "89:0", rank: 6, stage: "中期", stats: "播种 Lv.4", note: "稳定替代并可提供据点光环" },
    ],
  },
  {
    id: "electricity", group: "base", icon: "电", workIcon: "03", title: "发电", eyebrow: "ELECTRICITY",
    summary: "为高耗电流水线提供稳定电力，优先高等级固定工位。",
    defaultPassives: WORK, passiveNote: "固定工位生产模板；高耗电基地可用电汪汪提供发电光环。",
    candidates: [
      { palId: "187:0", rank: 1, stage: "终局", stats: "发电 Lv.8", note: "1.0 发电天花板" },
      { palId: "169:1", rank: 2, stage: "后期", stats: "发电 Lv.6", note: "兼顾水上工作" },
      { palId: "161:0", rank: 3, stage: "后期", stats: "发电 Lv.5", note: "中后期稳定主力" },
      { palId: "185:0", rank: 4, stage: "中期", stats: "发电 Lv.5", note: "获取路径清晰但体型较大" },
      { palId: "163:1", rank: 5, stage: "中期", stats: "发电 Lv.4", note: "适合紧凑据点" },
      { palId: "42:0", rank: 6, stage: "开荒", stats: "发电 Lv.1", note: "开局低耗电基地首选" },
    ],
  },
  {
    id: "handiwork", group: "base", icon: "工", workIcon: "04", title: "手工作业", eyebrow: "HANDIWORK",
    summary: "流水线制造岗位，同时兼顾体型、寻路与配种难度。",
    defaultPassives: WORK, passiveNote: "固定工位生产模板；重视寻路与体型时，阿努比斯往往更省心。",
    candidates: [
      { palId: "182:0", rank: 1, stage: "终局", stats: "手工 Lv.8", note: "1.0 制造天花板" },
      { palId: "190:0", rank: 2, stage: "终局", stats: "手工 Lv.7", note: "兼顾战斗与骑乘" },
      { palId: "139:0", rank: 3, stage: "中期", stats: "手工 Lv.6", note: "可配种、体型小、寻路好" },
      { palId: "153:0", rank: 4, stage: "中期", stats: "手工 Lv.6", note: "兼制药与伐木" },
      { palId: "186:0", rank: 5, stage: "后期", stats: "手工 Lv.5", note: "农业基地的综合制造位" },
      { palId: "152:0", rank: 6, stage: "中期", stats: "手工 Lv.5", note: "可配种的多面手" },
    ],
  },
  {
    id: "gathering", group: "base", icon: "收", workIcon: "05", title: "采集", eyebrow: "GATHERING",
    summary: "农田采收岗位，夜间工作能力会直接影响完整生产周期。",
    defaultPassives: NIGHT_WORK, passiveNote: "非暗属性默认采用夜班模板；选择唤夜兽时会自动换为最高速模板。",
    candidates: [
      { palId: "200:1", rank: 1, stage: "后期", stats: "采集 Lv.7", note: "暗属性，夜间不停工", passives: WORK },
      { palId: "197:0", rank: 2, stage: "终局", stats: "采集 Lv.7", note: "兼高伐木与顶级陆地骑乘" },
      { palId: "186:0", rank: 3, stage: "后期", stats: "采集 Lv.6", note: "播种采集闭环，需锁工作" },
      { palId: "110:0", rank: 4, stage: "中期", stats: "采集 Lv.5", note: "中期农场采收位" },
      { palId: "152:0", rank: 5, stage: "中期", stats: "采集 Lv.5", note: "体型适中、可配种、多功能" },
      { palId: "23:0", rank: 6, stage: "开荒", stats: "采集 Lv.1", note: "开局即可使用" },
    ],
  },
  {
    id: "lumbering", group: "base", icon: "木", workIcon: "06", title: "伐木", eyebrow: "LUMBERING",
    summary: "木材基地的专职岗位，高等级与稳定寻路同样重要。",
    defaultPassives: WORK, passiveNote: "固定工位生产模板；织夜鹿为暗属性，无需额外配置不眠。",
    candidates: [
      { palId: "157:1", rank: 1, stage: "终局", stats: "伐木 Lv.8", note: "1.0 天花板且夜间工作" },
      { palId: "157:0", rank: 2, stage: "终局", stats: "伐木 Lv.7", note: "终局高效专精" },
      { palId: "197:0", rank: 3, stage: "终局", stats: "伐木 Lv.7", note: "兼采集与顶级陆地骑乘" },
      { palId: "134:0", rank: 4, stage: "中期", stats: "伐木 Lv.5", note: "兼高搬运" },
      { palId: "134:1", rank: 5, stage: "中期", stats: "伐木 Lv.5", note: "可配种，兼搬运与手工" },
      { palId: "32:0", rank: 6, stage: "开荒", stats: "伐木 Lv.2", note: "早期易抓的木材专员" },
    ],
  },
  {
    id: "mining", group: "base", icon: "矿", workIcon: "07", title: "采矿", eyebrow: "MINING",
    summary: "矿石流水线核心，终局专家与现实可得性需要平衡。",
    defaultPassives: WORK, passiveNote: "固定工位生产模板；不攻克世界树时，魔渊龙与泰锋是长期答案。",
    candidates: [
      { palId: "184:0", rank: 1, stage: "终局", stats: "采矿 Lv.8", note: "1.0 自然采矿天花板" },
      { palId: "158:0", rank: 2, stage: "中期", stats: "采矿 Lv.7", note: "可配种且夜间工作" },
      { palId: "137:0", rank: 3, stage: "后期", stats: "采矿 Lv.7", note: "兼生火，适合熔炼基地" },
      { palId: "159:0", rank: 4, stage: "中期", stats: "采矿 Lv.7", note: "兼搬运，流水线顺手" },
      { palId: "159:1", rank: 5, stage: "后期", stats: "采矿 Lv.7", note: "兼生火与搬运" },
      { palId: "107:0", rank: 6, stage: "中期", stats: "采矿 Lv.4", note: "矿点与据点过渡都好用" },
    ],
  },
  {
    id: "medicine", group: "base", icon: "药", workIcon: "08", title: "制药", eyebrow: "MEDICINE",
    summary: "非高频但关键的生产岗位，可优先考虑兼任能力。",
    defaultPassives: WORK, passiveNote: "固定工位生产模板；制药空闲时，综合型帕鲁能继续承担其他工作。",
    candidates: [
      { palId: "193:0", rank: 1, stage: "终局", stats: "制药 Lv.8", note: "1.0 制药天花板" },
      { palId: "195:1", rank: 2, stage: "后期", stats: "制药 Lv.7", note: "强战斗兼制药，成本较高" },
      { palId: "194:0", rank: 3, stage: "终局", stats: "制药 Lv.6", note: "播种主力兼制药" },
      { palId: "195:0", rank: 4, stage: "后期", stats: "制药 Lv.5", note: "团本孵化获取" },
      { palId: "186:0", rank: 5, stage: "后期", stats: "制药 Lv.5", note: "农业基地综合实用" },
      { palId: "66:0", rank: 6, stage: "中期", stats: "制药 Lv.3", note: "中期较容易获得" },
    ],
  },
  {
    id: "cooling", group: "base", icon: "冰", workIcon: "10", title: "冷却", eyebrow: "COOLING",
    summary: "冰箱等持续在线岗位，夜间不停工的收益尤其高。",
    defaultPassives: NIGHT_WORK, passiveNote: "默认采用非暗属性夜班模板，确保冰箱与流水线全天在线。",
    candidates: [
      { palId: "191:0", rank: 1, stage: "终局", stats: "冷却 Lv.8", note: "1.0 冷却天花板" },
      { palId: "200:0", rank: 2, stage: "后期", stats: "冷却 Lv.7", note: "传奇战斗兼冷却" },
      { palId: "151:0", rank: 3, stage: "后期", stats: "冷却 Lv.6", note: "中后期稳定主力" },
      { palId: "134:0", rank: 4, stage: "中期", stats: "冷却 Lv.5", note: "兼伐木与搬运" },
      { palId: "95:0", rank: 5, stage: "中期", stats: "冷却 Lv.4", note: "体型小，容易摆放" },
      { palId: "17:0", rank: 6, stage: "开荒", stats: "冷却 Lv.1", note: "开局冰箱过渡" },
    ],
  },
  {
    id: "transporting", group: "base", icon: "运", workIcon: "11", title: "搬运", eyebrow: "TRANSPORTING",
    summary: "物流岗位同时受工作等级、移动速度、体型与动线影响。",
    defaultPassives: TRANSPORT, passiveNote: "兼顾工作效率、移动速度与夜班；紧凑布局往往比纸面等级更重要。",
    candidates: [
      { palId: "159:0", rank: 1, stage: "中期", stats: "搬运 Lv.7", note: "并列最高，兼采矿" },
      { palId: "159:1", rank: 2, stage: "后期", stats: "搬运 Lv.7", note: "兼采矿与生火" },
      { palId: "171:0", rank: 3, stage: "后期", stats: "搬运 Lv.6", note: "高速飞行，终局物流强" },
      { palId: "134:0", rank: 4, stage: "中期", stats: "搬运 Lv.6", note: "伐木基地经典物流位" },
      { palId: "134:1", rank: 5, stage: "中期", stats: "搬运 Lv.6", note: "可配种，兼伐木与手工" },
      { palId: "80:0", rank: 6, stage: "中期", stats: "搬运 Lv.4", note: "暗属性，夜间不停工" },
    ],
  },
  {
    id: "farming", group: "base", icon: "牧", workIcon: "12", title: "放牧", eyebrow: "FARMING",
    summary: "先按所需掉落选择物种，不同物资之间没有绝对替代关系。",
    defaultPassives: RANCH, passiveNote: "牧场之主与工作速度共同提高产出节奏；夜班需求可将社畜换为不眠。",
    candidates: [
      { palId: "109:1", rank: 1, stage: "后期", stats: "优质帕鲁油", note: "放牧 Lv.4，终局工业消耗大" },
      { palId: "116:1", rank: 2, stage: "后期", stats: "优质布", note: "放牧 Lv.4，终局装备物资" },
      { palId: "6:0", rank: 3, stage: "开荒", stats: "金币 / 箭 / 帕鲁球", note: "开荒综合价值最高" },
      { palId: "67:0", rank: 4, stage: "中期", stats: "蜂蜜", note: "配种蛋糕刚需" },
      { palId: "3:0", rank: 5, stage: "开荒", stats: "蛋", note: "蛋糕与食物生产核心" },
      { palId: "40:0", rank: 6, stage: "开荒", stats: "牛奶", note: "蛋糕与高级料理核心" },
      { palId: "25:0", rank: 7, stage: "开荒", stats: "火焰器官", note: "自动补充器官素材" },
    ],
  },
  {
    id: "pve", group: "combat", icon: "战", title: "泛用 PvE / Boss 攻坚", eyebrow: "COMBAT",
    summary: "综合面板、技能池、属性覆盖与获取成本的主战选择。",
    defaultPassives: ["沉着冷静", "破坏神", "不死之身", "神龙"], passiveNote: "默认稳定攻坚模板；最后一个词条会随所选帕鲁自动换成对应属性增伤。",
    candidates: [
      { palId: "192:0", rank: 1, stage: "终局", stats: "龙 / 水", note: "1.0 顶级综合输出", passives: ["沉着冷静", "破坏神", "不死之身", "神龙"] },
      { palId: "200:1", rank: 2, stage: "后期", stats: "暗", note: "高攻击、飞行，可配种", passives: ["沉着冷静", "破坏神", "不死之身", "冥王"] },
      { palId: "200:0", rank: 3, stage: "后期", stats: "冰", note: "高面板飞行攻坚", passives: ["沉着冷静", "破坏神", "不死之身", "冰帝"] },
      { palId: "199:0", rank: 4, stage: "后期", stats: "暗", note: "高攻高机动", passives: ["沉着冷静", "破坏神", "不死之身", "冥王"] },
      { palId: "201:0", rank: 5, stage: "后期", stats: "水", note: "伙伴技能追击优秀", passives: ["沉着冷静", "破坏神", "不死之身", "海皇"] },
      { palId: "195:1", rank: 6, stage: "后期", stats: "暗", note: "高成长与强力专属技能", passives: ["沉着冷静", "破坏神", "不死之身", "冥王"] },
      { palId: "121:1", rank: 7, stage: "中期", stats: "龙 / 火", note: "可提前配种获得", passives: ["沉着冷静", "破坏神", "不死之身", "炎帝"] },
      { palId: "139:0", rank: 8, stage: "中期", stats: "地", note: "灵活动作，开荒到后期都能用", passives: ["沉着冷静", "破坏神", "不死之身", "岩帝"] },
    ],
  },
  {
    id: "tank", group: "combat", icon: "盾", title: "坦克 / 高容错前排", eyebrow: "SURVIVAL",
    summary: "面向陌生 Boss 与开荒容错，优先防御、续航与稳定输出。",
    defaultPassives: ["金刚之躯", "不死之身", "传说", "沉着冷静"], passiveNote: "每只候选帕鲁都带有指南对应的专属四词条方案，选中后仍可自由编辑。",
    candidates: [
      { palId: "203:0", rank: 1, stage: "终局", stats: "顶级防御 / 生命", note: "1.0 高容错首选", passives: ["金刚之躯", "不死之身", "传说", "沉着冷静"] },
      { palId: "197:0", rank: 2, stage: "终局", stats: "屏障 / 机动", note: "骑乘时提供强力屏障", passives: ["金刚之躯", "不死之身", "沉着冷静", "凶猛"] },
      { palId: "198:0", rank: 3, stage: "后期", stats: "高防 / 三段跳", note: "复杂地形体验好", passives: ["金刚之躯", "不死之身", "传说", "沉着冷静"] },
      { palId: "159:0", rank: 4, stage: "中期", stats: "伙伴技能增攻防", note: "进攻型高容错前排", passives: ["金刚之躯", "不死之身", "破坏神", "沉着冷静"] },
      { palId: "184:0", rank: 5, stage: "终局", stats: "龙 / 地重装", note: "兼终局采矿", passives: ["金刚之躯", "不死之身", "传说", "岩帝"] },
      { palId: "52:0", rank: 6, stage: "开荒", stats: "吸血续航", note: "早期容易获得", passives: ["不死之身", "沉着冷静", "凶猛", "脑筋"] },
    ],
  },
  {
    id: "flying", group: "mount", icon: "空", title: "飞行坐骑", eyebrow: "FLYING",
    summary: "严格按 1.0 基础飞行冲刺速度排名，不计词条、浓缩、队伍及条件加速；排名相同时按参考榜单顺序展示。",
    defaultPassives: SPEED, passiveNote: "毕业推荐为次元跳跃 + 神速 + 传说 + 运动健将（通用移速合计 +120%）；空涡龙等短耐力坐骑跑长途时，可将运动健将换成永动机。",
    candidates: [
      { palId: "202:0", rank: 1, stage: "终局", stats: "飞行冲刺 3300 · 耐力 110", note: "1.0 基础飞行速度第一，最终毕业选择" },
      { palId: "203:0", rank: 2, stage: "终局", stats: "飞行冲刺 3000 · 耐力 100", note: "特殊方式骑乘，不走常规鞍具科技树" },
      { palId: "192:0", rank: 3, stage: "终局", stats: "飞行冲刺 2800 · 耐力 100", note: "科技 77 解锁，1.0 新高位飞行坐骑" },
      { palId: "171:0", rank: 4, stage: "后期", stats: "飞行冲刺 2750 · 耐力 130", note: "科技 68；暗 / 龙队伍条件下还能加速" },
      { palId: "171:1", rank: 5, stage: "终局", stats: "飞行冲刺 2750 · 耐力 130", note: "科技 76；火 / 龙版本，基础速度相同" },
      { palId: "196:0", rank: 6, stage: "后期", stats: "飞行冲刺 2700 · 耐力 300", note: "科技 66；浓缩伙伴技能还能提高骑乘速度" },
      { palId: "200:0", rank: 7, stage: "后期", stats: "飞行冲刺 1800 · 耐力 300", note: "科技 62；速度低于 1.0 新顶级坐骑，但续航稳定" },
      { palId: "200:1", rank: 8, stage: "后期", stats: "飞行冲刺 1800 · 耐力 300", note: "科技 62；与唤冬兽同速，暗属性版本" },
      { palId: "189:0", rank: 9, stage: "中期", stats: "飞行冲刺 1600 · 耐力 250", note: "科技 47；适合作为中后期过渡" },
      { palId: "190:0", rank: 10, stage: "中期", stats: "飞行冲刺 1600 · 耐力 300", note: "科技 53；与异构格里芬同速，耐力更高" },
      { palId: "124:0", rank: 11, stage: "中期", stats: "飞行冲刺 1400 · 耐力 220", note: "科技 38；中期较早可用的稳定选择" },
      { palId: "124:1", rank: 12, stage: "中期", stats: "飞行冲刺 1400 · 耐力 220", note: "科技 45；天羽龙草属性变种，同速" },
      { palId: "188:0", rank: 13, stage: "后期", stats: "飞行冲刺 1400 · 耐力 230", note: "科技 60；速度不再顶尖，但仍可兼顾战斗" },
      { palId: "188:1", rank: 14, stage: "后期", stats: "飞行冲刺 1400 · 耐力 230", note: "科技 60；荷鲁斯水属性变种，同速" },
      { palId: "177:0", rank: 15, stage: "终局", stats: "飞行冲刺 1350 · 耐力 200", note: "科技 72；解锁较晚，基础速度并非毕业档" },
    ],
  },
  {
    id: "ground", group: "mount", icon: "陆", title: "陆地坐骑", eyebrow: "GROUND",
    summary: "严格按 1.0 基础陆地冲刺速度排名，不计词条、浓缩、地形及昼夜加速；复杂地形需另外考虑耐力与跳跃能力。",
    defaultPassives: SPEED, passiveNote: "毕业推荐为次元跳跃 + 神速 + 传说 + 运动健将（通用移速合计 +120%）；长途可把运动健将换成永动机，跳跃特化再换入凌空微步。",
    candidates: [
      { palId: "197:0", rank: 1, stage: "终局", stats: "陆地冲刺 1900 · 耐力 400", note: "科技 70；同档速度中续航最高，陆地毕业首选" },
      { palId: "199:0", rank: 2, stage: "后期", stats: "陆地冲刺 1900 · 耐力 350", note: "科技 61；高速、高耐力并兼顾战斗" },
      { palId: "198:0", rank: 3, stage: "后期", stats: "陆地冲刺 1800 · 耐力 400", note: "科技 61；速度略低，但三段跳与续航更适合复杂地形" },
      { palId: "175:0", rank: 4, stage: "终局", stats: "陆地冲刺 1500 · 耐力 100", note: "科技 72；基础速度高，但耐力较短" },
      { palId: "93:0", rank: 5, stage: "中期", stats: "陆地冲刺 1300 · 耐力 100", note: "科技 29；中期非常强的速度跳点" },
      { palId: "93:1", rank: 6, stage: "中期", stats: "陆地冲刺 1300 · 耐力 100", note: "科技 34；火麒麟暗属性变种，同速" },
      { palId: "161:0", rank: 7, stage: "后期", stats: "陆地冲刺 1260 · 耐力 220", note: "科技 58；可空中冲刺，综合机动性出色" },
      { palId: "154:0", rank: 8, stage: "后期", stats: "陆地冲刺 1260 · 耐力 200", note: "科技 54；比驭雷马更早解锁" },
      { palId: "130:0", rank: 9, stage: "后期", stats: "陆地冲刺 1250 · 耐力 230", note: "科技 57；夜间伙伴技能可进一步提速" },
      { palId: "130:1", rank: 10, stage: "终局", stats: "陆地冲刺 1250 · 耐力 230", note: "科技 77；基础速度与夜冥驹相同，解锁更晚" },
      { palId: "123:0", rank: 11, stage: "中期", stats: "陆地冲刺 1200 · 耐力 100", note: "科技 28；砂地上可获得伙伴技能加速" },
      { palId: "112:0", rank: 12, stage: "中期", stats: "陆地冲刺 1200 · 耐力 150", note: "科技 33；与战冠雀同速，耐力更好" },
      { palId: "112:1", rank: 13, stage: "中期", stats: "陆地冲刺 1200 · 耐力 150", note: "科技 35；狱焰王暗属性变种，同速同耐力" },
      { palId: "146:0", rank: 14, stage: "中期", stats: "陆地冲刺 1200 · 耐力 250", note: "科技 41；1200 速度档中续航最突出" },
      { palId: "137:0", rank: 15, stage: "中期", stats: "陆地冲刺 1200 · 耐力 190", note: "科技 46；可兼顾战斗与据点用途" },
    ],
  },
  {
    id: "water-mount", group: "mount", icon: "海", title: "水上坐骑", eyebrow: "AQUATIC",
    summary: "严格按 1.0 水上冲刺（Swim Dash Speed）排名，不使用普通骑乘冲刺，也不计词条、浓缩和队伍条件加速。",
    defaultPassives: WATER_SPEED, passiveNote: "纯水毕业推荐为次元跳跃 + 破浪王者 + 游泳健将 + 神速；水陆两用时，可将两个水上专属词条换成传说、运动健将或永动机。",
    candidates: [
      { palId: "201:0", rank: 1, stage: "后期", stats: "水上冲刺 2000 · 耐力 410", note: "科技 64；1.0 基础水速与耐力双毕业" },
      { palId: "103:0", rank: 2, stage: "开荒", stats: "水上冲刺 1890 · 耐力 100", note: "科技 11；极早解锁且水冲速度仅次于海皇鲸", passives: ["神速", "运动健将", "永动机", "破浪王者"] },
      { palId: "121:0", rank: 3, stage: "中期", stats: "水上冲刺 1800 · 耐力 150", note: "科技 40；水陆两用并可兼顾战斗", passives: ["传说", "神速", "运动健将", "破浪王者"] },
      { palId: "75:0", rank: 4, stage: "开荒", stats: "水上冲刺 1440 · 耐力 100", note: "科技 16；容易获得的早期专业水上坐骑" },
      { palId: "63:1", rank: 5, stage: "中期", stats: "水上冲刺 1440 · 耐力 130", note: "科技 32；与滑水蛇同速，续航略好" },
      { palId: "97:0", rank: 6, stage: "中期", stats: "水上冲刺 1350 · 耐力 320", note: "科技 31；队伍条件加速潜力高", passives: WATER_ENDURANCE },
      { palId: "97:1", rank: 7, stage: "中期", stats: "水上冲刺 1350 · 耐力 320", note: "科技 42；火属性变种，同速同耐力", passives: WATER_ENDURANCE },
      { palId: "169:0", rank: 8, stage: "后期", stats: "水上冲刺 1300 · 耐力 220", note: "科技 65；解锁较晚，作为属性或外观选择" },
      { palId: "169:1", rank: 9, stage: "后期", stats: "水上冲刺 1300 · 耐力 220", note: "科技 66；曼波王雷属性变种，同速同耐力" },
      { palId: "41:0", rank: 10, stage: "中期", stats: "水上冲刺 1000 · 耐力 160", note: "科技 24；早中期可用，但水冲慢于疾旋鼬与滑水蛇" },
      { palId: "41:1", rank: 11, stage: "中期", stats: "水上冲刺 1000 · 耐力 160", note: "科技 27；碧海龙冰属性变种，同速同耐力" },
      { palId: "151:0", rank: 12, stage: "中期", stats: "水上冲刺 950 · 耐力 200", note: "科技 42；续航尚可，但基础水速偏慢" },
      { palId: "151:1", rank: 13, stage: "终局", stats: "水上冲刺 950 · 耐力 200", note: "科技 71；解锁很晚，不推荐作为主力竞速坐骑" },
    ],
  },
  {
    id: "glider", group: "mount", icon: "翔", title: "滑翔帕鲁", eyebrow: "GLIDER",
    summary: "滑翔性能更依赖物种与浓缩等级；毕业时优先满浓缩。",
    defaultPassives: GLIDER, passiveNote: "地面跑速词条未必等比例作用于滑翔，四词条可按你的日常用途调整。",
    candidates: [
      { palId: "49:0", rank: 1, stage: "中期", stats: "最快滑翔", note: "空中可使用武器" },
      { palId: "7:0", rank: 2, stage: "开荒", stats: "平稳滞空", note: "前期容易获得" },
      { palId: "7:1", rank: 3, stage: "中期", stats: "雷属性亚种", note: "鲁米儿的雷属性选择" },
      { palId: "30:0", rank: 4, stage: "开荒", stats: "缓慢下落", note: "适合垂直探索" },
      { palId: "30:1", rank: 5, stage: "后期", stats: "特殊亚种", note: "偏后期的滑翔选择" },
    ],
  },
];

export function graduatePassivesFor(preset: GraduatePreset, palId: string): string[] {
  return [...(preset.candidates.find((candidate) => candidate.palId === palId)?.passives ?? preset.defaultPassives)];
}

export function graduatePassiveAlternativesFor(preset: GraduatePreset, palId: string): GraduatePassiveAlternative[] {
  if (preset.group !== "base") return [];
  if (preset.id === "transporting") return TRANSPORT_ALTERNATIVES;
  if (preset.id === "farming") return RANCH_ALTERNATIVES;
  const selected = graduatePassivesFor(preset, palId);
  return selected.includes("不眠") ? NIGHT_WORK_ALTERNATIVES : WORK_ALTERNATIVES;
}
