//! 脚本节点底栏「解析要求」：从自然语言提取可执行约束，并回写到镜头规划。

use serde_json::{json, Value};

use super::script_parse::{style_profile_name, ScriptStyleProfile};
use super::script_pipeline::ShotPlan;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub(crate) enum ShotSizeBias {
    #[default]
    None,
    /// 加强特写 / 近景为主
    CloseUp,
    /// 中景为主
    Medium,
    /// 全景 / 建立空间为主
    Wide,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub(crate) struct ScriptParseRequirementHints {
    /// 用户原文（去空白后）
    pub requirement_text: String,
    /// 期望单镜时长（秒），如「每镜 3 秒」
    pub per_shot_duration_sec: Option<f64>,
    /// 期望成片总时长（秒），如「总时长 90 秒」
    pub total_duration_sec: Option<f64>,
    /// 单镜最短 / 最长（秒）
    pub min_shot_duration_sec: Option<f64>,
    pub max_shot_duration_sec: Option<f64>,
    /// 景别整体偏好（规则引擎层 8）
    pub shot_size_bias: ShotSizeBias,
    /// 加强情绪/反应镜（对白镜后额外插入反应镜）
    pub prefer_reaction_shots: bool,
    /// 情绪段落优先特写（与 CloseUp 叠加）
    pub prefer_emotion_close_up: bool,
    /// 少用全景建立镜（紧凑节奏）
    pub reduce_establishing_wides: bool,
    /// 粗粒度体裁（如只写「短剧」「电影」「广告」）
    pub style_profile: Option<ScriptStyleProfile>,
    /// 仅解析指定集（如「先输出第一集」）
    pub episode_only: Option<u32>,
    /// 快剪 / 多切镜（与体裁叠加，显式优先）
    pub prefer_dense_cuts: bool,
    /// 慢节奏 / 少切镜
    pub prefer_sparse_cuts: bool,
    /// 跳过人物弧编剧 pass（brief：跳过人物弧 / 仅分镜）
    pub skip_character_arc: bool,
    /// 跳过对白改写 pass
    pub skip_dialogue_rewrite: bool,
}

/// 切镜密度参数：由体裁 + 节奏关键词决定 merge / split 阈值
#[derive(Debug, Clone, Copy)]
pub(crate) struct CutProfile {
    pub merge_single_narration_max_sec: f64,
    pub merge_combined_narration_max_sec: f64,
    pub split_dialogue_min_lines: usize,
    pub split_dialogue_char_min: usize,
    pub split_overlong_max_chars: usize,
    pub split_overlong_max_dur_sec: f64,
}

impl Default for CutProfile {
    fn default() -> Self {
        Self::short_drama()
    }
}

impl CutProfile {
    pub fn short_drama() -> Self {
        Self {
            merge_single_narration_max_sec: 1.2,
            merge_combined_narration_max_sec: 2.0,
            split_dialogue_min_lines: 2,
            split_dialogue_char_min: 18,
            split_overlong_max_chars: 85,
            split_overlong_max_dur_sec: 4.5,
        }
    }

    pub fn film() -> Self {
        Self {
            merge_single_narration_max_sec: 2.2,
            merge_combined_narration_max_sec: 4.5,
            split_dialogue_min_lines: 3,
            split_dialogue_char_min: 36,
            split_overlong_max_chars: 140,
            split_overlong_max_dur_sec: 10.0,
        }
    }

    pub fn ad() -> Self {
        Self {
            merge_single_narration_max_sec: 0.8,
            merge_combined_narration_max_sec: 1.4,
            split_dialogue_min_lines: 2,
            split_dialogue_char_min: 12,
            split_overlong_max_chars: 55,
            split_overlong_max_dur_sec: 3.0,
        }
    }

    pub fn anime() -> Self {
        Self {
            merge_single_narration_max_sec: 1.5,
            merge_combined_narration_max_sec: 2.8,
            split_dialogue_min_lines: 2,
            split_dialogue_char_min: 22,
            split_overlong_max_chars: 100,
            split_overlong_max_dur_sec: 5.5,
        }
    }

    fn denser(self) -> Self {
        Self {
            merge_single_narration_max_sec: self.merge_single_narration_max_sec * 0.7,
            merge_combined_narration_max_sec: self.merge_combined_narration_max_sec * 0.7,
            split_dialogue_min_lines: self.split_dialogue_min_lines.saturating_sub(1).max(2),
            split_dialogue_char_min: (self.split_dialogue_char_min as f64 * 0.75) as usize,
            split_overlong_max_chars: (self.split_overlong_max_chars as f64 * 0.75) as usize,
            split_overlong_max_dur_sec: self.split_overlong_max_dur_sec * 0.85,
        }
    }

    fn sparser(self) -> Self {
        Self {
            merge_single_narration_max_sec: self.merge_single_narration_max_sec * 1.35,
            merge_combined_narration_max_sec: self.merge_combined_narration_max_sec * 1.35,
            split_dialogue_min_lines: self.split_dialogue_min_lines + 1,
            split_dialogue_char_min: (self.split_dialogue_char_min as f64 * 1.35) as usize,
            split_overlong_max_chars: (self.split_overlong_max_chars as f64 * 1.25) as usize,
            split_overlong_max_dur_sec: self.split_overlong_max_dur_sec * 1.2,
        }
    }
}

/// 由解析要求解析切镜密度（体裁默认 + 快/慢节奏覆盖）
pub(crate) fn resolve_cut_profile(hints: &ScriptParseRequirementHints) -> CutProfile {
    let mut base = match hints.style_profile {
        Some(ScriptStyleProfile::Film) => CutProfile::film(),
        Some(ScriptStyleProfile::Ad) => CutProfile::ad(),
        Some(ScriptStyleProfile::Anime) => CutProfile::anime(),
        Some(ScriptStyleProfile::ShortDrama) | Some(ScriptStyleProfile::Auto) | None => {
            CutProfile::short_drama()
        }
    };
    if hints.prefer_sparse_cuts {
        base = base.sparser();
    } else if hints.prefer_dense_cuts {
        base = base.denser();
    }
    base
}

/// 解析「第X集」中的 X（支持阿拉伯数字与常见中文数字）
pub(crate) fn parse_episode_number_token(s: &str) -> Option<u32> {
    let s = s.trim();
    if s.is_empty() {
        return None;
    }
    if s.chars().all(|c| c.is_ascii_digit()) {
        return s.parse::<u32>().ok().filter(|&n| n > 0);
    }
    if s == "十" {
        return Some(10);
    }
    if let Some(rest) = s.strip_prefix('十') {
        if rest.is_empty() {
            return Some(10);
        }
        let ones = rest.chars().next().and_then(chinese_digit_char)?;
        return Some(10 + ones);
    }
    if let Some(prefix) = s.strip_suffix('十') {
        if prefix.is_empty() {
            return Some(10);
        }
        let tens = prefix.chars().next().and_then(chinese_digit_char)?;
        if tens == 0 {
            return None;
        }
        return Some(tens * 10);
    }
    if let Some((tens, ones)) = s.split_once('十') {
        let t = if tens.is_empty() {
            1
        } else {
            tens.chars().next().and_then(chinese_digit_char)?
        };
        let o = if ones.is_empty() {
            0
        } else {
            ones.chars().next().and_then(chinese_digit_char)?
        };
        let n = t * 10 + o;
        return if n > 0 { Some(n) } else { None };
    }
    chinese_digit_char(s.chars().next()?).filter(|&n| n > 0)
}

fn chinese_digit_char(c: char) -> Option<u32> {
    match c {
        '零' | '〇' => Some(0),
        '一' | '壹' => Some(1),
        '二' | '两' | '贰' => Some(2),
        '三' | '叁' => Some(3),
        '四' | '肆' => Some(4),
        '五' | '伍' => Some(5),
        '六' | '陆' => Some(6),
        '七' | '柒' => Some(7),
        '八' | '捌' => Some(8),
        '九' | '玖' => Some(9),
        _ => None,
    }
}

/// 从底栏解析要求提取结构化 hint（短剧 P0：时长类；其余原文交给 LLM）。
pub(crate) fn parse_requirement_hints(requirement: &str) -> ScriptParseRequirementHints {
    let requirement_text = requirement.trim().to_string();
    if requirement_text.is_empty() {
        return ScriptParseRequirementHints::default();
    }

    let per_shot_duration_sec = extract_first_float_after_keywords(
        &requirement_text,
        &[
            "每镜",
            "单镜",
            "每个镜头",
            "每镜头",
            "镜头时长",
        ],
    )
    .or_else(|| {
        extract_labeled_duration(&requirement_text, &["每镜时长", "单镜时长", "镜头时长"])
    });

    let total_duration_sec = extract_first_float_after_keywords(
        &requirement_text,
        &["总时长", "全长", "整体时长", "成片时长"],
    )
    .or_else(|| extract_labeled_duration(&requirement_text, &["总时长", "全长"]));

    let min_shot_duration_sec =
        extract_labeled_duration(&requirement_text, &["最短", "单镜最短", "镜头最短"]);
    let max_shot_duration_sec =
        extract_labeled_duration(&requirement_text, &["最长", "单镜最长", "镜头最长", "不超过"]);

    let shot_size_bias = parse_shot_size_bias(&requirement_text);
    let prefer_reaction_shots = contains_any(
        &requirement_text,
        &[
            "加强反应",
            "反应镜",
            "反应镜头",
            "听者反应",
            "表情反应",
        ],
    ) && !contains_negation(
        &requirement_text,
        &["反应镜", "反应镜头", "反应镜"],
    );
    let prefer_emotion_close_up = (contains_any(
        &requirement_text,
        &[
            "加强情绪",
            "情绪特写",
            "加强特写",
            "面部特写",
            "微表情",
        ],
    ) || shot_size_bias == ShotSizeBias::CloseUp)
        && !contains_negation(&requirement_text, &["特写", "情绪特写"]);
    let reduce_establishing_wides = contains_any(
        &requirement_text,
        &["少用全景", "少全景", "紧凑节奏", "快节奏", "不要全景"],
    ) || (contains_any(&requirement_text, &["快剪", "多切镜", "切镜密"])
        && !contains_negation(&requirement_text, &["全景"]));

    let prefer_dense_cuts = contains_any(
        &requirement_text,
        &[
            "快剪",
            "快节奏",
            "多切镜",
            "切镜密",
            "密集切镜",
            "爽感",
            "卡点",
        ],
    ) && !contains_negation(&requirement_text, &["快剪", "切镜"]);
    let prefer_sparse_cuts = contains_any(
        &requirement_text,
        &[
            "慢节奏",
            "少切镜",
            "长镜头",
            "一镜到底",
            "疏",
            "电影感节奏",
        ],
    ) && !contains_negation(&requirement_text, &["长镜头"]);

    let skip_character_arc = contains_any(
        &requirement_text,
        &[
            "跳过人物弧",
            "不要人物弧",
            "仅分镜",
            "只做分镜",
            "不要弧光",
        ],
    );
    let skip_dialogue_rewrite = super::script_dialogue_rewrite::parse_skip_dialogue_rewrite(
        &requirement_text,
    );

    let style_profile = parse_coarse_style_from_requirement(&requirement_text);
    let episode_only = parse_episode_scope_from_requirement(&requirement_text);

    let mut hints = ScriptParseRequirementHints {
        requirement_text,
        per_shot_duration_sec,
        total_duration_sec,
        min_shot_duration_sec,
        max_shot_duration_sec,
        shot_size_bias,
        prefer_reaction_shots,
        prefer_emotion_close_up,
        reduce_establishing_wides,
        style_profile,
        episode_only,
        prefer_dense_cuts,
        prefer_sparse_cuts,
        skip_character_arc,
        skip_dialogue_rewrite,
    };
    apply_style_profile_defaults(
        &mut hints,
        shot_size_bias,
        prefer_reaction_shots,
        reduce_establishing_wides,
    );
    if contains_negation(
        &hints.requirement_text,
        &["反应镜", "反应镜头", "反应镜"],
    ) {
        hints.prefer_reaction_shots = false;
    }
    hints
}

/// 粗粒度体裁词（用户可能只写「短剧」「电影」等）
fn parse_coarse_style_from_requirement(text: &str) -> Option<ScriptStyleProfile> {
    let t = text.trim();
    if t.is_empty() {
        return None;
    }
    if contains_any(
        t,
        &["广告", "tvc", "TVC", "品牌片", "宣传片", "商业片", "种草", "带货", "mv", "MV"],
    ) {
        return Some(ScriptStyleProfile::Ad);
    }
    if contains_any(t, &["动漫", "番剧", "二次元", "动画", "番剧分镜", "国漫"]) {
        return Some(ScriptStyleProfile::Anime);
    }
    if contains_any(
        t,
        &["电影", "院线", "长片", "微电影", "电影感", "预告片", "片花"],
    ) {
        return Some(ScriptStyleProfile::Film);
    }
    if contains_any(t, &["短剧", "竖屏", "微短剧", "爽剧", "网剧", "竖屏剧", "甜宠", "霸总"]) {
        return Some(ScriptStyleProfile::ShortDrama);
    }
    None
}

/// 「先输出第一集」「第2集」等集数范围
pub(crate) fn parse_episode_scope_from_requirement(text: &str) -> Option<u32> {
    let t = text.trim();
    if t.is_empty() {
        return None;
    }
    let lower = t.to_lowercase();
    if let Some(n) = parse_ep_token_anywhere(&lower) {
        return Some(n);
    }
    if let Some(pos) = lower.find("episode") {
        let rest = &t[pos + "episode".len()..];
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
    let has_episode_intent = t.contains('集')
        || contains_any(
            t,
            &[
                "先输出",
                "只要",
                "仅",
                "只出",
                "只解析",
                "先解析",
                "仅解析",
                "先拆",
            ],
        );
    if !has_episode_intent {
        return None;
    }
    let mut search = t;
    while let Some(di_pos) = search.find('第') {
        let rest = &search[di_pos + '第'.len_utf8()..];
        if let Some(ji_pos) = rest.find('集') {
            let token = rest[..ji_pos].trim();
            if let Some(n) = parse_episode_number_token(token) {
                return Some(n);
            }
        }
        search = &search[di_pos + '第'.len_utf8()..];
    }
    if contains_any(t, &["一集", "1集", "第一集", "第1集"]) {
        return Some(1);
    }
    None
}

fn apply_style_profile_defaults(
    hints: &mut ScriptParseRequirementHints,
    explicit_shot_bias: ShotSizeBias,
    explicit_reaction: bool,
    explicit_reduce_wide: bool,
) {
    let Some(style) = hints.style_profile else {
        return;
    };
    match style {
        ScriptStyleProfile::ShortDrama => {
            if explicit_shot_bias == ShotSizeBias::None {
                hints.shot_size_bias = ShotSizeBias::CloseUp;
            }
            if !explicit_reaction {
                hints.prefer_reaction_shots = true;
            }
            if !explicit_reduce_wide {
                hints.reduce_establishing_wides = true;
            }
            hints.prefer_emotion_close_up = hints.prefer_emotion_close_up
                || hints.shot_size_bias == ShotSizeBias::CloseUp;
            if hints.per_shot_duration_sec.is_none() {
                hints.per_shot_duration_sec = Some(2.5);
            }
            if hints.max_shot_duration_sec.is_none() {
                hints.max_shot_duration_sec = Some(3.5);
            }
        }
        ScriptStyleProfile::Film => {
            if explicit_shot_bias == ShotSizeBias::None {
                hints.shot_size_bias = ShotSizeBias::Medium;
            }
            if !explicit_reaction {
                hints.prefer_reaction_shots = false;
            }
            if hints.per_shot_duration_sec.is_none() {
                hints.per_shot_duration_sec = Some(4.0);
            }
            if hints.max_shot_duration_sec.is_none() {
                hints.max_shot_duration_sec = Some(8.0);
            }
            if !hints.prefer_dense_cuts && !hints.prefer_sparse_cuts {
                hints.prefer_sparse_cuts = true;
            }
        }
        ScriptStyleProfile::Ad => {
            if explicit_shot_bias == ShotSizeBias::None {
                hints.shot_size_bias = ShotSizeBias::CloseUp;
            }
            if !explicit_reduce_wide {
                hints.reduce_establishing_wides = true;
            }
            if !hints.prefer_sparse_cuts {
                hints.prefer_dense_cuts = true;
            }
            if hints.per_shot_duration_sec.is_none() {
                hints.per_shot_duration_sec = Some(2.0);
            }
            if hints.max_shot_duration_sec.is_none() {
                hints.max_shot_duration_sec = Some(3.0);
            }
        }
        ScriptStyleProfile::Anime => {
            if explicit_shot_bias == ShotSizeBias::None {
                hints.shot_size_bias = ShotSizeBias::Medium;
            }
            if hints.per_shot_duration_sec.is_none() {
                hints.per_shot_duration_sec = Some(2.5);
            }
        }
        ScriptStyleProfile::Auto => {}
    }
}

fn contains_any(text: &str, keywords: &[&str]) -> bool {
    keywords.iter().any(|k| text.contains(k))
}

/// 「不要反应镜」「别加快剪」等否定表达
fn contains_negation(text: &str, targets: &[&str]) -> bool {
    const NEG_PREFIXES: &[&str] = &["不要", "无需", "别", "禁止", "不需", "不需要", "少加", "别加"];
    targets.iter().any(|target| {
        NEG_PREFIXES
            .iter()
            .any(|neg| text.contains(&format!("{neg}{target}")))
    })
}

fn parse_ep_token_anywhere(lower: &str) -> Option<u32> {
    let mut search = lower;
    while let Some(pos) = search.find("ep") {
        let rest = &search[pos + 2..];
        let digits: String = rest
            .chars()
            .take_while(|c| c.is_ascii_digit())
            .collect();
        if let Ok(n) = digits.parse::<u32>() {
            if n > 0 {
                return Some(n);
            }
        }
        search = &search[pos + 2..];
    }
    None
}

fn parse_shot_size_bias(text: &str) -> ShotSizeBias {
    if contains_any(
        text,
        &[
            "特写为主",
            "特写偏多",
            "近景为主",
            "近景特写",
            "多用特写",
            "特写镜头",
            "面部特写",
        ],
    ) || (text.contains("加强特写") && !text.contains("不要特写"))
    {
        return ShotSizeBias::CloseUp;
    }
    if contains_any(text, &["中景为主", "多用中景", "中景镜头"]) {
        return ShotSizeBias::Medium;
    }
    if contains_any(
        text,
        &["全景为主", "多用全景", "强调环境", "建立空间", "大全景"],
    ) {
        return ShotSizeBias::Wide;
    }
    ShotSizeBias::None
}

/// 按解析要求将景别向更近/更远推进一步（黑场/主观镜不改动）。
pub(crate) fn bias_shot_size(
    current: &str,
    bias: ShotSizeBias,
    emotion_close_up: bool,
    has_emotion: bool,
) -> String {
    if current.contains("黑场") || current.contains("主观") {
        return current.to_string();
    }
    let mut size = current.to_string();
    match bias {
        ShotSizeBias::CloseUp => {
            size = step_shot_size_closer(&size);
            if emotion_close_up && has_emotion {
                size = step_shot_size_closer(&size);
            }
        }
        ShotSizeBias::Wide => {
            size = step_shot_size_wider(&size);
        }
        ShotSizeBias::Medium => {
            if size.contains("大特写") || size.contains("特写") {
                size = "近景".to_string();
            } else if size.contains("全景") {
                size = "中景".to_string();
            }
        }
        ShotSizeBias::None => {
            if emotion_close_up && has_emotion {
                size = step_shot_size_closer(&size);
            }
        }
    }
    size
}

fn step_shot_size_closer(size: &str) -> String {
    if size.contains("全景") {
        return "中景".to_string();
    }
    if size.contains("中景") && !size.contains('近') {
        return "中近景".to_string();
    }
    if size.contains("中近景") {
        return "近景".to_string();
    }
    if size.contains("近景") && !size.contains("特写") {
        return "特写".to_string();
    }
    if size.contains("特写") && !size.contains("大特写") {
        return "大特写".to_string();
    }
    size.to_string()
}

fn step_shot_size_wider(size: &str) -> String {
    if size.contains("大特写") {
        return "特写".to_string();
    }
    if size.contains("特写") {
        return "近景".to_string();
    }
    if size.contains("近景") {
        return "中近景".to_string();
    }
    if size.contains("中近景") {
        return "中景".to_string();
    }
    if size.contains("中景") && !size.contains("全") {
        return "全景".to_string();
    }
    size.to_string()
}

fn extract_labeled_duration(text: &str, labels: &[&str]) -> Option<f64> {
    for label in labels {
        if let Some(v) = extract_after_label(text, label) {
            return Some(v);
        }
    }
    None
}

fn extract_first_float_after_keywords(text: &str, keywords: &[&str]) -> Option<f64> {
    for kw in keywords {
        if let Some(rest) = text.split(kw).nth(1) {
            if let Some(v) = parse_leading_duration(rest) {
                return Some(v);
            }
        }
    }
    None
}

fn extract_after_label(text: &str, label: &str) -> Option<f64> {
    for line in text.lines() {
        let t = line.trim();
        if !t.contains(label) {
            continue;
        }
        let after = t.split(label).last().unwrap_or("");
        if let Some(v) = parse_leading_duration(after) {
            return Some(v);
        }
    }
    None
}

/// 从片段开头解析「3秒」「3.5 秒」「3s」等。
fn parse_leading_duration(fragment: &str) -> Option<f64> {
    let s = fragment.trim();
    let mut num = String::new();
    let mut seen_digit = false;
    for ch in s.chars() {
        if ch.is_ascii_digit() || (ch == '.' && seen_digit && !num.contains('.')) {
            num.push(ch);
            seen_digit = true;
        } else if seen_digit {
            break;
        }
    }
    if num.is_empty() {
        return None;
    }
    let v: f64 = num.parse().ok()?;
    if v > 0.0 && v <= 600.0 {
        Some(v)
    } else {
        None
    }
}

/// 将解析要求中的时长类约束应用到规则引擎产出的镜头规划。
pub(crate) fn apply_requirement_hints_to_shots(
    shots: &mut [ShotPlan],
    hints: &ScriptParseRequirementHints,
) {
    if shots.is_empty() {
        return;
    }

    let min_d = hints.min_shot_duration_sec.unwrap_or(0.5);
    let max_d = hints.max_shot_duration_sec.unwrap_or(15.0);
    let clamp_min = min_d.min(max_d);
    let clamp_max = min_d.max(max_d);

    if let Some(per) = hints.per_shot_duration_sec {
        let target = per.clamp(clamp_min, clamp_max);
        for shot in shots.iter_mut() {
            shot.estimated_duration_sec = target;
        }
    }

    if let Some(total) = hints.total_duration_sec {
        let current: f64 = shots.iter().map(|s| s.estimated_duration_sec).sum();
        if current > 0.0 {
            let factor = total / current;
            for shot in shots.iter_mut() {
                shot.estimated_duration_sec =
                    (shot.estimated_duration_sec * factor).clamp(clamp_min, clamp_max);
            }
        }
    }

    for shot in shots.iter_mut() {
        shot.estimated_duration_sec = shot.estimated_duration_sec.clamp(clamp_min, clamp_max);
    }
}

pub(crate) fn requirement_hints_json(hints: &ScriptParseRequirementHints) -> Value {
    let bias = match hints.shot_size_bias {
        ShotSizeBias::None => "none",
        ShotSizeBias::CloseUp => "close_up",
        ShotSizeBias::Medium => "medium",
        ShotSizeBias::Wide => "wide",
    };
    let style = hints
        .style_profile
        .map(style_profile_name)
        .unwrap_or("none");
    json!({
        "requirementLen": hints.requirement_text.chars().count(),
        "perShotDurationSec": hints.per_shot_duration_sec,
        "totalDurationSec": hints.total_duration_sec,
        "minShotDurationSec": hints.min_shot_duration_sec,
        "maxShotDurationSec": hints.max_shot_duration_sec,
        "shotSizeBias": bias,
        "preferReactionShots": hints.prefer_reaction_shots,
        "preferEmotionCloseUp": hints.prefer_emotion_close_up,
        "reduceEstablishingWides": hints.reduce_establishing_wides,
        "styleProfile": style,
        "episodeOnly": hints.episode_only,
        "preferDenseCuts": hints.prefer_dense_cuts,
        "preferSparseCuts": hints.prefer_sparse_cuts,
        "skipCharacterArc": hints.skip_character_arc,
        "skipDialogueRewrite": hints.skip_dialogue_rewrite,
    })
}

pub(crate) fn style_profile_label(style: ScriptStyleProfile) -> &'static str {
    match style {
        ScriptStyleProfile::Auto => "自动",
        ScriptStyleProfile::ShortDrama => "竖屏短剧",
        ScriptStyleProfile::Film => "电影",
        ScriptStyleProfile::Anime => "动漫",
        ScriptStyleProfile::Ad => "广告",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_cinematography_hints() {
        let hints = parse_requirement_hints(
            "近景特写为主，加强反应镜，少用全景，每镜2秒",
        );
        assert_eq!(hints.shot_size_bias, ShotSizeBias::CloseUp);
        assert!(hints.prefer_reaction_shots);
        assert!(hints.reduce_establishing_wides);
        assert_eq!(hints.per_shot_duration_sec, Some(2.0));
    }

    #[test]
    fn bias_shot_size_moves_closer() {
        assert_eq!(
            bias_shot_size("中景", ShotSizeBias::CloseUp, false, false),
            "中近景"
        );
        assert_eq!(
            bias_shot_size("中近景", ShotSizeBias::CloseUp, true, true),
            "特写"
        );
    }

    #[test]
    fn parses_per_shot_and_total_duration() {
        let hints = parse_requirement_hints(
            "竖屏短剧，每镜3秒，总时长90秒，加强情绪特写",
        );
        assert_eq!(hints.per_shot_duration_sec, Some(3.0));
        assert_eq!(hints.total_duration_sec, Some(90.0));
        assert!(hints.prefer_emotion_close_up);
    }

    #[test]
    fn apply_per_shot_overrides_estimates() {
        let mut shots = vec![ShotPlan {
            estimated_duration_sec: 2.0,
            ..ShotPlan::default()
        }];
        let hints = parse_requirement_hints("每镜 2.5 秒");
        apply_requirement_hints_to_shots(&mut shots, &hints);
        assert!((shots[0].estimated_duration_sec - 2.5).abs() < f64::EPSILON);
    }

    #[test]
    fn apply_total_scales_proportionally() {
        let mut shots = vec![
            ShotPlan {
                estimated_duration_sec: 2.0,
                ..ShotPlan::default()
            },
            ShotPlan {
                estimated_duration_sec: 4.0,
                ..ShotPlan::default()
            },
        ];
        let hints = parse_requirement_hints("总时长 6 秒");
        apply_requirement_hints_to_shots(&mut shots, &hints);
        let sum: f64 = shots.iter().map(|s| s.estimated_duration_sec).sum();
        assert!((sum - 6.0).abs() < 0.01);
    }

    #[test]
    fn parses_coarse_short_drama_keyword() {
        let hints = parse_requirement_hints("短剧");
        assert_eq!(hints.style_profile, Some(ScriptStyleProfile::ShortDrama));
        assert_eq!(hints.shot_size_bias, ShotSizeBias::CloseUp);
        assert!(hints.prefer_reaction_shots);
        assert_eq!(hints.per_shot_duration_sec, Some(2.5));
        assert!(hints.episode_only.is_none());
    }

    #[test]
    fn parses_coarse_film_and_episode_scope() {
        let hints = parse_requirement_hints("电影 先输出第一集");
        assert_eq!(hints.style_profile, Some(ScriptStyleProfile::Film));
        assert_eq!(hints.episode_only, Some(1));
        assert_eq!(hints.shot_size_bias, ShotSizeBias::Medium);
        assert_eq!(hints.per_shot_duration_sec, Some(4.0));
    }

    #[test]
    fn parses_ad_keyword() {
        let hints = parse_requirement_hints("广告");
        assert_eq!(hints.style_profile, Some(ScriptStyleProfile::Ad));
        assert_eq!(hints.shot_size_bias, ShotSizeBias::CloseUp);
        assert_eq!(hints.per_shot_duration_sec, Some(2.0));
    }

    #[test]
    fn parses_skip_character_arc() {
        let hints = parse_requirement_hints("短剧 仅分镜");
        assert!(hints.skip_character_arc);
        let ok = parse_requirement_hints("短剧 加强反应镜");
        assert!(!ok.skip_character_arc);
    }

    #[test]
    fn parses_chinese_episode_numbers() {
        assert_eq!(parse_episode_number_token("1"), Some(1));
        assert_eq!(parse_episode_number_token("一"), Some(1));
        assert_eq!(parse_episode_number_token("十二"), Some(12));
        assert_eq!(parse_episode_scope_from_requirement("先输出第二集"), Some(2));
        assert_eq!(parse_episode_scope_from_requirement("ep1"), Some(1));
        assert_eq!(parse_episode_scope_from_requirement("先拆 EP03"), Some(3));
    }

    #[test]
    fn film_profile_prefers_sparse_cuts() {
        let hints = parse_requirement_hints("电影");
        assert_eq!(hints.style_profile, Some(ScriptStyleProfile::Film));
        assert!(hints.prefer_sparse_cuts);
        let cut = resolve_cut_profile(&hints);
        assert!(cut.merge_combined_narration_max_sec > CutProfile::short_drama().merge_combined_narration_max_sec);
    }

    #[test]
    fn ad_profile_prefers_dense_cuts() {
        let hints = parse_requirement_hints("广告");
        assert!(hints.prefer_dense_cuts);
        let cut = resolve_cut_profile(&hints);
        assert!(cut.split_dialogue_char_min < CutProfile::short_drama().split_dialogue_char_min);
    }

    #[test]
    fn negation_disables_reaction_shots() {
        let hints = parse_requirement_hints("短剧 不要反应镜");
        assert!(!hints.prefer_reaction_shots);
    }

    #[test]
    fn slow_rhythm_overrides_style_dense() {
        let hints = parse_requirement_hints("广告 慢节奏");
        let cut = resolve_cut_profile(&hints);
        let ad_dense = resolve_cut_profile(&parse_requirement_hints("广告"));
        assert!(cut.merge_combined_narration_max_sec > ad_dense.merge_combined_narration_max_sec);
    }
}
