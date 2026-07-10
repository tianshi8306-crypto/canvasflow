//! 短剧分镜决策引擎：标签识别 → 景别/时长/运镜规则决策
//! 依据「短剧分镜决策识别清单」实现可执行的规则层（不依赖 LLM 做标签提取）

use super::script_parse::ScriptStyleProfile;
use super::script_parse_requirement::{bias_shot_size, CutProfile, ScriptParseRequirementHints};
use super::script_pipeline::{NarrativePurpose, Paragraph, ShotPlan};

// ──────────────── 标签结构 ────────────────

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum SpaceCategory {
    IndoorHome,
    IndoorOffice,
    IndoorCommercial,
    IndoorSpecial,
    Vehicle,
    OutdoorUrban,
    OutdoorNature,
    OutdoorResidential,
    OutdoorRoad,
    OutdoorSpecial,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum CharacterScale {
    Solo,
    Duo,
    Group,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum DialogueKind {
    Normal,
    Argument,
    Secret,
    PhoneOrVideo,
    VoiceOver,
    InnerMonologue,
    None,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ActionKind {
    Static,
    SimpleDynamic,
    ComplexDynamic,
    Detail,
    PropInteraction,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum RhythmKind {
    EstablishingSpace,
    AdvancingPlot,
    EmotionBuild,
    ClimaxBeat,
    Buffer,
    HookEnding,
    Flashback,
}

#[derive(Debug, Clone)]
pub(crate) struct ParagraphTags {
    pub space: SpaceCategory,
    pub space_detail: String,
    pub character_scale: CharacterScale,
    pub dialogue: DialogueKind,
    pub emotion: String,
    pub action: ActionKind,
    pub rhythm: RhythmKind,
    pub special_shot: Option<String>,
    pub genre_hints: Vec<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct ShotDecision {
    pub shot_size: String,
    pub camera_move: String,
    pub camera_angle: String,
    pub duration_sec: f64,
    pub sound_hint: String,
    pub edit_focus: String,
    pub composition_note: String,
    pub vertical_note: String,
}

// ──────────────── 关键词库 ────────────────

const INDOOR_HOME: &[&str] = &[
    "客厅", "卧室", "厨房", "餐厅", "阳台", "卫生间", "书房", "玄关", "衣帽间",
];
const INDOOR_OFFICE: &[&str] = &[
    "办公室", "会议室", "前台", "茶水间", "电梯间", "走廊", "写字楼",
];
const INDOOR_COMMERCIAL: &[&str] = &[
    "咖啡厅", "酒吧", "KTV", "商场", "超市", "健身房", "酒店", "餐厅",
];
const INDOOR_SPECIAL: &[&str] = &[
    "医院", "病房", "诊室", "教室", "审讯室", "法院", "监狱", "仓库", "地下室",
];
const VEHICLE: &[&str] = &[
    "车内", "车里", "轿车", "驾驶座", "副驾", "豪车", "出租", "公交车", "摩托",
];
const OUTDOOR_URBAN: &[&str] = &[
    "街道", "十字路口", "天桥", "停车场", "公交站", "地铁站", "广场",
];
const OUTDOOR_NATURE: &[&str] = &[
    "悬崖", "山顶", "河边", "湖边", "海边", "沙滩", "森林", "草地", "田野",
];
const OUTDOOR_RESIDENTIAL: &[&str] = &[
    "小区", "花园", "天台", "屋顶", "庭院", "别墅", "胡同",
];
const OUTDOOR_ROAD: &[&str] = &[
    "高速公路", "公路", "隧道", "桥梁", "加油站",
];
const OUTDOOR_SPECIAL: &[&str] = &[
    "宴会厅", "会所", "庄园", "游艇", "皇宫", "大殿", "冷宫", "废墟",
];

struct CompoundRule {
    label: &'static str,
    steps: &'static [&'static str],
    /// 至少命中一个触发词才拆解，避免「开车去上班」误拆
    triggers: &'static [&'static str],
}

const COMPOUND_RULES: &[CompoundRule] = &[
    CompoundRule {
        label: "打斗",
        steps: &["蓄力", "出招", "击中", "被击反应", "双方表情"],
        triggers: &["打斗", "格斗", "出拳", "挥拳", "踢", "交手", "搏斗", "切磋", "震退"],
    },
    CompoundRule {
        label: "起身离开",
        steps: &["站起", "转身", "走向门口", "拉开门", "走出", "关门"],
        triggers: &["起身离开", "转身离去", "走向门口", "拉开门", "推门而出"],
    },
    CompoundRule {
        label: "接吻",
        steps: &["靠近", "凝视", "嘴唇接触", "分开", "反应"],
        triggers: &["接吻", "亲吻", "吻上", "嘴唇贴近"],
    },
    CompoundRule {
        label: "摔倒",
        steps: &["失衡", "下落", "着地", "痛苦反应"],
        triggers: &["摔倒", "跌倒", "滑倒", "晕倒", "倒地"],
    },
    CompoundRule {
        label: "打电话",
        steps: &["拿出手机", "解锁", "放耳边", "等待接通", "说话"],
        triggers: &["拿出手机", "拨号", "放耳边", "接电话", "拨打电话"],
    },
    CompoundRule {
        label: "下跪",
        steps: &["站立", "屈膝", "跪地", "低头"],
        triggers: &["下跪", "跪地", "双膝", "跪下"],
    },
    CompoundRule {
        label: "泼水",
        steps: &["拿起", "扬起", "泼出", "被泼反应", "落点特写"],
        triggers: &["泼水", "泼向", "泼了一脸", "泼咖啡"],
    },
    CompoundRule {
        label: "掀桌",
        steps: &["眼神", "咬牙", "扫桌", "站起", "怒吼"],
        triggers: &["掀桌", "扫桌", "推翻桌子"],
    },
    CompoundRule {
        label: "壁咚",
        steps: &["走近", "撑墙", "俯身靠近", "对方反应"],
        triggers: &["壁咚", "撑墙", "按在墙上"],
    },
    CompoundRule {
        label: "驾车启动",
        steps: &["插钥匙", "引擎声", "挂挡", "车轮转动", "驶出"],
        triggers: &["发动汽车", "挂挡", "驶出", "踩油门", "引擎轰鸣", "方向盘"],
    },
    CompoundRule {
        label: "追逐",
        steps: &["前车急转", "后车跟拍", "并排", "撞击或超越"],
        triggers: &["飙车", "追逐", "紧追", "超车", "撞车"],
    },
];

const REACTION_TRIGGERS: &[&str] = &[
    "扇耳光", "一巴掌", "震惊", "愣住", "目瞪口呆", "摔杯", "泼水", "击打", "击倒", "愣在",
    "全场哗然", "不敢置信", "瞳孔一缩", "一口鲜血", "心动",
];

const GENRE_WARRIOR: &[&str] = &[
    "跪下", "认主", "打脸", "令牌", "玉佩", "一掌", "点穴", "神医", "战神", "赘婿",
];
const GENRE_CEO: &[&str] = &[
    "壁咚", "领带", "系袖口", "喂", "擦嘴", "总裁", "豪门",
];
const GENRE_SUSPENSE: &[&str] = &[
    "门缝", "黑屏", "镜中", "倒计时", "系统提示", "尸体", "密道",
];
const GENRE_PALACE: &[&str] = &[
    "娘娘", "皇上", "掌嘴", "罚跪", "请安", "叩首", "宫斗", "敬茶",
];
const GENRE_WORKPLACE: &[&str] = &[
    "辞职", "甩文件", "泼咖啡", "扇耳光", "加班", "PPT", "电梯",
];

// ──────────────── 标签识别 ────────────────

pub(crate) fn analyze_paragraph_tags(para: &Paragraph, char_count: usize) -> ParagraphTags {
    let text = &para.text;
    let (space, space_detail) = detect_space(text);
    let character_scale = if char_count >= 3 || contains_group_cue(text) {
        CharacterScale::Group
    } else if char_count == 2 || text.contains("两人") || text.contains("对视") {
        CharacterScale::Duo
    } else {
        CharacterScale::Solo
    };

    let dialogue = if !para.is_dialogue_block {
        if text.contains("画外音") || text.contains("旁白") || text.contains("（OS") {
            DialogueKind::VoiceOver
        } else if text.contains("心想") || text.contains("内心") || text.contains("心中") {
            DialogueKind::InnerMonologue
        } else {
            DialogueKind::None
        }
    } else if text.contains("os：") || text.contains("OS：") || text.contains("os:") || text.contains("OS:") {
        DialogueKind::InnerMonologue
    } else if text.contains("电话") || text.contains("视频通话") || text.contains("语音") {
        DialogueKind::PhoneOrVideo
    } else if is_argument_dialogue(text) {
        DialogueKind::Argument
    } else if text.contains("低声") || text.contains("悄悄") || text.contains("耳语") || text.contains("密谈") {
        DialogueKind::Secret
    } else {
        DialogueKind::Normal
    };

    let action = detect_action_kind(text, para.has_key_action);
    let emotion = if para.emotion.is_empty() {
        detect_emotion_extended(text)
    } else {
        para.emotion.clone()
    };

    let special_shot = detect_special_shot(text);
    let genre_hints = detect_genre_hints(text);

    ParagraphTags {
        space,
        space_detail,
        character_scale,
        dialogue,
        emotion,
        action,
        rhythm: RhythmKind::AdvancingPlot,
        special_shot,
        genre_hints,
    }
}

fn contains_group_cue(text: &str) -> bool {
    ["众人", "人群", "全场", "围观", "列队", "三人", "四人", "多人"]
        .iter()
        .any(|k| text.contains(k))
}

fn detect_space(text: &str) -> (SpaceCategory, String) {
    for kw in INDOOR_HOME {
        if text.contains(kw) {
            return (SpaceCategory::IndoorHome, kw.to_string());
        }
    }
    for kw in INDOOR_OFFICE {
        if text.contains(kw) {
            return (SpaceCategory::IndoorOffice, kw.to_string());
        }
    }
    for kw in INDOOR_COMMERCIAL {
        if text.contains(kw) {
            return (SpaceCategory::IndoorCommercial, kw.to_string());
        }
    }
    for kw in INDOOR_SPECIAL {
        if text.contains(kw) {
            return (SpaceCategory::IndoorSpecial, kw.to_string());
        }
    }
    for kw in VEHICLE {
        if text.contains(kw) {
            return (SpaceCategory::Vehicle, kw.to_string());
        }
    }
    for kw in OUTDOOR_URBAN {
        if text.contains(kw) {
            return (SpaceCategory::OutdoorUrban, kw.to_string());
        }
    }
    for kw in OUTDOOR_NATURE {
        if text.contains(kw) {
            return (SpaceCategory::OutdoorNature, kw.to_string());
        }
    }
    for kw in OUTDOOR_RESIDENTIAL {
        if text.contains(kw) {
            return (SpaceCategory::OutdoorResidential, kw.to_string());
        }
    }
    for kw in OUTDOOR_ROAD {
        if text.contains(kw) {
            return (SpaceCategory::OutdoorRoad, kw.to_string());
        }
    }
    for kw in OUTDOOR_SPECIAL {
        if text.contains(kw) {
            return (SpaceCategory::OutdoorSpecial, kw.to_string());
        }
    }
    if text.contains("室内") {
        return (SpaceCategory::IndoorHome, "室内".to_string());
    }
    if text.contains("室外") || text.contains("户外") {
        return (SpaceCategory::OutdoorUrban, "室外".to_string());
    }
    (SpaceCategory::Unknown, String::new())
}

fn is_argument_dialogue(text: &str) -> bool {
    let excl = text.matches('！').count() + text.matches('!').count();
    excl >= 2
        || text.contains("怒吼")
        || text.contains("咆哮")
        || text.contains("争吵")
        || text.contains("大骂")
}

fn detect_action_kind(text: &str, has_key_action: bool) -> ActionKind {
    let complex_kw = [
        "打斗", "格斗", "枪战", "追逐", "飙车", "撞车", "翻滚", "舞蹈",
    ];
    if complex_kw.iter().any(|k| text.contains(k)) {
        return ActionKind::ComplexDynamic;
    }
    let detail_kw = [
        "手指", "握拳", "眨眼", "咬牙", "舔", "咽", "拨头发", "系扣子",
        "看手机", "滑动", "签字", "摔手机",
    ];
    if detail_kw.iter().any(|k| text.contains(k)) {
        return ActionKind::Detail;
    }
    let prop_kw = [
        "手机", "文件", "合同", "酒杯", "刀", "枪", "钥匙", "戒指", "令牌",
    ];
    if prop_kw.iter().any(|k| text.contains(k)) {
        return ActionKind::PropInteraction;
    }
    if has_key_action {
        return ActionKind::SimpleDynamic;
    }
    let static_kw = ["凝视", "沉默", "闭眼", "坐着", "躺着", "倚靠", "昏迷"];
    if static_kw.iter().any(|k| text.contains(k)) {
        return ActionKind::Static;
    }
    ActionKind::Static
}

fn detect_emotion_extended(text: &str) -> String {
    if text.contains("愤怒") || text.contains("暴怒") || text.contains("怒吼") {
        return "愤怒".to_string();
    }
    if text.contains("悲伤") || text.contains("哭") || text.contains("泪") {
        return "悲伤".to_string();
    }
    if text.contains("恐惧") || text.contains("惊慌") || text.contains("害怕") {
        return "恐惧".to_string();
    }
    if text.contains("惊喜") || text.contains("震惊") || text.contains("愣") {
        return "惊讶".to_string();
    }
    if text.contains("甜") || text.contains("笑") || text.contains("开心") {
        return "喜悦".to_string();
    }
    String::new()
}

fn detect_special_shot(text: &str) -> Option<String> {
    if text.contains("主观") || text.contains("POV") || text.contains("第一人称") || text.contains("视角看去") {
        return Some("主观视角".to_string());
    }
    if text.contains("慢动作") || text.contains("慢镜") {
        return Some("慢动作".to_string());
    }
    if text.contains("定格") {
        return Some("定格".to_string());
    }
    if text.contains("黑场") || text.contains("黑屏") {
        return Some("黑场".to_string());
    }
    if text.contains("分屏") || text.contains("画中画") {
        return Some("分屏/画中画".to_string());
    }
    None
}

fn detect_genre_hints(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    if GENRE_WARRIOR.iter().any(|k| text.contains(k)) {
        out.push("战神/赘婿".to_string());
    }
    if GENRE_CEO.iter().any(|k| text.contains(k)) {
        out.push("霸总/甜宠".to_string());
    }
    if GENRE_SUSPENSE.iter().any(|k| text.contains(k)) {
        out.push("悬疑/惊悚".to_string());
    }
    if GENRE_PALACE.iter().any(|k| text.contains(k)) {
        out.push("古装/宫斗".to_string());
    }
    if GENRE_WORKPLACE.iter().any(|k| text.contains(k)) {
        out.push("职场".to_string());
    }
    out
}

// ──────────────── 决策树（分层覆盖，避免规则互相踩踏） ────────────────

pub(crate) struct DecideContext<'a> {
    pub is_scene_establishing: bool,
    pub is_last_in_sequence: bool,
    pub is_reaction_shot: bool,
    pub requirement: Option<&'a ScriptParseRequirementHints>,
}

pub(crate) fn decide_shot(
    tags: &ParagraphTags,
    purpose: &NarrativePurpose,
    dialogue_text: &str,
    context_text: &str,
    base_duration: f64,
    ctx: &DecideContext<'_>,
) -> ShotDecision {
    if ctx.is_reaction_shot {
        return ShotDecision {
            shot_size: "特写".to_string(),
            camera_move: "固定".to_string(),
            camera_angle: "平视".to_string(),
            duration_sec: base_duration.clamp(0.8, 2.5),
            sound_hint: "环境声或静默".to_string(),
            edit_focus: "反应镜头（承接上一镜）".to_string(),
            composition_note: "面部情绪为主，背景虚化".to_string(),
            vertical_note: "眼睛置于画面上1/3".to_string(),
        };
    }

    let mut d = ShotDecision {
        shot_size: "中近景".to_string(),
        camera_move: "固定".to_string(),
        camera_angle: "平视".to_string(),
        duration_sec: base_duration,
        sound_hint: "环境声".to_string(),
        edit_focus: "硬切".to_string(),
        composition_note: String::new(),
        vertical_note: "关键内容居中70%安全区".to_string(),
    };

    // 层 1：特殊镜头（最高优先级，黑场等不被建立镜覆盖）
    if let Some(ref special) = tags.special_shot {
        apply_special_shot_layer(&mut d, special);
        if special == "黑场" {
            return finalize_duration(d, tags);
        }
    }

    // 层 2：场次建立镜（每场第一镜，非全片第一镜）
    if ctx.is_scene_establishing || *purpose == NarrativePurpose::Establishing {
        d.shot_size = "全景".to_string();
        d.camera_move = "缓慢推".to_string();
        d.duration_sec = d.duration_sec.clamp(2.0, 3.5);
        d.edit_focus = "建立空间".to_string();
    }

    // 层 3：对话类型（覆盖默认景别，但不覆盖黑场）
    apply_dialogue_layer(&mut d, tags, dialogue_text);

    // 层 4：动作类型
    apply_action_layer(&mut d, tags);

    // 层 5：人物规模与竖屏构图
    apply_scale_layer(&mut d, tags);

    // 层 6：叙事目的微调
    if *purpose == NarrativePurpose::Turning {
        if !ctx.is_scene_establishing {
            d.shot_size = "特写".to_string();
            d.camera_move = "推（快）".to_string();
            d.duration_sec = d.duration_sec.clamp(1.0, 2.5);
            d.edit_focus = "情绪转折".to_string();
        }
    }
    if *purpose == NarrativePurpose::Closing || ctx.is_last_in_sequence {
        d.duration_sec = d.duration_sec.clamp(2.0, 3.5);
        if ctx.is_last_in_sequence {
            d.edit_focus = "悬念钩子/收束".to_string();
        }
    }

    // 层 7：空间特例
    if tags.space == SpaceCategory::Vehicle && !ctx.is_scene_establishing {
        let close_already = d.shot_size.contains("特写")
            || d.shot_size.contains("大特写")
            || d.shot_size.contains("主观");
        if !close_already {
            d.shot_size = if tags.character_scale == CharacterScale::Solo {
                "中近景（车内）".to_string()
            } else {
                "中景（车内）".to_string()
            };
        }
        d.camera_move = if d.camera_move == "固定" {
            "固定或手持（微）".to_string()
        } else {
            d.camera_move.clone()
        };
        d.vertical_note = "车内：面部与方向盘置于安全区".to_string();
    }

    if tags.rhythm == RhythmKind::Flashback {
        d.edit_focus = "叠化切".to_string();
        d.duration_sec = d.duration_sec.clamp(3.0, 6.0);
    }

  apply_genre_layer(&mut d, tags, context_text);

    apply_requirement_layer(&mut d, tags, ctx);

    finalize_duration(d, tags)
}

fn apply_requirement_layer(
    d: &mut ShotDecision,
    tags: &ParagraphTags,
    ctx: &DecideContext<'_>,
) {
    let Some(hints) = ctx.requirement else {
        return;
    };
    if d.shot_size.contains("黑场") || d.shot_size.contains("主观") {
        return;
    }
    if ctx.is_reaction_shot {
        return;
    }
    if ctx.is_scene_establishing {
        if hints.reduce_establishing_wides && d.shot_size.contains("全景") {
            d.shot_size = "中景".to_string();
            d.edit_focus = "紧凑建立（少用全景）".to_string();
        }
        return;
    }
    let has_emotion = !tags.emotion.is_empty()
        || tags.dialogue != DialogueKind::None
        || matches!(
            tags.rhythm,
            RhythmKind::ClimaxBeat | RhythmKind::HookEnding
        );
    d.shot_size = bias_shot_size(
        &d.shot_size,
        hints.shot_size_bias,
        hints.prefer_emotion_close_up,
        has_emotion,
    );
    if let Some(style) = hints.style_profile {
        apply_style_duration_profile(d, style, ctx.is_scene_establishing);
        apply_style_shot_profile(d, style, ctx, tags, hints);
    }
}

fn apply_style_shot_profile(
    d: &mut ShotDecision,
    style: ScriptStyleProfile,
    ctx: &DecideContext<'_>,
    tags: &ParagraphTags,
    hints: &ScriptParseRequirementHints,
) {
    if d.shot_size.contains("黑场") || d.shot_size.contains("主观") {
        return;
    }
    match style {
        ScriptStyleProfile::Film => {
            if ctx.is_scene_establishing && !hints.reduce_establishing_wides {
                d.shot_size = "全景".to_string();
                d.camera_move = "缓慢推".to_string();
                d.duration_sec = d.duration_sec.max(3.5);
                d.edit_focus = "建立空间（电影）".to_string();
            }
        }
        ScriptStyleProfile::Ad => {
            if matches!(
                tags.action,
                ActionKind::Detail | ActionKind::PropInteraction
            ) || tags.genre_hints.iter().any(|g| g.contains("产品"))
            {
                d.shot_size = "特写".to_string();
                d.edit_focus = "产品/卖点展示".to_string();
            }
        }
        ScriptStyleProfile::ShortDrama => {
            if ctx.is_last_in_sequence && !ctx.is_reaction_shot {
                d.edit_focus = "悬念钩子/卡点".to_string();
                d.duration_sec = d.duration_sec.clamp(1.5, 3.0);
            }
        }
        ScriptStyleProfile::Anime => {
            if tags.emotion == "愤怒" || tags.emotion == "喜悦" {
                d.shot_size = if d.shot_size.contains("特写") {
                    d.shot_size.clone()
                } else {
                    "近景".to_string()
                };
            }
        }
        ScriptStyleProfile::Auto => {}
    }
}

fn apply_style_duration_profile(
    d: &mut ShotDecision,
    style: ScriptStyleProfile,
    is_scene_establishing: bool,
) {
    match style {
        ScriptStyleProfile::Film => {
            let (min, max) = if is_scene_establishing { (3.0, 8.0) } else { (2.5, 6.0) };
            d.duration_sec = d.duration_sec.clamp(min, max);
        }
        ScriptStyleProfile::Ad => {
            d.duration_sec = d.duration_sec.clamp(1.0, 3.0);
        }
        ScriptStyleProfile::ShortDrama => {
            d.duration_sec = d.duration_sec.clamp(0.8, 3.5);
        }
        ScriptStyleProfile::Anime => {
            d.duration_sec = d.duration_sec.clamp(1.0, 4.0);
        }
        ScriptStyleProfile::Auto => {}
    }
}

fn apply_special_shot_layer(d: &mut ShotDecision, special: &str) {
    match special {
        "主观视角" => {
            d.shot_size = "主观视角".to_string();
            d.camera_move = "跟拍（主观）".to_string();
        }
        "慢动作" => {
            d.shot_size = "特写".to_string();
            d.edit_focus = "慢动作强调".to_string();
            d.duration_sec = d.duration_sec.max(1.5).min(3.0);
        }
        "定格" => {
            d.shot_size = "近景".to_string();
            d.edit_focus = "定格悬念".to_string();
            d.duration_sec = d.duration_sec.clamp(2.0, 3.0);
        }
        "黑场" => {
            d.shot_size = "黑场".to_string();
            d.camera_move = "无".to_string();
            d.duration_sec = 1.0;
            d.edit_focus = "黑场切".to_string();
            d.sound_hint = "静音或环境骤停".to_string();
        }
        "分屏/画中画" => {
            d.shot_size = "近景".to_string();
            d.edit_focus = "分屏/画中画".to_string();
        }
        _ => {}
    }
}

fn apply_dialogue_layer(d: &mut ShotDecision, tags: &ParagraphTags, dialogue_text: &str) {
    match tags.dialogue {
        DialogueKind::Argument => {
            d.shot_size = "近景".to_string();
            d.duration_sec = estimate_dialogue_duration(dialogue_text, 3.5).clamp(1.0, 3.0);
            d.edit_focus = "激烈对切".to_string();
        }
        DialogueKind::Secret => {
            d.shot_size = "大特写".to_string();
            d.duration_sec = estimate_dialogue_duration(dialogue_text, 2.5).clamp(2.0, 4.0);
        }
        DialogueKind::PhoneOrVideo => {
            d.shot_size = "近景".to_string();
            d.edit_focus = "分屏/画中画".to_string();
            d.sound_hint = "电话/电子音".to_string();
        }
        DialogueKind::InnerMonologue | DialogueKind::VoiceOver => {
            d.shot_size = "特写".to_string();
            d.camera_move = "缓慢推".to_string();
            d.sound_hint = "画外/内心".to_string();
        }
        DialogueKind::Normal => {
            if !dialogue_text.is_empty() {
                d.shot_size = "中近景".to_string();
                d.duration_sec = estimate_dialogue_duration(dialogue_text, 2.8);
            }
        }
        DialogueKind::None => {}
    }
}

fn apply_action_layer(d: &mut ShotDecision, tags: &ParagraphTags) {
    match tags.action {
        ActionKind::ComplexDynamic => {
            d.shot_size = "中景".to_string();
            d.camera_move = "跟拍（侧）".to_string();
            d.duration_sec = d.duration_sec.clamp(2.0, 4.0);
            d.edit_focus = "动接动".to_string();
        }
        ActionKind::SimpleDynamic => {
            if d.camera_move == "固定" {
                d.camera_move = "跟拍（后）".to_string();
            }
            d.duration_sec = d.duration_sec.clamp(1.5, 3.5);
        }
        ActionKind::Detail => {
            d.shot_size = "大特写".to_string();
            d.camera_move = "固定".to_string();
            d.duration_sec = d.duration_sec.clamp(1.0, 2.5);
        }
        ActionKind::PropInteraction => {
            d.shot_size = "特写".to_string();
            if d.sound_hint == "环境声" {
                d.sound_hint = "道具交互声".to_string();
            }
        }
        ActionKind::Static => {}
    }
}

fn apply_scale_layer(d: &mut ShotDecision, tags: &ParagraphTags) {
    match tags.character_scale {
        CharacterScale::Duo => {
            d.composition_note = "双人前后错位，前实后虚，避免左右并排".to_string();
            d.vertical_note = "竖屏双人：前后站位".to_string();
            if d.shot_size == "全景" {
                d.shot_size = "中景".to_string();
            }
        }
        CharacterScale::Group => {
            d.shot_size = "中景".to_string();
            if d.camera_move == "固定" {
                d.camera_move = "缓慢摇".to_string();
            }
            d.composition_note = "群像：中心人物清晰，背景虚化".to_string();
            d.vertical_note = "避免三人并排，采用前后或环绕".to_string();
        }
        CharacterScale::Solo => {
            if tags.emotion == "愤怒" || tags.emotion == "悲伤" {
                if d.shot_size == "中近景" || d.shot_size == "全景" {
                    d.shot_size = "特写".to_string();
                }
            }
        }
    }
}

fn apply_genre_layer(d: &mut ShotDecision, tags: &ParagraphTags, context_text: &str) {
    if context_text.contains("壁咚") {
        d.shot_size = "近景".to_string();
        d.camera_move = "推（慢）".to_string();
        d.camera_angle = "低机位仰拍".to_string();
    }
    if context_text.contains("跪") && tags.genre_hints.iter().any(|g| g.contains("战神")) {
        d.shot_size = if context_text.contains("令牌") || context_text.contains("玉佩") {
            "特写".to_string()
        } else {
            "全景".to_string()
        };
        d.edit_focus = "身份反转".to_string();
    }
}

fn finalize_duration(d: ShotDecision, tags: &ParagraphTags) -> ShotDecision {
    let mut duration = d.duration_sec;
    match tags.emotion.as_str() {
        "悲伤" | "绝望" => duration += 0.8,
        "愤怒" => duration -= 0.2,
        "紧张" | "恐惧" => duration += 0.4,
        _ => {}
    }
    ShotDecision {
        duration_sec: duration.clamp(0.8, 6.0),
        ..d
    }
}

fn find_compound_rule(text: &str) -> Option<&'static CompoundRule> {
    COMPOUND_RULES
        .iter()
        .find(|rule| rule.triggers.iter().any(|t| text.contains(t)))
}

fn estimate_dialogue_duration(dialogue: &str, chars_per_sec: f64) -> f64 {
    let chars = dialogue.chars().count() as f64;
    if chars == 0.0 {
        return 2.0;
    }
    (chars / chars_per_sec + 0.5).clamp(1.0, 6.0)
}

// ──────────────── 复合动作拆解 ────────────────

pub(crate) fn expand_compound_shots(shots: Vec<ShotPlan>) -> Vec<ShotPlan> {
    let mut out: Vec<ShotPlan> = Vec::new();

    for shot in shots {
        if shot.is_reaction_shot {
            out.push(shot);
            continue;
        }
        if let Some(rule) = find_compound_rule(&shot.text_segment) {
            let step_count = rule.steps.len() as f64;
            let per = (shot.estimated_duration_sec / step_count).max(0.8);
            for (i, step) in rule.steps.iter().enumerate() {
                let mut sub = shot.clone();
                sub.text_segment = format!(
                    "【{}-步骤{}：{}】{}",
                    rule.label,
                    i + 1,
                    step,
                    shot.text_segment.chars().take(120).collect::<String>()
                );
                sub.estimated_duration_sec = per;
                sub.is_compound_step = true;
                sub.is_scene_establishing = false;
                out.push(sub);
            }
        } else {
            out.push(shot);
        }
    }
    out
}

pub(crate) fn inject_reaction_shots(
    shots: Vec<ShotPlan>,
    boost_reactions: bool,
) -> Vec<ShotPlan> {
    let mut out: Vec<ShotPlan> = Vec::new();
    for shot in shots {
        out.push(shot.clone());
        if shot.is_compound_step || shot.is_reaction_shot {
            continue;
        }
        let trigger_hit = REACTION_TRIGGERS
            .iter()
            .any(|k| shot.text_segment.contains(k));
        let emotion_boost_hit = boost_reactions
            && !shot.dialogue_text.is_empty()
            && (shot.text_segment.contains('：')
                || shot.text_segment.contains("哭")
                || shot.text_segment.contains("怒")
                || shot.text_segment.contains("惊")
                || shot.text_segment.contains("愣"));
        if trigger_hit || emotion_boost_hit {
            let react_dur = (shot.estimated_duration_sec * 0.6).clamp(0.8, 2.5);
            let emotion = infer_reaction_emotion(&shot.text_segment);
            out.push(ShotPlan {
                text_segment: format!("【反应镜头】{}的表情反应", emotion),
                estimated_duration_sec: react_dur,
                narrative_purpose: shot.narrative_purpose.clone(),
                scene_index: shot.scene_index,
                scene_heading: shot.scene_heading.clone(),
                para_range: shot.para_range,
                is_reaction_shot: true,
                is_scene_establishing: false,
                ..ShotPlan::default()
            });
        }
    }
    out
}

fn infer_reaction_emotion(text: &str) -> String {
    if text.contains("扇") || text.contains("击打") {
        return "震惊、错愕".to_string();
    }
    if text.contains("泼水") || text.contains("摔") {
        return "愤怒或狼狈".to_string();
    }
    if text.contains("愣") || text.contains("目瞪口呆") {
        return "呆滞、不敢置信".to_string();
    }
    "听者/旁观者".to_string()
}

pub(crate) fn split_dialogue_shots(
    shots: Vec<ShotPlan>,
    paragraphs: &[Paragraph],
    cut: &CutProfile,
) -> Vec<ShotPlan> {
    let mut out: Vec<ShotPlan> = Vec::new();
    for shot in shots {
        let lines: Vec<String> = shot
            .dialogue_text
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty() && l.contains('：'))
            .map(String::from)
            .collect();
        let should_split = lines.len() >= cut.split_dialogue_min_lines
            && shot.characters_in_shot.len() >= 2
            && !shot.is_scene_establishing
            && shot.dialogue_text.chars().count() > cut.split_dialogue_char_min;
        if should_split {
            let per = (shot.estimated_duration_sec / lines.len() as f64).max(1.0);
            for line in lines {
                let speaker = line.split('：').next().unwrap_or("").trim().to_string();
                let performance_note =
                    super::script_pipeline::extract_performance_note(&line);
                let mut sub = shot.clone();
                sub.dialogue_text = line.clone();
                sub.text_segment = line;
                sub.characters_in_shot = if speaker.is_empty() {
                    shot.characters_in_shot.clone()
                } else {
                    vec![speaker]
                };
                sub.estimated_duration_sec = per;
                sub.is_scene_establishing = false;
                sub.performance_note = performance_note;
                out.push(sub);
            }
        } else {
            out.push(shot);
        }
    }
    // 保留 para_range 与 scene 元数据
    for s in &mut out {
        if s.scene_index == 0 && s.para_range.0 < paragraphs.len() {
            s.scene_index = paragraphs[s.para_range.0].scene_index;
            s.scene_heading = paragraphs[s.para_range.0].scene_heading.clone();
        }
    }
    out
}

