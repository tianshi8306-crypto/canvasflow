// ── 三阶段脚本解析管线：阶段 1+2（纯规则引擎，不调用 LLM）──
// 阶段 1：剧本理解 —— 角色提取、场景分段、情绪标注
// 阶段 2：分镜头设计 —— 基于拆分策略的镜头划分、时长估算、叙事目的标注

use std::collections::HashMap;

use super::script_decision::{
    apply_decisions_to_shots, expand_compound_shots, inject_reaction_shots,
    renumber_shots, smooth_adjacent_shots, split_dialogue_shots, split_overlong_shots,
};
use super::script_parse_requirement::{parse_episode_number_token, CutProfile};

// ──────────────── 阶段 1 数据结构 ────────────────

#[derive(Debug, Clone)]
pub(crate) struct CharacterInfo {
    pub(crate) name: String,
    pub(crate) shot_indices: Vec<usize>,
    pub(crate) description_hints: Vec<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct ScriptStructure {
    pub(crate) characters: HashMap<String, CharacterInfo>,
    pub(crate) paragraphs: Vec<Paragraph>,
    pub(crate) estimated_total_duration_sec: f64,
}

#[derive(Debug, Clone)]
pub(crate) struct Paragraph {
    pub(crate) text: String,
    pub(crate) is_dialogue_block: bool,
    pub(crate) speakers: Vec<String>,
    pub(crate) emotion: String,
    pub(crate) has_key_action: bool,
    /// 所属场次（从 1 起；0 表示未识别场号）
    pub(crate) scene_index: usize,
    /// 当前场次标题（如 1-1 日 内 客厅）
    pub(crate) scene_heading: String,
    /// 本段是否为场号头
    pub(crate) is_scene_header: bool,
}

// ──────────────── 阶段 2 数据结构 ────────────────

#[derive(Debug, Clone)]
pub(crate) struct ShotPlan {
    pub(crate) serial: i64,
    pub(crate) text_segment: String,
    pub(crate) narrative_purpose: NarrativePurpose,
    pub(crate) scene_context: String,
    pub(crate) characters_in_shot: Vec<String>,
    pub(crate) dialogue_text: String,
    pub(crate) estimated_duration_sec: f64,
    /// 该镜头包含的段落索引范围 [start, end)
    pub(crate) para_range: (usize, usize),
    /// 规则引擎决策：景别
    pub(crate) shot_size: String,
    /// 规则引擎决策：运镜（标准化词汇）
    pub(crate) camera_move: String,
    /// 规则引擎决策：机位角度
    pub(crate) camera_angle: String,
    /// 声音提示
    pub(crate) sound_hint: String,
    /// 剪辑重点 / 转场
    pub(crate) edit_focus: String,
    /// 构图备注（竖屏双人错位等）
    pub(crate) composition_note: String,
    /// 竖屏约束备注
    pub(crate) vertical_note: String,
    /// 场景标题（场号或地点）
    pub(crate) scene_heading: String,
    /// 节奏功能标签
    pub(crate) rhythm_function: String,
    /// 标签摘要（供 LLM 参考）
    pub(crate) tags_summary: String,
    /// 复合动作拆解子步骤
    pub(crate) is_compound_step: bool,
    /// 反应镜头（听者/被击者表情）
    pub(crate) is_reaction_shot: bool,
    /// 场次索引（与 Paragraph.scene_index 对齐）
    pub(crate) scene_index: usize,
    /// 是否为该场次的空间建立镜
    pub(crate) is_scene_establishing: bool,
    /// 对白类型（对白/OS/VO/旁白/字幕）
    pub(crate) dialogue_type: String,
    /// 表演备注（兴奋、皱眉等，从对白括号提取）
    pub(crate) performance_note: String,
    /// BGM 氛围提示（规则引擎）
    pub(crate) bgm_hint: String,
    /// 人物弧提示（编剧 pass，供逐镜 LLM）
    pub(crate) character_arc_hint: String,
}

impl Default for ShotPlan {
    fn default() -> Self {
        Self {
            serial: 0,
            text_segment: String::new(),
            narrative_purpose: NarrativePurpose::Advancing,
            scene_context: String::new(),
            characters_in_shot: Vec::new(),
            dialogue_text: String::new(),
            estimated_duration_sec: 2.0,
            para_range: (0, 0),
            shot_size: String::new(),
            camera_move: String::new(),
            camera_angle: String::new(),
            sound_hint: String::new(),
            edit_focus: String::new(),
            composition_note: String::new(),
            vertical_note: String::new(),
            scene_heading: String::new(),
            rhythm_function: String::new(),
            tags_summary: String::new(),
            is_compound_step: false,
            is_reaction_shot: false,
            scene_index: 0,
            is_scene_establishing: false,
            dialogue_type: String::new(),
            performance_note: String::new(),
            bgm_hint: String::new(),
            character_arc_hint: String::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum NarrativePurpose {
    Establishing,
    Advancing,
    Turning,
    Closing,
}

impl NarrativePurpose {
    pub(crate) fn as_str(&self) -> &'static str {
        match self {
            NarrativePurpose::Establishing => "建立",
            NarrativePurpose::Advancing => "推进",
            NarrativePurpose::Turning => "转折",
            NarrativePurpose::Closing => "收束",
        }
    }
}

// ──────────────── 阶段 1：剧本理解 ────────────────

const TIME_JUMP_KEYWORDS: &[&str] = &[
    "第二天", "次日", "几日后", "数日后", "几天后", "一周后", "一个月后",
    "几小时后", "数小时后", "片刻后", "不久后",
    "深夜", "清晨", "凌晨", "傍晚", "黄昏", "午后", "上午", "中午",
    "那年", "多年后", "多年以前",
];

const LOCATION_KEYWORDS: &[&str] = &[
    "室内", "室外", "户外", "房间", "客厅", "卧室", "厨房", "书房",
    "办公室", "会议室", "走廊", "楼梯", "门口", "窗前",
    "街道", "广场", "公园", "咖啡馆", "餐厅", "酒吧", "医院", "学校",
    "车内", "车里", "船上", "飞机",
];

const KEY_ACTION_KEYWORDS: &[&str] = &[
    "推门", "开门", "关门", "进门", "出门", "入座", "坐下", "起身", "站起",
    "转身", "回头", "拿取", "拿起", "放下", "递给", "接过",
    "挥拳", "出拳", "出掌", "推搡", "拥抱", "握手", "拍桌", "摔", "掀桌",
    "推倒", "拔出", "抽出", "打开", "合上", "下跪", "跪地", "磕头", "壁咚",
    "泼水", "接吻", "亲吻", "摔倒", "打电话", "拨号",
    "走进", "走出", "跑进", "跑出", "冲进", "追逐", "打斗", "飙车", "切磋",
    "震退", "弹射", "踩刹车", "拉开车门", "吐血", "喷出",
];

const EMOTION_KEYWORDS: &[(&str, &str)] = &[
    ("愤怒", "愤怒"), ("怒吼", "愤怒"), ("咆哮", "愤怒"), ("斥责", "愤怒"),
    ("悲伤", "悲伤"), ("哭泣", "悲伤"), ("流泪", "悲伤"), ("哽咽", "悲伤"),
    ("喜悦", "喜悦"), ("欢笑", "喜悦"), ("欢呼", "喜悦"), ("开心", "喜悦"),
    ("恐惧", "恐惧"), ("惊恐", "恐惧"), ("战栗", "恐惧"), ("害怕", "恐惧"),
    ("紧张", "紧张"), ("不安", "紧张"), ("焦躁", "紧张"),
    ("坚定", "坚定"), ("毅然", "坚定"), ("决绝", "坚定"),
    ("平静", "平静"), ("淡然", "平静"), ("沉默", "平静"),
    ("惊讶", "惊讶"), ("震惊", "惊讶"), ("愕然", "惊讶"),
    ("疑惑", "疑惑"), ("困惑", "疑惑"), ("不解", "疑惑"),
];

pub(crate) fn analyze_script_structure(text: &str) -> ScriptStructure {
    let raw_paragraphs = split_script_into_blocks(text);

    let mut characters: HashMap<String, CharacterInfo> = HashMap::new();
    let mut paragraphs: Vec<Paragraph> = Vec::new();

    for para_text in &raw_paragraphs {
        let is_header = is_scene_header_line(para_text);
        let heading = if is_header {
            normalize_scene_heading(para_text)
        } else {
            String::new()
        };
        let (speakers, is_dialogue) = extract_speakers(para_text);
        let emotion = detect_emotion(para_text);
        let has_action = KEY_ACTION_KEYWORDS.iter().any(|kw| para_text.contains(kw));

        for name in &speakers {
            characters
                .entry(name.clone())
                .or_insert_with(|| CharacterInfo {
                    name: name.clone(),
                    shot_indices: Vec::new(),
                    description_hints: extract_character_desc_hints(para_text, name),
                });
        }

        paragraphs.push(Paragraph {
            text: para_text.clone(),
            is_dialogue_block: is_dialogue,
            speakers,
            emotion,
            has_key_action: has_action,
            scene_index: 0,
            scene_heading: heading,
            is_scene_header: is_header,
        });
    }

    assign_scene_metadata(&mut paragraphs);

    // Fix 9: 第二遍扫描：在纯叙述段中检测已识别的角色名
    let known_names: Vec<String> = characters.keys().cloned().collect();
    for para in &mut paragraphs {
        if para.speakers.is_empty() && !known_names.is_empty() {
            for name in &known_names {
                if para.text.contains(name.as_str()) {
                    para.speakers.push(name.clone());
                }
            }
        }
    }

    let estimated_total = paragraphs.iter().fold(0.0, |acc, p| {
        acc + estimate_paragraph_duration(&p.text, p.is_dialogue_block, p.has_key_action)
    });

    ScriptStructure {
        characters,
        paragraphs,
        estimated_total_duration_sec: estimated_total,
    }
}

// ──────────────── 阶段 2：分镜头设计 ────────────────

/// 短剧快节奏默认策略：上游已拆好的段落 → 每段一镜，对白不合并
pub(crate) fn design_shots(
    structure: &ScriptStructure,
    _full_text: &str,
    plan: Option<&super::script_parse_plan::ScriptParsePlan>,
) -> Vec<ShotPlan> {
    let paragraphs = &structure.paragraphs;
    if paragraphs.is_empty() {
        return Vec::new();
    }

    let mut shots: Vec<ShotPlan> = Vec::new();
    let mut serial: i64 = 0;

    for (i, para) in paragraphs.iter().enumerate() {
        if para.is_scene_header {
            serial += 1;
            let hdr_dur = estimate_paragraph_duration(
                &para.text, para.is_dialogue_block, para.has_key_action,
            );
            shots.push(build_shot_plan(
                serial,
                para.text.clone(),
                NarrativePurpose::Establishing,
                build_scene_context(i, paragraphs),
                para.speakers.clone(),
                String::new(),
                hdr_dur.max(2.0),
                (i, i + 1),
                paragraphs,
            ));
            continue;
        }

        serial += 1;
        let dur = estimate_paragraph_duration(
            &para.text, para.is_dialogue_block, para.has_key_action,
        );
        let dialogue = extract_dialogue_text(&para.text, &para.speakers);
        let mut shot = build_shot_plan(
            serial,
            para.text.clone(),
            determine_narrative_purpose(serial, paragraphs.len(), i, paragraphs),
            build_scene_context(i, paragraphs),
            para.speakers.clone(),
            dialogue,
            dur.max(0.8),
            (i, i + 1),
            paragraphs,
        );
        shot.performance_note = extract_performance_note(&para.text);
        shots.push(shot);
    }

    let requirement = plan.map(|p| &p.hints);
    let cut = plan.map(|p| p.cut).unwrap_or_default();

    let mut shots = split_dialogue_shots(shots, paragraphs, &cut);
    shots = split_overlong_shots(shots, &cut);
    shots = expand_compound_shots(shots);
    shots = inject_reaction_shots(
        shots,
        requirement
            .map(|h| h.prefer_reaction_shots)
            .unwrap_or(false),
    );
    let mut shots = merge_short_shots(shots, &cut);
    assign_scene_roles(&mut shots);
    apply_decisions_to_shots(&mut shots, paragraphs, requirement);
    smooth_adjacent_shots(&mut shots);
    renumber_shots(&mut shots);
    shots
}

fn build_shot_plan(
    serial: i64,
    text_segment: String,
    narrative_purpose: NarrativePurpose,
    scene_context: String,
    characters_in_shot: Vec<String>,
    dialogue_text: String,
    estimated_duration_sec: f64,
    para_range: (usize, usize),
    paragraphs: &[Paragraph],
) -> ShotPlan {
    let lo = para_range.0.min(para_range.1).min(paragraphs.len());
    let scene_index = paragraphs
        .get(lo)
        .map(|p| p.scene_index)
        .unwrap_or(0);
    let scene_heading = paragraphs
        .get(lo)
        .map(|p| p.scene_heading.clone())
        .unwrap_or_default();
    ShotPlan {
        serial,
        text_segment,
        narrative_purpose,
        scene_context,
        characters_in_shot,
        dialogue_text,
        estimated_duration_sec,
        para_range,
        scene_index,
        scene_heading,
        ..ShotPlan::default()
    }
}

fn assign_scene_roles(shots: &mut [ShotPlan]) {
    let mut seen_scenes: HashMap<usize, bool> = HashMap::new();
    for shot in shots.iter_mut() {
        if shot.is_reaction_shot || shot.is_compound_step {
            continue;
        }
        let key = shot.scene_index;
        if !seen_scenes.contains_key(&key) {
            seen_scenes.insert(key, true);
            shot.is_scene_establishing = true;
            if shot.narrative_purpose == NarrativePurpose::Advancing {
                shot.narrative_purpose = NarrativePurpose::Establishing;
            }
        }
    }
    if let Some(last) = shots.last_mut() {
        if !last.is_reaction_shot {
            last.narrative_purpose = NarrativePurpose::Closing;
        }
    }
}

/// 跳过人物小传等前导，从正文（第一集 / 首个场号）开始
pub(crate) fn strip_script_preamble(text: &str) -> String {
    if let Some(pos) = text.find("第一集") {
        let after = text[pos..].trim();
        let lines: Vec<&str> = after.lines().collect();
        if lines.first().map(|l| l.trim().contains("第一集")).unwrap_or(false) {
            return lines.iter().skip(1).map(|l| l.trim()).filter(|l| !l.is_empty()).collect::<Vec<_>>().join("\n");
        }
        return after.to_string();
    }
    for marker in ["1-1", "1－1", "01-1"] {
        if let Some(pos) = text.find(marker) {
            return text[pos..].trim().to_string();
        }
    }
    text.trim().to_string()
}

fn flush_narrative_buf(buf: &mut String, blocks: &mut Vec<String>) {
    let t = buf.trim();
    if !t.is_empty() {
        blocks.push(t.to_string());
    }
    buf.clear();
}

/// 将剧本文本拆成可分析块：支持单行剧本（▲动作 / 括号对白 / 场号）
fn split_script_into_blocks(text: &str) -> Vec<String> {
    let body = strip_script_preamble(text);
    let mut blocks: Vec<String> = Vec::new();
    let mut narrative_buf = String::new();

    for line in body.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if is_episode_title_line(line) {
            flush_narrative_buf(&mut narrative_buf, &mut blocks);
            blocks.push(line.to_string());
            continue;
        }
        if is_scene_header_line(line) {
            flush_narrative_buf(&mut narrative_buf, &mut blocks);
            blocks.push(line.to_string());
            continue;
        }
        if is_cast_line(line) {
            flush_narrative_buf(&mut narrative_buf, &mut blocks);
            blocks.push(line.to_string());
            continue;
        }
        if is_action_line(line) {
            flush_narrative_buf(&mut narrative_buf, &mut blocks);
            blocks.push(normalize_action_line(line));
            continue;
        }
        if is_script_dialogue_line(line) {
            flush_narrative_buf(&mut narrative_buf, &mut blocks);
            blocks.push(line.to_string());
            continue;
        }
        // 动作/叙述行：默认单行成块（短剧常见格式）
        flush_narrative_buf(&mut narrative_buf, &mut blocks);
        blocks.push(line.to_string());
    }
    flush_narrative_buf(&mut narrative_buf, &mut blocks);

    // 兼容：若上游已用双换行分段，对超大块二次按行拆分
    let mut refined: Vec<String> = Vec::new();
    for block in blocks {
        if block.lines().count() <= 1 {
            refined.push(block);
            continue;
        }
        let lines: Vec<String> = block
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .map(String::from)
            .collect();
        let all_dialogue = lines.iter().all(|l| is_script_dialogue_line(l));
        if all_dialogue && lines.len() >= 2 {
            refined.extend(lines);
        } else {
            refined.push(block);
        }
    }
    refined
}

fn is_episode_title_line(line: &str) -> bool {
    line.contains('集')
        && line.chars().count() <= 16
        && !line.contains('：')
        && !line.contains(':')
        && !line.starts_with('▲')
}

/// 按集号截取剧本文本（配合解析要求「先输出第一集」）
pub(crate) fn scope_script_to_episode(text: &str, episode: u32) -> String {
    let lines: Vec<&str> = text.lines().collect();
    let mut markers: Vec<(u32, usize)> = Vec::new();
    for (i, line) in lines.iter().enumerate() {
        if let Some(ep) = episode_number_from_title_line(line.trim()) {
            markers.push((ep, i));
        }
    }
    if markers.is_empty() {
        if episode == 1 {
            return strip_script_preamble(text);
        }
        return String::new();
    }
    let Some(start_line) = markers
        .iter()
        .find(|(ep, _)| *ep == episode)
        .map(|(_, i)| *i)
    else {
        return String::new();
    };
    let end_line = markers
        .iter()
        .find(|(ep, idx)| *ep > episode && *idx > start_line)
        .map(|(_, i)| *i)
        .unwrap_or(lines.len());
    lines[start_line..end_line]
        .iter()
        .copied()
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn episode_number_from_title_line(line: &str) -> Option<u32> {
    let line = line.trim();
    if line.is_empty() || line.chars().count() > 24 {
        return None;
    }
    if is_episode_title_line(line) {
        let di = line.find('第')?;
        let rest = &line[di + '第'.len_utf8()..];
        let ji = rest.find('集')?;
        return parse_episode_number_token(rest[..ji].trim());
    }
    let upper = line.to_uppercase();
    if let Some(rest) = upper.strip_prefix("EP") {
        let digits: String = rest
            .chars()
            .take_while(|c| c.is_ascii_digit())
            .collect();
        if let Ok(n) = digits.parse::<u32>() {
            if n > 0 {
                return Some(n);
            }
        }
    }
    if upper.starts_with("EPISODE") {
        let rest = &line[7..];
        let digits: String = rest
            .chars()
            .skip_while(|c| !c.is_ascii_digit())
            .take_while(|c| c.is_ascii_digit())
            .collect();
        if let Ok(n) = digits.parse::<u32>() {
            if n > 0 {
                return Some(n);
            }
        }
    }
    None
}

fn is_cast_line(line: &str) -> bool {
    line.starts_with("人物：") || line.starts_with("人物:")
}

fn is_action_line(line: &str) -> bool {
    line.starts_with('▲') || line.starts_with('△') || line.starts_with('@')
}

fn normalize_action_line(line: &str) -> String {
    line.trim()
        .trim_start_matches('▲')
        .trim_start_matches('△')
        .trim_start_matches('@')
        .trim()
        .to_string()
}

/// 识别剧本对白行：张三：… / 陈南（兴奋：… / 陈南os：… / 陈南（气）:
fn is_script_dialogue_line(line: &str) -> bool {
    parse_speaker_prefix(line).is_some()
}

fn parse_speaker_prefix(line: &str) -> Option<String> {
    let t = line.trim();
    for marker in ["os：", "OS：", "os:", "OS:"] {
        if let Some(pos) = t.find(marker) {
            let name = t[..pos].trim();
            if is_likely_character_name(name) {
                return Some(name.to_string());
            }
        }
    }
    if let Some(pos) = t.find('：') {
        let prefix = &t[..pos];
        let name = prefix
            .split('（')
            .next()
            .unwrap_or(prefix)
            .split('(')
            .next()
            .unwrap_or(prefix)
            .trim();
        if is_likely_character_name(name) {
            return Some(name.to_string());
        }
    }
    if let Some(pos) = t.find(':') {
        let prefix = &t[..pos];
        if prefix.ends_with('）') || prefix.ends_with(')') {
            let name = prefix
                .split('（')
                .next()
                .unwrap_or(prefix)
                .split('(')
                .next()
                .unwrap_or(prefix)
                .trim();
            if is_likely_character_name(name) {
                return Some(name.to_string());
            }
        }
    }
    None
}

fn is_likely_character_name(name: &str) -> bool {
    let n = name.chars().count();
    n >= 1 && n <= 8 && !name.contains(' ') && is_likely_name(name)
}

fn is_dialogue_line(line: &str) -> bool {
    is_script_dialogue_line(line)
}

fn is_scene_header_line(text: &str) -> bool {
    let t = text.trim();
    if t.starts_with("##") {
        return true;
    }
    if t.contains("第") && t.contains("场") {
        return true;
    }
    let first_line = t.lines().next().unwrap_or(t).trim();
    if looks_like_scene_number(first_line) {
        return true;
    }
    false
}

fn looks_like_scene_number(line: &str) -> bool {
    let t = line.trim();
    if t.len() < 3 {
        return false;
    }
    let has_scene_id = t
        .find('-')
        .map(|dash| {
            let before = t[..dash].chars().all(|c| c.is_ascii_digit()) && dash > 0;
            let after: String = t[dash + 1..]
                .chars()
                .take_while(|c| c.is_ascii_digit())
                .collect();
            before && !after.is_empty()
        })
        .unwrap_or(false);
    let has_stage = t.contains('内') || t.contains('外');
    let has_time = t.contains('日') || t.contains('夜') || t.contains('晨') || t.contains("傍晚");
    has_scene_id && (has_stage || has_time) || (has_stage && has_time && t.chars().any(|c| c.is_ascii_digit()))
}

fn normalize_scene_heading(text: &str) -> String {
    let t = text.trim().trim_start_matches('#').trim();
    t.chars().take(48).collect()
}

fn assign_scene_metadata(paragraphs: &mut [Paragraph]) {
    let mut scene_idx = 0usize;
    let mut current_heading = String::new();
    for para in paragraphs.iter_mut() {
        if para.is_scene_header {
            scene_idx += 1;
            if !para.scene_heading.is_empty() {
                current_heading = para.scene_heading.clone();
            } else {
                current_heading = normalize_scene_heading(&para.text);
                para.scene_heading = current_heading.clone();
            }
        }
        para.scene_index = scene_idx;
        if !current_heading.is_empty() && !para.is_scene_header {
            para.scene_heading = current_heading.clone();
        }
    }
}

// ──────────────── 辅助函数 ────────────────

/// 对白/文本改写后刷新段落元数据（说话人、情绪等）
pub(crate) fn refresh_paragraph_metadata(para: &mut Paragraph) {
    let (speakers, is_dialogue) = extract_speakers(&para.text);
    para.speakers = speakers;
    para.is_dialogue_block = is_dialogue;
    para.emotion = detect_emotion(&para.text);
}

fn extract_speakers(text: &str) -> (Vec<String>, bool) {
    let mut speakers: Vec<String> = Vec::new();
    let mut has_dialogue = false;

    for line in text.lines() {
        if let Some(name) = parse_speaker_prefix(line) {
            if !speakers.contains(&name) {
                speakers.push(name);
            }
            has_dialogue = true;
        }
    }

    // 人物：陈南 师父
    if !has_dialogue && text.starts_with("人物") {
        let cast = text
            .split('：')
            .nth(1)
            .or_else(|| text.split(':').nth(1))
            .unwrap_or("");
        for name in cast.split_whitespace() {
            let n = name.trim();
            if is_likely_character_name(n) && !speakers.contains(&n.to_string()) {
                speakers.push(n.to_string());
            }
        }
    }

    (speakers, has_dialogue)
}

fn is_likely_name(s: &str) -> bool {
    let chars_count = s.chars().count();
    if chars_count == 0 || chars_count > 6 { return false; }
    let blacklist = [
        "但是", "不过", "因为", "所以", "如果", "虽然", "然而", "于是",
        "然后", "接着", "此时", "这时", "忽然", "突然", "只见", "只听",
        "备注", "注意", "说明", "提示", "人物",
    ];
    !blacklist.contains(&s)
}

fn extract_character_desc_hints(text: &str, name: &str) -> Vec<String> {
    let mut hints = Vec::new();
    for line in text.lines() {
        if line.contains(name) {
            if line.contains("岁") || line.contains("年龄") || line.contains("穿着")
                || line.contains("面带") || line.contains("戴着") || line.contains("手持")
            {
                hints.push(line.to_string());
            }
        }
    }
    hints
}

fn detect_emotion(text: &str) -> String {
    for (keyword, label) in EMOTION_KEYWORDS {
        if text.contains(keyword) { return label.to_string(); }
    }
    String::new()
}

fn estimate_paragraph_duration(text: &str, is_dialogue: bool, has_action: bool) -> f64 {
    if is_dialogue {
        let dialogue_only = extract_dialogue_content(text);
        let chars = dialogue_only.chars().count() as f64;
        let dur = if chars > 0.0 { chars / 2.8 + 0.4 } else { 2.0 };
        dur.clamp(1.2, 8.0)
    } else if has_action {
        let dur = text.chars().count() as f64 / 5.5 + 0.5;
        dur.clamp(1.2, 5.0)
    } else {
        let chars = text.chars().count();
        if chars > 40 {
            2.5
        } else {
            1.8
        }
    }
}

/// 仅统计冒号后的对白字数（更准确估算口播时长）
fn extract_dialogue_content(text: &str) -> String {
    let mut out = String::new();
    for line in text.lines() {
        let t = line.trim();
        if let Some((_, content)) = t.split_once('：') {
            out.push_str(content.trim());
            out.push('\n');
        }
    }
    if out.is_empty() {
        text.to_string()
    } else {
        out
    }
}

fn detect_scene_boundaries(paragraphs: &[Paragraph]) -> Vec<usize> {
    let mut boundaries = Vec::new();
    for (i, para) in paragraphs.iter().enumerate() {
        if i == 0 {
            continue;
        }
        if para.is_scene_header {
            boundaries.push(i);
            continue;
        }
        if TIME_JUMP_KEYWORDS.iter().any(|kw| para.text.contains(kw)) {
            boundaries.push(i);
            continue;
        }
        let prev = &paragraphs[i - 1].text;
        let prev_loc = LOCATION_KEYWORDS.iter().find(|kw| prev.contains(*kw));
        let curr_loc = LOCATION_KEYWORDS.iter().find(|kw| para.text.contains(*kw));
        if prev_loc.is_some() && curr_loc.is_some() && prev_loc != curr_loc {
            boundaries.push(i);
        }
    }
    boundaries
}

/// 从对白行括号提取表演备注：陈南（兴奋：… / 陈南（皱眉）
pub(crate) fn extract_performance_note(text: &str) -> String {
    for line in text.lines() {
        let t = line.trim();
        if let Some(note) = parse_performance_note_from_line(t) {
            return note;
        }
    }
    String::new()
}

fn parse_performance_note_from_line(line: &str) -> Option<String> {
    let t = line.trim();
    let open = t
        .char_indices()
        .find(|(_, c)| *c == '（' || *c == '(')
        .map(|(byte_idx, ch)| byte_idx + ch.len_utf8());
    if open.is_none() {
        return None;
    }
    let rest = t.get(open.unwrap()..)?;
    let close_rel = rest.find('）').or_else(|| rest.find(')'));
    let inner = if let Some(end) = close_rel {
        rest[..end].trim()
    } else {
        // 未闭合括号：陈南（兴奋：台词…
        let colon_byte = rest
            .char_indices()
            .find(|(_, c)| *c == '：' || *c == ':')
            .map(|(i, _)| i);
        if colon_byte.is_none() {
            return None;
        }
        rest[..colon_byte.unwrap()].trim()
    };
    if inner.is_empty() || inner.chars().count() > 16 {
        return None;
    }
    let note = inner
        .split('：')
        .next()
        .or_else(|| inner.split(':').next())
        .unwrap_or(inner)
        .trim();
    if note.is_empty() || note.chars().count() > 12 {
        return None;
    }
    Some(note.to_string())
}

fn extract_dialogue_text(text: &str, speakers: &[String]) -> String {
    if is_cast_line(text) {
        return String::new();
    }
    if is_script_dialogue_line(text) {
        return text.trim().to_string();
    }
    if speakers.is_empty() {
        return String::new();
    }
    let lines: Vec<String> = text
        .lines()
        .filter(|line| {
            let t = line.trim();
            if is_script_dialogue_line(t) {
                return true;
            }
            speakers.iter().any(|s| t.starts_with(s.as_str()) && (t.contains('：') || t.contains('(')))
        })
        .map(|l| l.trim().to_string())
        .collect();
    lines.join("\n")
}

fn determine_narrative_purpose(
    _serial: i64,
    total_paras: usize,
    current_para_idx: usize,
    paragraphs: &[Paragraph],
) -> NarrativePurpose {
    // 检测情绪转折：当前段落有强烈负面情绪，且与上一段情绪不同
    if let Some(para) = paragraphs.get(current_para_idx) {
        let is_strong_emotion = para.emotion == "愤怒"
            || para.emotion == "悲伤"
            || para.emotion == "恐惧"
            || para.emotion == "惊讶";
        if is_strong_emotion {
            if let Some(prev) = current_para_idx.checked_sub(1).and_then(|i| paragraphs.get(i)) {
                if prev.emotion != para.emotion {
                    return NarrativePurpose::Turning;
                }
            }
        }
    }
    if current_para_idx >= total_paras.saturating_sub(2) {
        NarrativePurpose::Closing
    } else {
        NarrativePurpose::Advancing
    }
}

fn build_scene_context(para_idx: usize, paragraphs: &[Paragraph]) -> String {
    if paragraphs.is_empty() { return String::new(); }
    // 围绕 para_idx 取窗口 [max(0, idx-2), min(len-1, idx+2)]，最多 5 段
    let len = paragraphs.len();
    let lo = para_idx.saturating_sub(2);
    let hi = (para_idx + 3).min(len);
    let mut ctx = String::new();
    for (i, p) in paragraphs[lo..hi].iter().enumerate() {
        if i > 0 { ctx.push('\n'); }
        ctx.push_str(&p.text);
    }
    ctx.chars().take(300).collect()
}

fn is_narration_only_shot(shot: &ShotPlan) -> bool {
    shot.dialogue_text.is_empty()
        && !is_cast_line(&shot.text_segment)
        && !is_script_dialogue_line(&shot.text_segment)
        && !shot.is_scene_establishing
}

fn merge_short_shots(shots: Vec<ShotPlan>, cut: &CutProfile) -> Vec<ShotPlan> {
    // 对白、场号、反应镜、复合步骤永不合并；叙述镜阈值由体裁/节奏决定
    let max_single = cut.merge_single_narration_max_sec;
    let max_combined = cut.merge_combined_narration_max_sec;
    if shots.len() <= 1 {
        return shots;
    }
    let mut merged: Vec<ShotPlan> = Vec::with_capacity(shots.len());
    for shot in shots {
        if let Some(last) = merged.last_mut() {
            if last.is_compound_step
                || shot.is_compound_step
                || last.is_reaction_shot
                || shot.is_reaction_shot
                || last.is_scene_establishing
                || shot.is_scene_establishing
                || !last.dialogue_text.is_empty()
                || !shot.dialogue_text.is_empty()
                || last.scene_index != shot.scene_index
            {
                merged.push(shot);
                continue;
            }
            if is_narration_only_shot(last)
                && is_narration_only_shot(&shot)
                && last.estimated_duration_sec < max_single
                && shot.estimated_duration_sec < max_single
            {
                let combined = last.estimated_duration_sec + shot.estimated_duration_sec;
                if combined <= max_combined {
                    last.text_segment = format!("{}\n{}", last.text_segment, shot.text_segment);
                    last.estimated_duration_sec = combined;
                    last.para_range = (last.para_range.0, shot.para_range.1);
                    for c in &shot.characters_in_shot {
                        if !last.characters_in_shot.contains(c) {
                            last.characters_in_shot.push(c.clone());
                        }
                    }
                    continue;
                }
            }
        }
        merged.push(shot);
    }
    merged
}

// ──────────────── 测试 ────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_speakers() {
        let (s, d) = extract_speakers("张三：你好。\n李四：你来了。");
        assert!(d);
        assert!(s.contains(&"张三".to_string()));
        assert!(s.contains(&"李四".to_string()));
    }

