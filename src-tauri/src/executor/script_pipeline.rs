// ── 三阶段脚本解析管线：阶段 1+2（纯规则引擎，不调用 LLM）──
// 阶段 1：剧本理解 —— 角色提取、场景分段、情绪标注
// 阶段 2：分镜头设计 —— 基于拆分策略的镜头划分、时长估算、叙事目的标注

use std::collections::HashMap;

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
    "挥拳", "出拳", "推搡", "拥抱", "握手", "拍桌", "摔",
    "推倒", "拔出", "抽出", "打开", "合上",
    "走进", "走出", "跑进", "跑出", "冲进",
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
    let raw_paragraphs: Vec<&str> = text
        .split("\n\n")
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .collect();

    let mut characters: HashMap<String, CharacterInfo> = HashMap::new();
    let mut paragraphs: Vec<Paragraph> = Vec::new();

    for para_text in &raw_paragraphs {
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
            text: para_text.to_string(),
            is_dialogue_block: is_dialogue,
            speakers,
            emotion,
            has_key_action: has_action,
        });
    }

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

pub(crate) fn design_shots(structure: &ScriptStructure, _full_text: &str) -> Vec<ShotPlan> {
    let paragraphs = &structure.paragraphs;
    if paragraphs.is_empty() {
        return Vec::new();
    }

    let scene_boundaries: Vec<usize> = detect_scene_boundaries(paragraphs);

    let mut shots: Vec<ShotPlan> = Vec::new();
    let mut current_segment = String::new();
    let mut current_speakers: Vec<String> = Vec::new();
    let mut current_duration = 0.0;
    let mut current_start_para_idx = 0;
    let mut serial: i64 = 0;

    for (i, para) in paragraphs.iter().enumerate() {
        let is_scene_boundary = scene_boundaries.contains(&i) && !current_segment.is_empty();

        let should_split_for_action = para.has_key_action
            && !current_segment.is_empty()
            && !para.is_dialogue_block;

        let is_emotion_shift = !current_segment.is_empty()
            && !para.emotion.is_empty()
            && !current_speakers.is_empty()
            && para.emotion != paragraphs
                .get(current_start_para_idx)
                .map(|p| p.emotion.as_str())
                .unwrap_or("")
            && (para.emotion == "愤怒" || para.emotion == "悲伤" || para.emotion == "恐惧");

        // Fix 11: 使用 chars().count() 而非 len()（避免 UTF-8 字节数误判）
        let is_empty_separator = para.text.chars().count() < 5 && current_segment.chars().count() > 50;

        let should_flush = is_scene_boundary
            || should_split_for_action
            || is_emotion_shift
            || is_empty_separator
            || (i == paragraphs.len() - 1);

        if should_flush {
            if !current_segment.is_empty() {
                let shot_start = current_start_para_idx;
                if is_scene_boundary || should_split_for_action || is_emotion_shift || is_empty_separator {
                    // flush 当前 segment（段落 [shot_start, i)），新段落单独成镜
                    let flushed = std::mem::take(&mut current_segment);
                    let flushed_speakers = std::mem::take(&mut current_speakers);
                    let flushed_dur = current_duration;

                    // 新段作为当前
                    current_segment = para.text.clone();
                    current_speakers = para.speakers.clone();
                    current_duration = estimate_paragraph_duration(
                        &para.text, para.is_dialogue_block, para.has_key_action,
                    );
                    current_start_para_idx = i;

                    // push 旧镜
                    serial += 1;
                    let purpose = determine_narrative_purpose(
                        serial, paragraphs.len(), i, paragraphs,
                    );
                    let scene_ctx = build_scene_context(shot_start, paragraphs);
                    let dialogue = extract_dialogue_text(&flushed, &flushed_speakers);
                    shots.push(ShotPlan {
                        serial,
                        text_segment: flushed,
                        narrative_purpose: purpose,
                        scene_context: scene_ctx,
                        characters_in_shot: flushed_speakers,
                        dialogue_text: dialogue,
                        estimated_duration_sec: flushed_dur.max(1.0),
                        para_range: (shot_start, i),
                    });
                    continue;
                } else {
                    // 最后一段：合并后 flush（段落 [shot_start, i] 包含 i）
                    if i == paragraphs.len() - 1 {
                        current_segment = format!("{}\n{}", current_segment, para.text);
                        for s in &para.speakers {
                            if !current_speakers.contains(s) { current_speakers.push(s.clone()); }
                        }
                        current_duration += estimate_paragraph_duration(
                            &para.text, para.is_dialogue_block, para.has_key_action,
                        );
                    }
                    let seg = std::mem::take(&mut current_segment);
                    let spk = std::mem::take(&mut current_speakers);
                    let dur = current_duration;
                    serial += 1;
                    let purpose = determine_narrative_purpose(
                        serial, paragraphs.len(), i, paragraphs,
                    );
                    let scene_ctx = build_scene_context(shot_start, paragraphs);
                    let dialogue = extract_dialogue_text(&seg, &spk);
                    // 最后一个段落 i 已合并进 seg，所以半开区间是 [shot_start, i+1)
                    shots.push(ShotPlan {
                        serial,
                        text_segment: seg,
                        narrative_purpose: purpose,
                        scene_context: scene_ctx,
                        characters_in_shot: spk,
                        dialogue_text: dialogue,
                        estimated_duration_sec: dur.max(1.0),
                        para_range: (shot_start, i + 1),
                    });
                    current_segment = String::new();
                    current_speakers.clear();
                    current_duration = 0.0;
                    current_start_para_idx = i + 1;
                }
            } else {
                // 第一个段落
                current_segment = para.text.clone();
                current_speakers = para.speakers.clone();
                current_duration = estimate_paragraph_duration(
                    &para.text, para.is_dialogue_block, para.has_key_action,
                );
                current_start_para_idx = i;
            }
        } else {
            // 合并
            if current_segment.is_empty() {
                current_segment = para.text.clone();
                current_speakers = para.speakers.clone();
                current_duration = estimate_paragraph_duration(
                    &para.text, para.is_dialogue_block, para.has_key_action,
                );
                current_start_para_idx = i;
            } else {
                current_segment = format!("{}\n{}", current_segment, para.text);
                for s in &para.speakers {
                    if !current_speakers.contains(s) { current_speakers.push(s.clone()); }
                }
                current_duration += estimate_paragraph_duration(
                    &para.text, para.is_dialogue_block, para.has_key_action,
                );
            }
        }
    }

    // 合并过短镜头
    merge_short_shots(shots)
}