pub(crate) fn split_overlong_shots(shots: Vec<ShotPlan>, cut: &CutProfile) -> Vec<ShotPlan> {
    let max_chars = cut.split_overlong_max_chars;
    let max_dur = cut.split_overlong_max_dur_sec;
    let mut out: Vec<ShotPlan> = Vec::new();
    for shot in shots {
        let too_long = shot.estimated_duration_sec > max_dur
            || shot.text_segment.chars().count() > max_chars;
        if !too_long || shot.is_compound_step || shot.is_reaction_shot {
            out.push(shot);
            continue;
        }
        let lines: Vec<String> = shot
            .text_segment
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .map(String::from)
            .collect();
        if lines.len() >= 2 {
            let per = (shot.estimated_duration_sec / lines.len() as f64).max(1.2);
            for line in lines {
                let mut sub = shot.clone();
                let is_dialogue = line.contains('：');
                sub.text_segment = line.clone();
                sub.dialogue_text = if is_dialogue {
                    line
                } else {
                    String::new()
                };
                sub.estimated_duration_sec = per;
                sub.is_scene_establishing = false;
                out.push(sub);
            }
        } else {
            out.push(shot);
        }
    }
    out
}

pub(crate) fn renumber_shots(shots: &mut [ShotPlan]) {
    for (i, shot) in shots.iter_mut().enumerate() {
        shot.serial = (i as i64) + 1;
    }
}

