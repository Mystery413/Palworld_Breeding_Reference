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
  title: string;
  eyebrow: string;
  summary: string;
  defaultPassives: string[];
  passiveNote: string;
  candidates: GraduatePalCandidate[];
};

const WORK = ["恶魔之手", "卓绝技艺", "工匠精神", "社畜"];
const NIGHT_WORK = ["恶魔之手", "卓绝技艺", "工匠精神", "不眠"];
const TRANSPORT = ["卓绝技艺", "工匠精神", "神速", "不眠"];
const RANCH = ["牧场之主", "卓绝技艺", "工匠精神", "社畜"];
const SPEED = ["次元跳跃", "神速", "运动健将", "灵活"];
const ENDURANCE = ["次元跳跃", "神速", "运动健将", "永动机"];
const GLIDER = ["神速", "运动健将", "灵活", "永动机"];

export const GRADUATE_PRESET_GROUPS: Array<{ id: GraduatePresetGroup; label: string; short: string }> = [
  { id: "base", label: "据点专家", short: "12 类生产岗位" },
  { id: "combat", label: "战斗主力", short: "输出与前排" },
  { id: "mount", label: "探索坐骑", short: "飞行、陆地与水上" },
];

export const GRADUATE_PRESETS: GraduatePreset[] = [
  {
    id: "kindling", group: "base", icon: "火", title: "生火", eyebrow: "KINDLING",
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
    id: "watering", group: "base", icon: "水", title: "浇水", eyebrow: "WATERING",
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
    id: "planting", group: "base", icon: "芽", title: "播种", eyebrow: "PLANTING",
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
    id: "electricity", group: "base", icon: "电", title: "发电", eyebrow: "ELECTRICITY",
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
    id: "handiwork", group: "base", icon: "工", title: "手工作业", eyebrow: "HANDIWORK",
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
    id: "gathering", group: "base", icon: "收", title: "采集", eyebrow: "GATHERING",
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
    id: "lumbering", group: "base", icon: "木", title: "伐木", eyebrow: "LUMBERING",
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
    id: "mining", group: "base", icon: "矿", title: "采矿", eyebrow: "MINING",
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
    id: "medicine", group: "base", icon: "药", title: "制药", eyebrow: "MEDICINE",
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
    id: "cooling", group: "base", icon: "冰", title: "冷却", eyebrow: "COOLING",
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
    id: "transporting", group: "base", icon: "运", title: "搬运", eyebrow: "TRANSPORTING",
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
    id: "farming", group: "base", icon: "牧", title: "放牧", eyebrow: "FARMING",
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
    summary: "点对点速度与长途续航兼顾；体型、转向和鞍具等级也会影响体验。",
    defaultPassives: SPEED, passiveNote: "默认纯竞速模板；长途使用可将灵活换成永动机。",
    candidates: [
      { palId: "202:0", rank: 1, stage: "后期", stats: "冲刺 3300", note: "裸面板最快" },
      { palId: "203:0", rank: 2, stage: "终局", stats: "冲刺 3000", note: "高速且极耐打" },
      { palId: "192:0", rank: 3, stage: "终局", stats: "冲刺 2800", note: "可野外捕捉的顶级飞行坐骑" },
      { palId: "171:0", rank: 4, stage: "后期", stats: "冲刺 2750", note: "龙 / 暗队伍还能继续加速" },
      { palId: "171:1", rank: 5, stage: "终局", stats: "冲刺 2750", note: "火系队伍加速，兼战斗" },
      { palId: "200:0", rank: 6, stage: "后期", stats: "冲刺 1800", note: "耐力 300，长途稳定", passives: ENDURANCE },
      { palId: "96:0", rank: 7, stage: "中期", stats: "冲刺 1200", note: "中期优秀选择" },
      { palId: "51:0", rank: 8, stage: "开荒", stats: "冲刺 750", note: "最早期飞行过渡" },
    ],
  },
  {
    id: "ground", group: "mount", icon: "陆", title: "陆地坐骑", eyebrow: "GROUND",
    summary: "直线速度之外，复杂地形还要考虑耐力与跳跃能力。",
    defaultPassives: SPEED, passiveNote: "默认纯速度模板；长途可将灵活换成永动机。",
    candidates: [
      { palId: "199:0", rank: 1, stage: "后期", stats: "冲刺 1900", note: "高速、高耐力、高战力" },
      { palId: "197:0", rank: 2, stage: "终局", stats: "冲刺 1900", note: "耐力 400，综合更稳" },
      { palId: "198:0", rank: 3, stage: "后期", stats: "冲刺 1800", note: "三段跳，复杂地形优秀" },
      { palId: "175:0", rank: 4, stage: "后期", stats: "冲刺 1500", note: "速度高但耐力较低" },
      { palId: "93:0", rank: 5, stage: "中期", stats: "冲刺 1300", note: "中期高速选择" },
      { palId: "161:0", rank: 6, stage: "后期", stats: "冲刺 1260", note: "兼发电与战斗" },
      { palId: "98:0", rank: 7, stage: "中期", stats: "冲刺 1150", note: "双段跳，中期实用" },
      { palId: "33:0", rank: 8, stage: "开荒", stats: "冲刺 1050", note: "极早期即可获得" },
    ],
  },
  {
    id: "water-mount", group: "mount", icon: "海", title: "水上坐骑", eyebrow: "AQUATIC",
    summary: "跨海移动优先游泳速度；水上坐骑本身已能避免持续消耗耐力。",
    defaultPassives: ENDURANCE, passiveNote: "默认长途模板；永动机边际收益较低时，可按偏好换成灵活。",
    candidates: [
      { palId: "201:0", rank: 1, stage: "后期", stats: "游泳 1800", note: "1.0 水上速度天花板" },
      { palId: "97:0", rank: 2, stage: "中期", stats: "游泳 1200", note: "中期性价比最高" },
      { palId: "97:1", rank: 3, stage: "中期", stats: "游泳 1200", note: "火 / 水属性亚种" },
      { palId: "169:0", rank: 4, stage: "后期", stats: "游泳 1100", note: "耐力较好，兼浇水" },
      { palId: "169:1", rank: 5, stage: "后期", stats: "游泳 1100", note: "兼发电与水上移动" },
      { palId: "121:0", rank: 6, stage: "中期", stats: "游泳 1080", note: "可配种，浇水渡海两用" },
      { palId: "41:0", rank: 7, stage: "中期", stats: "游泳 920", note: "中前期易用" },
      { palId: "75:0", rank: 8, stage: "开荒", stats: "游泳 900", note: "最早期专业水上坐骑" },
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