    #[test]
    fn test_non_speaker() {
        let (s, d) = extract_speakers("但是他没有回应。");
        assert!(!d);
        assert!(s.is_empty());
    }

    #[test]
    fn test_emotion_detection() {
        assert_eq!(detect_emotion("他愤怒地拍桌"), "愤怒");
        assert_eq!(detect_emotion("她很开心"), "喜悦");
        assert_eq!(detect_emotion("安静的房间"), "");
    }

    #[test]
    fn test_analyze_basic() {
        let st = analyze_script_structure("张三：你好。\n\n李四：你来了。");
        assert_eq!(st.paragraphs.len(), 2);
        assert!(st.characters.contains_key("张三"));
    }

    #[test]
    fn test_scene_header_split() {
        let st = analyze_script_structure(
            "1-1 日 内 客厅\n\n张三：你好。\n\n李四：来了。",
        );
        assert!(st.paragraphs.iter().any(|p| p.is_scene_header));
        let with_scene = st.paragraphs.iter().find(|p| p.text.contains("张三")).unwrap();
        assert_eq!(with_scene.scene_index, 1);
        assert!(with_scene.scene_heading.contains("1-1"));
    }

    #[test]
    fn test_design_shots_two_scenes() {
        let body = "1-1 日 内 客厅\n\n张三：你好。\n\n2-1 夜 外 街道\n\n李四：谁？";
        let st = analyze_script_structure(body);
        let shots = design_shots(&st, body, None);
        assert!(shots.len() >= 3);
        let establishing: Vec<_> = shots.iter().filter(|s| s.is_scene_establishing).collect();
        assert!(establishing.len() >= 2);
    }