pub(crate) fn apply_decisions_to_shots(
    shots: &mut [ShotPlan],
    paragraphs: &[Paragraph],
    requirement: Option<&ScriptParseRequirementHints>,
) {
    let total = shots.len();
    for (idx, shot) in shots.iter_mut().enumerate() {
        let lo = shot.para_range.0.min(shot.para_range.1);
        let hi = shot.para_range.1.min(paragraphs.len());
        let para_slice = if lo < hi {
            &paragraphs[lo..hi]
        } else {
            &[]
        };

        let char_count = shot.characters_in_shot.len();
        let merged_text: String = para_slice
            .iter()
            .map(|p| p.text.as_str())
            .collect::<Vec<_>>()
            .join("\n");

        let mut tags = if let Some(p) = para_slice.first() {
            analyze_paragraph_tags(p, char_count.max(1))
        } else {
            analyze_paragraph_tags(
                &Paragraph {
                    text: shot.text_segment.clone(),
                    is_dialogue_block: !shot.dialogue_text.is_empty(),
                    speakers: shot.characters_in_shot.clone(),
                    emotion: String::new(),
                    has_key_action: false,
                    scene_index: shot.scene_index,
                    scene_heading: shot.scene_heading.clone(),
                    is_scene_header: false,
                },
                char_count.max(1),
            )
        };

        if merged_text.contains("闪回") || merged_text.contains("回忆") {
            tags.rhythm = RhythmKind::Flashback;
        }

        let ctx = DecideContext {
            is_scene_establishing: shot.is_scene_establishing,
            is_last_in_sequence: idx + 1 == total,
            is_reaction_shot: shot.is_reaction_shot,
            requirement,
        };
        let decision = decide_shot(
            &tags,
            &shot.narrative_purpose,
            &shot.dialogue_text,
            &merged_text,
            shot.estimated_duration_sec,
            &ctx,
        );

        shot.shot_size = decision.shot_size;
        shot.camera_move = decision.camera_move;
        shot.camera_angle = decision.camera_angle;
        shot.estimated_duration_sec = decision.duration_sec;
        shot.sound_hint = decision.sound_hint;
        shot.edit_focus = decision.edit_focus;
        shot.composition_note = decision.composition_note;
        shot.vertical_note = decision.vertical_note;
        if shot.scene_heading.is_empty() {
            shot.scene_heading = extract_scene_heading(&merged_text, &tags);
        }
        if let Some(p) = para_slice.first() {
            if !p.scene_heading.is_empty() {
                shot.scene_heading = p.scene_heading.clone();
            }
        }
        shot.rhythm_function = rhythm_label(&tags.rhythm, &shot.narrative_purpose);
        shot.tags_summary = format_tags_summary(&tags);
        shot.dialogue_type = dialogue_type_label(&tags.dialogue, &merged_text);
        if shot.performance_note.is_empty() {
            shot.performance_note =
                super::script_pipeline::extract_performance_note(&merged_text);
        }
        shot.bgm_hint = suggest_bgm_hint(&tags, &shot.narrative_purpose, &tags.emotion, &merged_text);
    }
}