// ──────────────── 辅助函数 ────────────────

fn extract_speakers(text: &str) -> (Vec<String>, bool) {
    let mut speakers: Vec<String> = Vec::new();
    let mut has_dialogue = false;

    for line in text.lines() {
        let trimmed = line.trim();
        if let Some(colon_pos) = trimmed.find('：') {
            let prefix = &trimmed[..colon_pos];
            if prefix.chars().count() <= 6 && !prefix.contains(' ') {
                let name = prefix.trim_end_matches('说').trim().to_string();
                if !name.is_empty() && is_likely_name(&name) {
                    if !speakers.contains(&name) { speakers.push(name); }
                    has_dialogue = true;
                }
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
        "备注", "注意", "说明", "提示",
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
        let dur = text.chars().count() as f64 / 3.0;
        dur.clamp(1.5, 15.0)
    } else if has_action {
        let dur = text.chars().count() as f64 / 6.0;
        dur.clamp(1.0, 5.0)
    } else {
        1.5
    }
}

fn detect_scene_boundaries(paragraphs: &[Paragraph]) -> Vec<usize> {
    let mut boundaries = Vec::new();
    for (i, para) in paragraphs.iter().enumerate() {
        if i == 0 { continue; }
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

fn extract_dialogue_text(text: &str, speakers: &[String]) -> String {
    if speakers.is_empty() { return String::new(); }
    let lines: Vec<String> = text
        .lines()
        .filter(|line| {
            let t = line.trim();
            speakers.iter().any(|s| t.starts_with(s.as_str()) && t.contains('：'))
        })
        .map(|l| l.trim().to_string())
        .collect();
    lines.join("\n")
}

fn determine_narrative_purpose(
    serial: i64,
    total_paras: usize,
    current_para_idx: usize,
    paragraphs: &[Paragraph],
) -> NarrativePurpose {
    if serial == 1 {
        return NarrativePurpose::Establishing;
    }
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

fn merge_short_shots(shots: Vec<ShotPlan>) -> Vec<ShotPlan> {
    const MIN_DURATION: f64 = 2.0;
    if shots.len() <= 1 { return shots; }
    let mut merged: Vec<ShotPlan> = Vec::with_capacity(shots.len());
    for shot in shots {
        if let Some(last) = merged.last_mut() {
            if last.estimated_duration_sec < MIN_DURATION && shot.estimated_duration_sec < MIN_DURATION {
                // 两镜都过短：合并到前一镜
                last.text_segment = format!("{}\n{}", last.text_segment, shot.text_segment);
                last.estimated_duration_sec += shot.estimated_duration_sec;
                last.para_range = (last.para_range.0, shot.para_range.1);
                for c in &shot.characters_in_shot {
                    if !last.characters_in_shot.contains(c) {
                        last.characters_in_shot.push(c.clone());
                    }
                }
                if !shot.dialogue_text.is_empty() {
                    if last.dialogue_text.is_empty() {
                        last.dialogue_text = shot.dialogue_text;
                    } else {
                        last.dialogue_text = format!("{}\n{}", last.dialogue_text, shot.dialogue_text);
                    }
                }
                continue;
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
}