    #[test]
    fn test_parenthesis_dialogue_speaker() {
        let (s, d) = extract_speakers("陈南（兴奋：我这一击用了七成功力");
        assert!(d);
        assert!(s.contains(&"陈南".to_string()));
        let (s2, _) = extract_speakers("陈南os：我去，我未来小姨子？");
        assert!(s2.contains(&"陈南".to_string()));
    }

    #[test]
    fn test_extract_performance_note() {
        assert_eq!(
            extract_performance_note("陈南（兴奋：我这一击用了七成功力"),
            "兴奋"
        );
        assert_eq!(extract_performance_note("李惠然（皱眉）：他们要追来了"), "皱眉");
        assert!(extract_performance_note("悬崖，陈南挥拳").is_empty());
    }

    #[test]
    fn test_scope_script_to_episode() {
        let text = "人物小传\n陈南：男主\n第一集\n场1\n对白A\n第二集\n场2\n对白B";
        let ep1 = scope_script_to_episode(text, 1);
        assert!(ep1.contains("对白A"), "ep1={}", ep1);
        assert!(!ep1.contains("对白B"));
        let ep2 = scope_script_to_episode(text, 2);
        assert!(ep2.contains("对白B"), "ep2={}", ep2);
        assert!(!ep2.contains("对白A"));
    }