/// 对白类型标签：对白 / OS / VO / 旁白 / 字幕
pub(crate) fn dialogue_type_label(kind: &DialogueKind, text: &str) -> String {
    let t = text.trim();
    if t.contains("字幕")
        || t.lines().any(|l| {
            let s = l.trim();
            s.starts_with("字幕") || s.starts_with("【字幕】")
        })
    {
        return "字幕".to_string();
    }
    if t.contains("旁白") {
        return "旁白".to_string();
    }
    match kind {
        DialogueKind::InnerMonologue => "OS".to_string(),
        DialogueKind::VoiceOver => "VO".to_string(),
        DialogueKind::Argument | DialogueKind::Secret | DialogueKind::PhoneOrVideo | DialogueKind::Normal => {
            if t.contains('：') || t.contains("os") || t.contains("OS") {
                "对白".to_string()
            } else {
                String::new()
            }
        }
        DialogueKind::None => String::new(),
    }
}

pub(crate) fn suggest_bgm_hint(
    tags: &ParagraphTags,
    purpose: &NarrativePurpose,
    emotion: &str,
    text: &str,
) -> String {
    if text.contains("飙车") || text.contains("追逐") || text.contains("紧追") {
        return "紧张追逐节拍".to_string();
    }
    if tags.action == ActionKind::ComplexDynamic {
        return "紧张追逐节拍".to_string();
    }
    if *purpose == NarrativePurpose::Closing || tags.rhythm == RhythmKind::HookEnding {
        return "悬念配乐渐强".to_string();
    }
    if *purpose == NarrativePurpose::Turning || tags.rhythm == RhythmKind::ClimaxBeat {
        return "高潮鼓点推高".to_string();
    }
    match emotion {
        "紧张" | "恐惧" => "悬疑低频铺底".to_string(),
        "悲伤" => "低沉弦乐".to_string(),
        "愤怒" => "激烈节奏".to_string(),
        "喜悦" => "轻快旋律".to_string(),
        "惊讶" => "突兀音效+短静音".to_string(),
        _ => {
            if tags.space == SpaceCategory::Vehicle {
                "车内环境+公路氛围".to_string()
            } else if tags.space == SpaceCategory::OutdoorNature {
                "自然氛围".to_string()
            } else {
                "叙事铺底（轻）".to_string()
            }
        }
    }
}

