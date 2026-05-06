use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScriptRoleOut {
    #[serde(default)]
    role_name: String,
    #[serde(default)]
    role_desc: String,
    #[serde(default)]
    action: String,
    #[serde(default)]
    emotion: String,
    #[serde(default)]
    lines: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScriptBeatOut {
    #[serde(default)]
    serial_number: i64,
    #[serde(default)]
    act_number: i64,
    #[serde(default)]
    scene: String,
    #[serde(default)]
    duration: f64,
    #[serde(default)]
    shot_desc: String,
    #[serde(default)]
    roles: Vec<ScriptRoleOut>,
    #[serde(default)]
    shot_type: String,
    #[serde(default)]
    camera_move: String,
    #[serde(default)]
    #[serde(alias = "lightAtmosphere")]
    lighting_mood: String,
    #[serde(default)]
    sound_effect: String,
    #[serde(default)]
    reference: String,
    #[serde(default)]
    storyboard_prompt: String,
    #[serde(default)]
    video_motion_prompt: String,
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

fn clamp_enum(value: &str, allowed: &[String], fallback: &str) -> String {
    let v = value.trim();
    if allowed.iter().any(|x| x == v) {
        v.to_string()
    } else {
        fallback.to_string()
    }
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

pub(crate) fn style_profile_directive(style: ScriptStyleProfile) -> &'static str {
    match style {
        ScriptStyleProfile::ShortDrama => {
            "【风格策略：短剧量产】\n节奏优先，3-6秒一镜为主；冲突点与反转点前置；镜头信息必须利于批量生成与复用。"
        }
        ScriptStyleProfile::Film => {
            "【风格策略：电影叙事】\n重视场面调度与镜头语言连续性；信息层次清晰；允许适度留白但字段必须结构化完整。"
        }
        ScriptStyleProfile::Anime => {
            "【风格策略：动漫分镜】\n强调角色设定稳定与关键视觉符号；动作可设计更夸张但须物理可描述；画风词保持一致。"
        }
        ScriptStyleProfile::Ad => {
            "【风格策略：广告短片】\n卖点驱动，镜头围绕产品/品牌记忆点；信息密度高且清晰；避免无效镜头。"
        }
        ScriptStyleProfile::Auto => "【风格策略：自动识别】\n根据文本语义选择最合适的创作风格。",
    }
}

fn ensure_role_desc(role_name: &str, role_desc: &str, shot_desc: &str) -> String {
    let raw = role_desc.trim();
    if !raw.is_empty() {
        let lines: Vec<&str> = raw
            .split(['\n', '；', ';'])
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();
        let mut hit: HashMap<&str, String> = HashMap::new();
        for l in lines {
            if let Some((k, v)) = l.split_once('：') {
                hit.insert(k.trim(), v.trim().to_string());
            } else if let Some((k, v)) = l.split_once(':') {
                hit.insert(k.trim(), v.trim().to_string());
            }
        }
        if !hit.is_empty() {
            return format!(
                "基础身份：{}\n面部特征：{}\n服饰装备：{}\n姿态与互动：{}\n环境与风格：{}",
                hit.get("基础身份").cloned().unwrap_or_default(),
                hit.get("面部特征").cloned().unwrap_or_default(),
                hit.get("服饰装备").cloned().unwrap_or_default(),
                hit.get("姿态与互动").cloned().unwrap_or_default(),
                hit.get("环境与风格").cloned().unwrap_or_default()
            );
        }
        return format!(
            "基础身份：{}\n面部特征：\n服饰装备：\n姿态与互动：\n环境与风格：",
            raw
        );
    }
    let role = if role_name.trim().is_empty() { "角色" } else { role_name.trim() };
    let shot_hint = shot_desc.trim();
    let env_hint = if shot_hint.is_empty() { "中性背景" } else { shot_hint };
    format!(
        "基础身份：一位 [年龄] 的人类女性，角色名为{}，[身高]，[身形比例]\n面部特征：[脸型]，[眉形]，[眼型]，[鼻型]，[嘴型]，[肤色质感]，[发型发色]\n服饰装备：身穿 [上装款式，材质质感]，下着 [下装款式，材质质感]，脚踩 [鞋履款式，材质质感]\n姿态与互动：[主体动作]，[与环境/道具互动]，脸上是 [表情与情绪]，手持 [道具或特殊效果，材质质感]\n环境与风格：处于 [{}]，[光影氛围]，整体呈现 [艺术风格/参考流派]",
        role, env_hint
    )
}

fn extract_json_array_text(raw: &str) -> Option<&str> {
    let start = raw.find('[')?;
    let end = raw.rfind(']')?;
    if end < start {
        return None;
    }
    Some(&raw[start..=end])
}

pub(crate) fn normalize_script_beats(parsed: Vec<ScriptBeatOut>) -> Vec<serde_json::Value> {
    let enums = script_enums_config();
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
            let act = if b.act_number <= 0 { 1 } else { b.act_number };
            let duration_secs = if b.duration <= 0.0 {
                3.0
            } else if b.duration > 8.0 {
                8.0
            } else {
                b.duration
            };
            let duration_hint = format!("{:.1}s", duration_secs);
            let time_in = timeline_cursor;
            let time_out = timeline_cursor + duration_secs;
            timeline_cursor = time_out;

            let merged_dialogue = b
                .roles
                .iter()
                .map(|r| r.lines.trim())
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>()
                .join(" / ");
            let merged_action = b
                .roles
                .iter()
                .map(|r| r.action.trim())
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>()
                .join("；");
            let merged_emotion = b
                .roles
                .iter()
                .map(|r| r.emotion.trim())
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>()
                .join("、");

            let shot_type = clamp_enum(&b.shot_type, &enums.shot_type, "中景");
            let camera_move = clamp_enum(&b.camera_move, &enums.camera_move, "固定");

            let mut characters: Vec<serde_json::Value> = Vec::new();
            for r in &b.roles {
                let emotion = clamp_enum(&r.emotion, &enums.emotion, "无");
                let name = r.role_name.trim();
                let desc = ensure_role_desc(name, r.role_desc.trim(), b.shot_desc.trim());
                let action = r.action.trim();
                let lines = r.lines.trim();
                if name.is_empty() && desc.is_empty() && action.is_empty() && lines.is_empty() {
                    continue;
                }
                characters.push(json!({
                    "id": uuid::Uuid::new_v4().to_string(),
                    "name": name,
                    "description": desc,
                    "imagePath": "",
                    "reference": "",
                    "action": action,
                    "emotion": emotion,
                    "lines": lines,
                }));
            }

            let role1 = b.roles.get(0).cloned().unwrap_or(ScriptRoleOut {
                role_name: String::new(),
                role_desc: String::new(),
                action: String::new(),
                emotion: String::new(),
                lines: String::new(),
            });
            let role2 = b.roles.get(1).cloned().unwrap_or(ScriptRoleOut {
                role_name: String::new(),
                role_desc: String::new(),
                action: String::new(),
                emotion: String::new(),
                lines: String::new(),
            });
            let role1_emotion = clamp_enum(&role1.emotion, &enums.emotion, "无");
            let _role2_emotion = clamp_enum(&role2.emotion, &enums.emotion, "无");
            let role1_desc = ensure_role_desc(role1.role_name.trim(), role1.role_desc.trim(), b.shot_desc.trim());
            let role2_desc = ensure_role_desc(role2.role_name.trim(), role2.role_desc.trim(), b.shot_desc.trim());
            let emotion_joined = if merged_emotion.is_empty() {
                role1_emotion.clone()
            } else {
                merged_emotion
                    .split('、')
                    .map(|s| clamp_enum(s, &enums.emotion, "无"))
                    .collect::<Vec<_>>()
                    .join("、")
            };

            let id = uuid::Uuid::new_v4().to_string();
            let shot_id = id.clone();
            json!({
                "id": id,
                "shotId": shot_id,
                "shotNumber": serial.to_string(),
                "scene": if b.scene.trim().is_empty() { format!("第{}幕", act) } else { b.scene.trim().to_string() },
                "durationHint": duration_hint,
                "timeIn": time_in,
                "timeOut": time_out,
                "description": b.shot_desc.trim(),
                "character1": role1.role_name.trim(),
                "character1Desc": role1_desc,
                "character1Image": "",
                "character2": role2.role_name.trim(),
                "character2Desc": role2_desc,
                "character2Image": "",
                "characters": characters,
                "reference": b.reference.trim(),
                "shotSize": shot_type,
                "characterAction": if merged_action.is_empty() { role1.action.trim() } else { merged_action.as_str() },
                "emotion": emotion_joined,
                "sceneTags": format!("运镜: {}", camera_move),
                "lightingMood": b.lighting_mood.trim(),
                "soundEffect": b.sound_effect.trim(),
                "dialogue": merged_dialogue,
                "storyboardPrompt": b.storyboard_prompt.trim(),
                "videoMotionPrompt": b.video_motion_prompt.trim(),
            })
        })
        .collect()
}

pub(crate) fn parse_script_beats_from_raw_llm(raw: &str) -> Result<Vec<ScriptBeatOut>, String> {
    let arr_text = extract_json_array_text(raw).ok_or_else(|| "脚本解析失败：未返回 JSON 数组".to_string())?;
    let parsed: Vec<ScriptBeatOut> =
        serde_json::from_str(arr_text).map_err(|e| format!("脚本解析失败：JSON 格式错误 {}", e))?;
    if parsed.is_empty() {
        return Err("脚本解析失败：分镜为空".into());
    }
    Ok(parsed)
}