    #[test]
    fn test_scope_script_ep_format() {
        let text = "EP01\n场A\n对白1\nEP02\n场B\n对白2";
        let ep1 = scope_script_to_episode(text, 1);
        assert!(ep1.contains("对白1"));
        assert!(!ep1.contains("对白2"));
    }

    #[test]
    fn test_film_produces_fewer_shots_than_ad_on_same_text() {
        let text = "1-1日 内 客厅\n人物：甲 乙\n甲：你好。\n乙：来了。\n甲：坐吧。\n▲甲倒茶\n▲乙点头";
        let st = analyze_script_structure(text);
        let film_hints = super::super::script_parse_requirement::parse_requirement_hints("电影");
        let ad_hints = super::super::script_parse_requirement::parse_requirement_hints("广告");
        use super::super::script_parse_plan::{finalize_plan, PlanSource};
        let film_plan = finalize_plan(
            film_hints,
            super::super::script_parse::ScriptStyleProfile::Film,
            "电影",
            text,
            PlanSource::UserBrief,
            false,
            "电影".into(),
        );
        let ad_plan = finalize_plan(
            ad_hints,
            super::super::script_parse::ScriptStyleProfile::Ad,
            "广告",
            text,
            PlanSource::UserBrief,
            false,
            "广告".into(),
        );
        let film_shots = design_shots(&st, text, Some(&film_plan));
        let ad_shots = design_shots(&st, text, Some(&ad_plan));
        assert!(
            ad_shots.len() >= film_shots.len(),
            "ad={} film={}",
            ad_shots.len(),
            film_shots.len()
        );
    }