pub(crate) fn smooth_adjacent_shots(shots: &mut [ShotPlan]) {
    for i in 1..shots.len() {
        let prev_size = shots[i - 1].shot_size.clone();
        let prev_move = shots[i - 1].camera_move.clone();
        let prev_scene = shots[i - 1].scene_index;
        let prev_shot_size = shots[i - 1].shot_size.clone();
        let prev_dialogue = shots[i - 1].dialogue_text.clone();
        let curr = &mut shots[i];
        if prev_size.contains("全景") && curr.shot_size.contains("大特写") {
            curr.shot_size = "近景".to_string();
            if curr.edit_focus == "硬切" {
                curr.edit_focus = "景别过渡（全景→近景）".to_string();
            }
        }
        if prev_size.contains("黑场") {
            curr.edit_focus = "黑场后硬切".to_string();
        }
        if prev_move.contains("跟拍") && curr.camera_move.contains("跟拍") {
            if curr.edit_focus == "硬切" {
                curr.edit_focus = "动接动".to_string();
            }
        }
        if prev_scene == curr.scene_index
            && prev_shot_size == curr.shot_size
            && prev_dialogue.contains('：')
            && curr.dialogue_text.contains('：')
            && curr.edit_focus == "硬切"
        {
            curr.edit_focus = "对白对切".to_string();
        }
    }
}

