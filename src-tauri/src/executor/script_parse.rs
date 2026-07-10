use serde::Deserialize;
use serde_json::json;

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScriptBeatOut {
    #[serde(default)]
    pub(crate) serial_number: i64,
    #[serde(default)]
    pub(crate) duration: f64,
    /// 纯画面描述（LLM 输出）
    #[serde(default)]
    pub(crate) shot_desc: String,
    /// 完整分镜块（Markdown，供导出/预览）
    #[serde(default)]
    pub(crate) storyboard_block: String,
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
    #[serde(default)]
    pub(crate) scene_heading: String,
    #[serde(default)]
    pub(crate) episode_scene_shot: String,
    #[serde(default)]
    pub(crate) shot_size: String,
    #[serde(default)]
    pub(crate) camera_move: String,
    #[serde(default)]
    pub(crate) camera_angle: String,
    #[serde(default)]
    pub(crate) sound_hint: String,
    #[serde(default)]
    pub(crate) edit_focus: String,
    #[serde(default)]
    pub(crate) rhythm_tag: String,
    #[serde(default)]
    pub(crate) is_reaction_shot: bool,
    #[serde(default)]
    pub(crate) dialogue_type: String,
    #[serde(default)]
    pub(crate) performance_note: String,
    #[serde(default)]
    pub(crate) bgm_hint: String,
    #[serde(default)]
    pub(crate) lighting_mood: String,
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

pub(crate) fn scene_key_from_heading(heading: &str) -> String {
    let t = heading.trim();
    if t.is_empty() {
        return "0-0".to_string();
    }
    let mut out = String::new();
    for ch in t.chars() {
        if ch.is_ascii_digit() || ch == '-' {
            out.push(ch);
        } else if !out.is_empty() {
            break;
        }
    }
    if out.contains('-') && out.chars().any(|c| c.is_ascii_digit()) {
        return out;
    }
    "0-0".to_string()
}

pub(crate) fn normalize_shot_size(raw: &str) -> String {
    let t = raw.trim();
    if t.is_empty() {
        return String::new();
    }
    if t.contains("大特写") {
        return "大特写".to_string();
    }
    if t.contains("特写") {
        return "特写".to_string();
    }
    if t.contains("中近景") {
        return "中近景".to_string();
    }
    if t.contains("全景") || t.contains("黑场") {
        return "全景".to_string();
    }
    if t.contains("中景") {
        return "中景".to_string();
    }
    if t.contains("近景") || t.contains("主观") {
        return "近景".to_string();
    }
    t.to_string()
}

pub(crate) fn normalize_camera_move(raw: &str) -> String {
    let t = raw.trim();
    if t.is_empty() || t == "无" {
        return if t == "无" {
            "固定".to_string()
        } else {
            String::new()
        };
    }
    if t == "固定" || t == "推" || t == "拉" || t == "摇" || t == "移" || t == "跟" || t == "环绕" {
        return t.to_string();
    }
    if t.contains('跟') {
        return "跟".to_string();
    }
    if t.contains('推') {
        return "推".to_string();
    }
    if t.contains('拉') {
        return "拉".to_string();
    }
    if t.contains('摇') {
        return "摇".to_string();
    }
    if t.contains('移') || t.contains("横移") {
        return "移".to_string();
    }
    if t.contains("环绕") {
        return "环绕".to_string();
    }
    if t.contains("固定") {
        return "固定".to_string();
    }
    t.to_string()
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

            let shot_number = if b.episode_scene_shot.trim().is_empty() {
                serial.to_string()
            } else {
                b.episode_scene_shot.trim().to_string()
            };
            let shot_size = normalize_shot_size(&b.shot_size);
            let camera_move = normalize_camera_move(&b.camera_move);
            let rhythm_tag = if b.rhythm_tag.trim().is_empty() {
                b.narrative_purpose.trim()
            } else {
                b.rhythm_tag.trim()
            };

            let id = uuid::Uuid::new_v4().to_string();
            let dialogue_trim = b.dialogue.trim();
            let characters_json: Vec<serde_json::Value> = b
                .characters_in_shot
                .iter()
                .map(|name| {
                    let lines = if b.characters_in_shot.len() == 1 && !dialogue_trim.is_empty() {
                        dialogue_trim.to_string()
                    } else {
                        String::new()
                    };
                    json!({
                        "id": uuid::Uuid::new_v4().to_string(),
                        "name": name,
                        "description": "",
                        "imagePath": "",
                        "reference": "",
                        "action": "",
                        "emotion": b.emotion.trim(),
                        "lines": lines,
                    })
                })
                .collect();

            json!({
                "id": id,
                "shotId": id.clone(),
                "shotNumber": shot_number,
                "episodeSceneShot": b.episode_scene_shot.trim(),
                "durationHint": duration_hint,
                "timeIn": time_in,
                "timeOut": time_out,
                "description": b.shot_desc.trim(),
                "storyboardBlock": b.storyboard_block.trim(),
                "dialogue": dialogue_trim,
                "characters": characters_json,
                "emotion": b.emotion.trim(),
                "sceneHeading": b.scene_heading.trim(),
                "shotSize": shot_size,
                "cameraMove": camera_move,
                "cameraAngle": b.camera_angle.trim(),
                "soundHint": b.sound_hint.trim(),
                "editFocus": b.edit_focus.trim(),
                "rhythmTag": rhythm_tag,
                "sceneTags": rhythm_tag,
                "isReactionShot": b.is_reaction_shot,
                "dialogueType": b.dialogue_type.trim(),
                "performanceNote": b.performance_note.trim(),
                "bgmHint": b.bgm_hint.trim(),
                "lightingMood": b.lighting_mood.trim(),
                "storyboardPrompt": "",
                "seedancePositive": b.seedance_positive.trim(),
                "seedanceNegative": b.seedance_negative.trim(),
            })
        })
        .collect()
}