    #[test]
    fn test_episode1_tiejia_pipeline() {
        use crate::executor::script_decision::format_shot_storyboard_block;
        let text = include_str!("fixtures/episode1_tiejia.txt");
        let st = analyze_script_structure(text);
        assert!(
            st.paragraphs.len() >= 35,
            "expected many paragraphs, got {}",
            st.paragraphs.len()
        );
        assert!(st.characters.contains_key("陈南"));
        assert!(st.characters.contains_key("李惠然"));
        let shots = design_shots(&st, text, None);
        assert!(
            shots.len() >= 48,
            "short-drama pace expects ~50+ shots, got {}",
            shots.len()
        );
        let scene_count = shots
            .iter()
            .map(|s| s.scene_index)
            .collect::<std::collections::HashSet<_>>()
            .len();
        assert!(scene_count >= 2, "expected 2 scenes, got {}", scene_count);
        let has_os = shots.iter().any(|s| s.text_segment.contains("os"));
        assert!(has_os, "should parse inner monologue line");
        eprintln!(
            "episode1 stats: paragraphs={}, shots={}, scenes={}",
            st.paragraphs.len(),
            shots.len(),
            scene_count
        );
        for shot in shots.iter().take(5) {
            let block = format_shot_storyboard_block(shot, &shot.text_segment, &shot.dialogue_text, "");
            eprintln!("--- 镜 {} [{}] ---\n{}\n", shot.serial, shot.scene_heading, block);
        }
        let climax: Vec<_> = shots
            .iter()
            .filter(|s| s.scene_heading.contains("1-2") && s.serial >= shots.len() as i64 - 5)
            .collect();
        for shot in climax {
            eprintln!(
                "--- 尾声镜 {} | {} | {} | {}s ---",
                shot.serial,
                shot.shot_size,
                shot.text_segment.chars().take(40).collect::<String>(),
                shot.estimated_duration_sec
            );
        }
    }
}