pub(crate) fn format_shot_storyboard_block(
    plan: &ShotPlan,
    visual_desc: &str,
    dialogue: &str,
    lighting_mood: &str,
) -> String {
    let dialogue_line = if dialogue.trim().is_empty() {
        "无".to_string()
    } else {
        dialogue.trim().to_string()
    };
    let sound = if plan.sound_hint.is_empty() {
        "环境声".to_string()
    } else {
        plan.sound_hint.clone()
    };
    let heading = plan.scene_heading.trim();
    let mut block = if heading.is_empty() {
        String::new()
    } else {
        format!("场景：{}\n", heading)
    };
    block.push_str(&format!(
        "时长：{:.1}秒\n景别：{}\n画面：{}\n镜头运动：{}（{}）\n台词：{}\n声音：{}\n剪辑重点：{}",
        plan.estimated_duration_sec,
        plan.shot_size,
        visual_desc.trim(),
        plan.camera_move,
        plan.camera_angle,
        dialogue_line,
        sound,
        plan.edit_focus,
    ));
    if !lighting_mood.trim().is_empty() {
        block.push_str(&format!("\n光影：{}", lighting_mood.trim()));
    }
    if !plan.composition_note.is_empty() {
        block.push_str(&format!("\n构图：{}", plan.composition_note));
    }
    if !plan.vertical_note.is_empty() {
        block.push_str(&format!("\n竖屏：{}", plan.vertical_note));
    }
    if !plan.dialogue_type.is_empty() {
        block.push_str(&format!("\n对白类型：{}", plan.dialogue_type.trim()));
    }
    if !plan.performance_note.is_empty() {
        block.push_str(&format!("\n表演：{}", plan.performance_note.trim()));
    }
    if !plan.bgm_hint.is_empty() {
        block.push_str(&format!("\nBGM：{}", plan.bgm_hint.trim()));
    }
    block
}