/// 集级节奏报告：前 30 秒钩子、特写占比等
pub(crate) fn build_script_rhythm_report(parsed: &[ScriptBeatOut]) -> serde_json::Value {
    let shot_count = parsed.len();
    let total_duration_sec: f64 = parsed
        .iter()
        .map(|b| {
            if b.duration <= 0.0 {
                3.0
            } else {
                b.duration.min(15.0)
            }
        })
        .sum();
    let close_up_count = parsed
        .iter()
        .filter(|b| {
            let s = normalize_shot_size(&b.shot_size);
            s == "特写" || s == "大特写" || s == "近景" || s == "中近景"
        })
        .count();
    let close_up_ratio = if shot_count == 0 {
        0.0
    } else {
        close_up_count as f64 / shot_count as f64
    };
    let mut cursor = 0.0_f64;
    let mut hook_parts: Vec<String> = Vec::new();
    let mut first_30s_shot_count = 0usize;
    for b in parsed {
        let dur = if b.duration <= 0.0 {
            3.0
        } else {
            b.duration.min(15.0)
        };
        if cursor < 30.0 {
            first_30s_shot_count += 1;
            let tag = b.rhythm_tag.trim();
            let desc = b.shot_desc.trim();
            let label = if tag.contains("钩子")
                || tag.contains("转折")
                || tag.contains("高潮")
                || tag.contains("悬念")
            {
                tag.to_string()
            } else if desc.chars().count() > 40 {
                format!("{}…", desc.chars().take(40).collect::<String>())
            } else {
                desc.to_string()
            };
            if !label.is_empty() {
                hook_parts.push(format!("{:.0}s {}", cursor, label));
            }
        }
        cursor += dur;
    }
    let close_up_percent = (close_up_ratio * 100.0).round() as i64;
    json!({
        "totalDurationSec": total_duration_sec,
        "shotCount": shot_count,
        "closeUpRatio": (close_up_ratio * 1000.0).round() / 1000.0,
        "closeUpPercent": close_up_percent,
        "first30sShotCount": first_30s_shot_count,
        "first30sHook": hook_parts.join("；"),
    })
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
    if s.contains("短剧") || s.contains("竖屏") || s.contains("微短剧") {
        return ScriptStyleProfile::ShortDrama;
    }
    // 默认竖屏短剧（与 script_pipeline / script_decision 默认策略一致）
    ScriptStyleProfile::ShortDrama
}

#[cfg(test)]
mod normalize_tests {
    use super::*;

    #[test]
    fn test_normalize_script_beats_structured_fields() {
        let out = normalize_script_beats(vec![ScriptBeatOut {
            serial_number: 3,
            duration: 2.5,
            shot_desc: "陈南挥手".to_string(),
            storyboard_block: "时长：2.5秒\n景别：近景".to_string(),
            dialogue: "陈南：喂！".to_string(),
            scene_heading: "1-2日 外 公路".to_string(),
            episode_scene_shot: "1-2-03".to_string(),
            shot_size: "中近景".to_string(),
            camera_move: "跟拍（侧）".to_string(),
            camera_angle: "平视".to_string(),
            sound_hint: "环境声".to_string(),
            edit_focus: "硬切".to_string(),
            rhythm_tag: "推进剧情".to_string(),
            is_reaction_shot: false,
            dialogue_type: "对白".to_string(),
            performance_note: "兴奋".to_string(),
            bgm_hint: "叙事铺底（轻）".to_string(),
            lighting_mood: "冷色侧光".to_string(),
            ..ScriptBeatOut::default()
        }]);
        let beat = &out[0];
        assert_eq!(beat.get("shotNumber").and_then(|v| v.as_str()), Some("1-2-03"));
        assert_eq!(beat.get("shotSize").and_then(|v| v.as_str()), Some("中近景"));
        assert_eq!(beat.get("cameraMove").and_then(|v| v.as_str()), Some("跟"));
        assert_eq!(beat.get("description").and_then(|v| v.as_str()), Some("陈南挥手"));
        assert_eq!(beat.get("rhythmTag").and_then(|v| v.as_str()), Some("推进剧情"));
        assert_eq!(beat.get("sceneTags").and_then(|v| v.as_str()), Some("推进剧情"));
        assert_eq!(beat.get("dialogueType").and_then(|v| v.as_str()), Some("对白"));
        assert_eq!(beat.get("performanceNote").and_then(|v| v.as_str()), Some("兴奋"));
        assert_eq!(beat.get("bgmHint").and_then(|v| v.as_str()), Some("叙事铺底（轻）"));
        assert_eq!(beat.get("lightingMood").and_then(|v| v.as_str()), Some("冷色侧光"));
    }

    #[test]
    fn test_build_script_rhythm_report() {
        let report = build_script_rhythm_report(&[
            ScriptBeatOut {
                duration: 5.0,
                shot_size: "特写".to_string(),
                shot_desc: "钩子镜头".to_string(),
                rhythm_tag: "悬念钩子".to_string(),
                ..ScriptBeatOut::default()
            },
            ScriptBeatOut {
                duration: 4.0,
                shot_size: "全景".to_string(),
                shot_desc: "建立".to_string(),
                ..ScriptBeatOut::default()
            },
        ]);
        assert_eq!(report.get("shotCount").and_then(|v| v.as_u64()), Some(2));
        assert_eq!(report.get("closeUpPercent").and_then(|v| v.as_i64()), Some(50));
        assert!(report.get("first30sHook").and_then(|v| v.as_str()).unwrap_or("").contains("钩子"));
    }
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
