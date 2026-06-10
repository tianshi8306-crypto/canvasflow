use serde::Deserialize;
use serde_json::json;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScriptBeatOut {
    #[serde(default)]
    pub(crate) serial_number: i64,
    #[serde(default)]
    pub(crate) duration: f64,
    #[serde(default)]
    pub(crate) shot_desc: String,
    #[serde(default)]
    pub(crate) dialogue: String,
    #[serde(default)]
    pub(crate) seedance_positive: String,
    #[serde(default)]
    pub(crate) seedance_negative: String,
    #[serde(default)]
    pub(crate) characters_in_shot: Vec<String>,
    #[serde(default)]
    pub(crate) emotion: String,
    #[serde(default)]
    pub(crate) narrative_purpose: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScriptEnumsConfig {
    pub(crate) shot_type: Vec<String>,
    pub(crate) emotion: Vec<String>,
    pub(crate) camera_move: Vec<String>,
}

pub(crate) fn script_enums_config() -> ScriptEnumsConfig {
    serde_json::from_str(include_str!("../../../src/shared/config/script-enums.json"))
        .unwrap_or_else(|_| ScriptEnumsConfig {
            shot_type: vec!["全景".into(), "中景".into(), "近景".into(), "特写".into(), "大特写".into()],
            emotion: vec![
                "平静".into(),
                "紧张".into(),
                "愤怒".into(),
                "悲伤".into(),
                "喜悦".into(),
                "惊讶".into(),
                "恐惧".into(),
                "坚定".into(),
                "疑惑".into(),
                "无".into(),
            ],
            camera_move: vec![
                "固定".into(),
                "推".into(),
                "拉".into(),
                "摇".into(),
                "移".into(),
                "跟".into(),
                "环绕".into(),
            ],
        })
}

pub(crate) fn normalize_script_beats(parsed: Vec<ScriptBeatOut>) -> Vec<serde_json::Value> {
    let mut timeline_cursor = 0.0_f64;
    parsed
        .into_iter()
        .enumerate()
        .map(|(idx, b)| {
            let serial = if b.serial_number <= 0 {
                (idx as i64) + 1
            } else {
                b.serial_number
            };
            let duration_secs = if b.duration <= 0.0 {
                3.0
            } else if b.duration > 15.0 {
                15.0
            } else {
                b.duration
            };
            let duration_hint = format!("{:.1}s", duration_secs);
            let time_in = timeline_cursor;
            let time_out = timeline_cursor + duration_secs;
            timeline_cursor = time_out;

            let id = uuid::Uuid::new_v4().to_string();
            let characters_json: Vec<serde_json::Value> = b.characters_in_shot.iter().map(|name| {
                json!({
                    "id": uuid::Uuid::new_v4().to_string(),
                    "name": name,
                    "description": "",
                    "imagePath": "",
                    "reference": "",
                    "action": "",
                    "emotion": "",
                    "lines": "",
                })
            }).collect();

            json!({
                "id": id,
                "shotId": id.clone(),
                "shotNumber": serial.to_string(),
                "durationHint": duration_hint,
                "timeIn": time_in,
                "timeOut": time_out,
                "description": b.shot_desc.trim(),
                "dialogue": b.dialogue.trim(),
                "characters": characters_json,
                "emotion": b.emotion.trim(),
                "sceneTags": b.narrative_purpose.trim(),
                "storyboardPrompt": b.seedance_positive.trim(),
                "seedancePositive": b.seedance_positive.trim(),
                "seedanceNegative": b.seedance_negative.trim(),
            })
        })
        .collect()
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ScriptStyleProfile {
    Auto,
    ShortDrama,
    Film,
    Anime,
    Ad,
}

pub(crate) fn parse_style_profile(params: &serde_json::Value) -> ScriptStyleProfile {
    let raw = params
        .get("styleProfile")
        .and_then(|v| v.as_str())
        .unwrap_or("auto")
        .trim()
        .to_lowercase();
    match raw.as_str() {
        "short_drama" => ScriptStyleProfile::ShortDrama,
        "film" => ScriptStyleProfile::Film,
        "anime" => ScriptStyleProfile::Anime,
        "ad" => ScriptStyleProfile::Ad,
        _ => ScriptStyleProfile::Auto,
    }
}

pub(crate) fn detect_style_from_text(requirement: &str, source: &str) -> ScriptStyleProfile {
    let s = format!("{}\n{}", requirement, source).to_lowercase();
    if s.contains("广告分镜") || s.contains("品牌广告") || s.contains("商业广告") {
        return ScriptStyleProfile::Ad;
    }
    if s.contains("动漫分镜") || s.contains("二次元分镜") {
        return ScriptStyleProfile::Anime;
    }
    if s.contains("电影分镜") || s.contains("院线分镜") {
        return ScriptStyleProfile::Film;
    }
    if s.contains("短剧分镜") || s.contains("竖屏短剧") {
        return ScriptStyleProfile::ShortDrama;
    }
    if s.contains("广告") || s.contains("品牌") || s.contains("卖点") || s.contains("产品") {
        return ScriptStyleProfile::Ad;
    }
    if s.contains("动漫") || s.contains("二次元") || s.contains("番剧") || s.contains("赛璐璐") {
        return ScriptStyleProfile::Anime;
    }
    if s.contains("电影") || s.contains("院线") || s.contains("长镜头") || s.contains("镜头语言") {
        return ScriptStyleProfile::Film;
    }
    ScriptStyleProfile::Film
}

pub(crate) fn style_profile_name(style: ScriptStyleProfile) -> &'static str {
    match style {
        ScriptStyleProfile::Auto => "auto",
        ScriptStyleProfile::ShortDrama => "short_drama",
        ScriptStyleProfile::Film => "film",
        ScriptStyleProfile::Anime => "anime",
        ScriptStyleProfile::Ad => "ad",
    }
}