fn rhythm_label(rhythm: &RhythmKind, purpose: &NarrativePurpose) -> String {
    if *purpose == NarrativePurpose::Establishing {
        return "建立空间".to_string();
    }
    if *purpose == NarrativePurpose::Turning {
        return "高潮/转折".to_string();
    }
    if *purpose == NarrativePurpose::Closing {
        return "悬念钩子".to_string();
    }
    match rhythm {
        RhythmKind::EstablishingSpace => "建立空间".to_string(),
        RhythmKind::EmotionBuild => "情绪铺垫".to_string(),
        RhythmKind::ClimaxBeat => "高潮爆点".to_string(),
        RhythmKind::Buffer => "缓冲过渡".to_string(),
        RhythmKind::HookEnding => "悬念钩子".to_string(),
        RhythmKind::Flashback => "回忆/闪回".to_string(),
        RhythmKind::AdvancingPlot => "推进剧情".to_string(),
    }
}

fn extract_scene_heading(text: &str, tags: &ParagraphTags) -> String {
    for line in text.lines() {
        let t = line.trim();
        if t.len() >= 3
            && t.chars().take(3).any(|c| c.is_ascii_digit())
            && (t.contains('内') || t.contains('外') || t.contains('日') || t.contains('夜'))
        {
            return t.chars().take(48).collect();
        }
    }
    if !tags.space_detail.is_empty() {
        return tags.space_detail.clone();
    }
    match tags.space {
        SpaceCategory::Vehicle => "车内".to_string(),
        SpaceCategory::IndoorOffice => "办公室".to_string(),
        SpaceCategory::OutdoorUrban => "街道".to_string(),
        _ => "场景".to_string(),
    }
}

fn format_tags_summary(tags: &ParagraphTags) -> String {
    format!(
        "空间:{} 人物:{:?} 对话:{:?} 动作:{:?} 情绪:{} 题材:{}",
        space_label(&tags.space),
        tags.character_scale,
        tags.dialogue,
        tags.action,
        tags.emotion,
        tags.genre_hints.join(",")
    )
}

fn space_label(space: &SpaceCategory) -> &'static str {
    match space {
        SpaceCategory::IndoorHome => "居家室内",
        SpaceCategory::IndoorOffice => "办公室内",
        SpaceCategory::IndoorCommercial => "商业室内",
        SpaceCategory::IndoorSpecial => "特殊室内",
        SpaceCategory::Vehicle => "车内",
        SpaceCategory::OutdoorUrban => "城市室外",
        SpaceCategory::OutdoorNature => "自然室外",
        SpaceCategory::OutdoorResidential => "居住区室外",
        SpaceCategory::OutdoorRoad => "道路室外",
        SpaceCategory::OutdoorSpecial => "特殊室外",
        SpaceCategory::Unknown => "未知",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compound_expand_fight() {
        let shot = ShotPlan {
            serial: 1,
            text_segment: "两人激烈打斗".to_string(),
            estimated_duration_sec: 5.0,
            ..ShotPlan::default()
        };
        let expanded = expand_compound_shots(vec![shot]);
        assert!(expanded.len() >= 4);
        assert!(expanded.iter().all(|s| s.is_compound_step));
    }

    #[test]
    fn test_detect_argument_dialogue() {
        let para = Paragraph {
            text: "张三：你给我滚！！李四：你算什么东西！！".to_string(),
            is_dialogue_block: true,
            speakers: vec!["张三".into(), "李四".into()],
            emotion: String::new(),
            has_key_action: false,
            scene_index: 1,
            scene_heading: String::new(),
            is_scene_header: false,
        };
        let tags = analyze_paragraph_tags(&para, 2);
        assert_eq!(tags.dialogue, DialogueKind::Argument);
    }

    #[test]
    fn test_vehicle_space() {
        let para = Paragraph {
            text: "豪车内，周雪双手紧握方向盘".to_string(),
            is_dialogue_block: false,
            speakers: vec![],
            emotion: String::new(),
            has_key_action: true,
            scene_index: 1,
            scene_heading: "1-1 日 内 豪车".to_string(),
            is_scene_header: false,
        };
        let tags = analyze_paragraph_tags(&para, 1);
        assert_eq!(tags.space, SpaceCategory::Vehicle);
    }

    #[test]
    fn test_compound_not_trigger_on_commute() {
        let shot = ShotPlan {
            text_segment: "他开车去上班，路上很堵。".to_string(),
            estimated_duration_sec: 3.0,
            ..ShotPlan::default()
        };
        let expanded = expand_compound_shots(vec![shot]);
        assert_eq!(expanded.len(), 1);
        assert!(!expanded[0].is_compound_step);
    }

    #[test]
    fn test_compound_trigger_on_drive_action() {
        let shot = ShotPlan {
            text_segment: "他挂挡踩油门，车子驶出车库。".to_string(),
            estimated_duration_sec: 4.0,
            ..ShotPlan::default()
        };
        let expanded = expand_compound_shots(vec![shot]);
        assert!(expanded.len() > 1);
    }

    #[test]
    fn test_reaction_injection() {
        let shot = ShotPlan {
            text_segment: "张三扇了李四一巴掌。".to_string(),
            estimated_duration_sec: 2.0,
            ..ShotPlan::default()
        };
        let with_react = inject_reaction_shots(vec![shot], false);
        assert_eq!(with_react.len(), 2);
        assert!(with_react[1].is_reaction_shot);
    }
}
