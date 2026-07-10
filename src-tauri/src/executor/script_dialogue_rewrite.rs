//! P2-③a：编剧域 · 对白改写（人物弧之后、分镜骨架之前，静默 fallback）

use crate::settings::AppSettings;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;

use super::llm::openai_chat_completion;
use super::script_character_arc::CharacterArcAnalysis;
use super::script_parse::ScriptStyleProfile;
use super::script_pipeline::{refresh_paragraph_metadata, Paragraph, ScriptStructure};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub(crate) enum DialogueRewriteMode {
    /// 不改写
    #[default]
    Preserve,
    /// 轻度润色：修正拗口、统一称谓，长度接近原文
    Light,
    /// 短剧化：更短、更口语、钩子更密
    ShortDrama,
}

impl DialogueRewriteMode {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Preserve => "preserve",
            Self::Light => "light",
            Self::ShortDrama => "short_drama",
        }
    }
}

#[derive(Debug, Clone, Default)]
pub(crate) struct DialogueRewriteResult {
    pub mode: DialogueRewriteMode,
    pub applied: bool,
    pub rewrite_count: usize,
    pub skipped_count: usize,
    /// para_index → 改写前原文（供日志/回溯）
    pub originals: HashMap<usize, String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DialogueRewriteItemRaw {
    #[serde(default)]
    para_index: usize,
    #[serde(default)]
    text: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DialogueRewriteRaw {
    #[serde(default)]
    rewrites: Vec<DialogueRewriteItemRaw>,
}

fn extract_json_object_text(raw: &str) -> Option<&str> {
    let start = raw.find('{')?;
    let end = raw.rfind('}')?;
    if end < start {
        return None;
    }
    Some(&raw[start..=end])
}

fn truncate_chars(s: &str, max: usize) -> String {
    let mut out = String::new();
    for (i, ch) in s.chars().enumerate() {
        if i >= max {
            out.push('…');
            break;
        }
        out.push(ch);
    }
    out
}

fn contains_any(text: &str, keywords: &[&str]) -> bool {
    keywords.iter().any(|k| text.contains(k))
}

/// 从 brief 解析对白改写模式；None 表示走体裁默认
pub(crate) fn parse_dialogue_rewrite_mode_override(requirement: &str) -> Option<DialogueRewriteMode> {
    let t = requirement.trim();
    if t.is_empty() {
        return None;
    }
    if contains_any(
        t,
        &[
            "保留原文",
            "保留台词",
            "不改台词",
            "原文台词",
            "不要改台词",
            "不要对白改写",
        ],
    ) {
        return Some(DialogueRewriteMode::Preserve);
    }
    if contains_any(
        t,
        &[
            "短剧化台词",
            "短剧化对白",
            "口语化台词",
            "对白短剧化",
            "台词短剧化",
        ],
    ) {
        return Some(DialogueRewriteMode::ShortDrama);
    }
    if contains_any(
        t,
        &[
            "轻度润色",
            "润色台词",
            "润色对白",
            "对白润色",
            "台词润色",
            "改写对白",
            "对白改写",
            "改台词",
        ],
    ) {
        return Some(DialogueRewriteMode::Light);
    }
    None
}

pub(crate) fn parse_skip_dialogue_rewrite(requirement: &str) -> bool {
    contains_any(
        requirement.trim(),
        &["跳过对白改写", "不要对白改写", "仅分镜"],
    )
}

pub(crate) fn resolve_dialogue_rewrite_mode(
    requirement: &str,
    style: ScriptStyleProfile,
    skip_flag: bool,
) -> DialogueRewriteMode {
    if skip_flag {
        return DialogueRewriteMode::Preserve;
    }
    if let Some(mode) = parse_dialogue_rewrite_mode_override(requirement) {
        return mode;
    }
    match style {
        ScriptStyleProfile::Ad => DialogueRewriteMode::ShortDrama,
        ScriptStyleProfile::ShortDrama | ScriptStyleProfile::Auto => DialogueRewriteMode::Light,
        ScriptStyleProfile::Film | ScriptStyleProfile::Anime => DialogueRewriteMode::Light,
    }
}

fn style_label(style: ScriptStyleProfile) -> &'static str {
    use super::script_parse_requirement::style_profile_label as label;
    label(style)
}

fn mode_instruction_text(mode: DialogueRewriteMode) -> &'static str {
    match mode {
        DialogueRewriteMode::Preserve => "",
        DialogueRewriteMode::Light => {
            "轻度润色：修正拗口与书面语，统一角色称谓；单句长度与原文接近（±20%）；不改变剧情信息与说话人。"
        }
        DialogueRewriteMode::ShortDrama => {
            "短剧化：台词更短、更口语、节奏更紧；删废话留钩子；适合竖屏口播；不改变谁在对谁说什么。"
        }
    }
}

fn build_dialogue_outline(paragraphs: &[Paragraph]) -> (String, Vec<usize>) {
    let mut indices: Vec<usize> = Vec::new();
    let lines: Vec<String> = paragraphs
        .iter()
        .enumerate()
        .filter(|(_, p)| p.is_dialogue_block && !p.text.trim().is_empty())
        .map(|(i, p)| {
            indices.push(i);
            format!(
                "[{i}] 说话:{} | {}",
                if p.speakers.is_empty() {
                    "—".to_string()
                } else {
                    p.speakers.join("/")
                },
                truncate_chars(p.text.trim(), 200)
            )
        })
        .collect();
    (lines.join("\n"), indices)
}

fn arc_context_line(arc: &CharacterArcAnalysis) -> String {
    if !arc.applied || arc.characters.is_empty() {
        return String::new();
    }
    arc.characters
        .iter()
        .take(6)
        .map(|c| {
            if c.arc_summary.is_empty() {
                c.name.clone()
            } else {
                format!("{}（{}）", c.name, c.arc_summary)
            }
        })
        .collect::<Vec<_>>()
        .join("；")
}

fn has_speaker_prefix(text: &str) -> bool {
    text.lines().any(|line| {
        let t = line.trim();
        t.contains('：') || t.contains(':')
    })
}

fn dialogue_body_chars(text: &str) -> usize {
    let mut count = 0usize;
    for line in text.lines() {
        let t = line.trim();
        let body = t
            .split_once('：')
            .map(|(_, r)| r.trim())
            .or_else(|| t.split_once(':').map(|(_, r)| r.trim()))
            .unwrap_or(t);
        count += body.chars().count();
    }
    count
}

pub(crate) fn validate_rewrite(original: &str, rewritten: &str, mode: DialogueRewriteMode) -> bool {
    let rewritten = rewritten.trim();
    if rewritten.is_empty() {
        return false;
    }
    if has_speaker_prefix(original) && !has_speaker_prefix(rewritten) {
        return false;
    }
    if mode == DialogueRewriteMode::ShortDrama {
        let orig = dialogue_body_chars(original).max(1);
        let new_len = dialogue_body_chars(rewritten);
        if new_len > orig + orig / 5 + 8 {
            return false;
        }
    }
    true
}

pub(crate) fn parse_dialogue_rewrite_json(
    raw: &str,
    valid_indices: &std::collections::HashSet<usize>,
) -> Result<Vec<(usize, String)>, String> {
    let obj_text = extract_json_object_text(raw)
        .ok_or_else(|| "对白改写 LLM 未返回 JSON".to_string())?;
    let parsed: DialogueRewriteRaw =
        serde_json::from_str(obj_text).map_err(|e| format!("对白改写 JSON 解析失败: {e}"))?;
    let mut out = Vec::new();
    for item in parsed.rewrites {
        if valid_indices.contains(&item.para_index) && !item.text.trim().is_empty() {
            out.push((item.para_index, item.text.trim().to_string()));
        }
    }
    Ok(out)
}

const REWRITE_SYSTEM: &str = r#"你是专业编剧，负责改写影视对白。输入为带索引的对白段落，输出 JSON（不要 markdown 代码块）。

【输出格式】camelCase：
{
  "rewrites": [
    { "paraIndex": 0, "text": "改写后的完整段落（保留「角色名：」行格式）" }
  ]
}

【必须遵守】
- 只改写输入中出现的 paraIndex；每个索引最多一条
- 保留说话人行（角色名+冒号）；OS/VO/电话/内心独白须标注清楚
- 不增删角色、不改变剧情事实与情绪走向
- text 为完整段落，可直接替换原文

【禁止】
- 输出景别、运镜、镜头建议
- 把对白改成纯叙述段
"#;

pub(crate) async fn rewrite_dialogues(
    http: &reqwest::Client,
    settings: &AppSettings,
    params: &Value,
    structure: &mut ScriptStructure,
    brief_summary: &str,
    style: ScriptStyleProfile,
    mode: DialogueRewriteMode,
    arc: &CharacterArcAnalysis,
) -> DialogueRewriteResult {
    if mode == DialogueRewriteMode::Preserve {
        return DialogueRewriteResult {
            mode,
            ..Default::default()
        };
    }

    let (outline, dialogue_indices) = build_dialogue_outline(&structure.paragraphs);
    if dialogue_indices.is_empty() {
        return DialogueRewriteResult {
            mode,
            ..Default::default()
        };
    }

    let valid_set: std::collections::HashSet<usize> = dialogue_indices.iter().copied().collect();
    let arc_line = arc_context_line(arc);
    let user = format!(
        "体裁：{}\n任务：{}\n改写模式：{}\n{}\n对白段落数：{}\n\n{}\n\n【待改写对白】\n{}",
        style_label(style),
        if brief_summary.trim().is_empty() {
            "对白改写"
        } else {
            brief_summary.trim()
        },
        mode.as_str(),
        mode_instruction_text(mode),
        dialogue_indices.len(),
        if arc_line.is_empty() {
            String::new()
        } else {
            format!("【人物弧参考】\n{arc_line}\n")
        },
        outline
    );
    let messages = json!([
        { "role": "system", "content": REWRITE_SYSTEM },
        { "role": "user", "content": user }
    ]);

    let mut result = DialogueRewriteResult {
        mode,
        ..Default::default()
    };

    let raw = match openai_chat_completion(http, settings, messages, params).await {
        Ok(r) => r,
        Err(_) => return result,
    };

    let rewrites = match parse_dialogue_rewrite_json(&raw, &valid_set) {
        Ok(r) => r,
        Err(_) => return result,
    };

    let mut applied_map: HashMap<usize, String> = HashMap::new();
    for (idx, text) in rewrites {
        if idx >= structure.paragraphs.len() {
            result.skipped_count += 1;
            continue;
        }
        let original = structure.paragraphs[idx].text.clone();
        if !validate_rewrite(&original, &text, mode) {
            result.skipped_count += 1;
            continue;
        }
        result.originals.insert(idx, original);
        applied_map.insert(idx, text);
        result.rewrite_count += 1;
    }

    apply_dialogue_rewrites_to_structure(structure, &applied_map);
    result.applied = result.rewrite_count > 0;
    result
}

/// 将对白改写结果写回结构（须在 rewrite_dialogues 收集 originals 后调用）
pub(crate) fn apply_dialogue_rewrites_to_structure(
    structure: &mut ScriptStructure,
    rewrites: &HashMap<usize, String>,
) {
    for (idx, text) in rewrites {
        if *idx >= structure.paragraphs.len() {
            continue;
        }
        structure.paragraphs[*idx].text = text.clone();
        refresh_paragraph_metadata(&mut structure.paragraphs[*idx]);
    }
}

pub(crate) fn dialogue_rewrite_notes_json(result: &DialogueRewriteResult) -> Value {
    json!({
        "applied": result.applied,
        "mode": result.mode.as_str(),
        "rewriteCount": result.rewrite_count,
        "skippedCount": result.skipped_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::script_pipeline::Paragraph;

    const SAMPLE_JSON: &str = r#"{
      "rewrites": [
        { "paraIndex": 2, "text": "陈南：师父，我准备好了。" },
        { "paraIndex": 5, "text": "师父：今日起，你自行下山。" }
      ]
    }"#;

    #[test]
    fn parses_mode_from_brief() {
        assert_eq!(
            parse_dialogue_rewrite_mode_override("保留原文台词"),
            Some(DialogueRewriteMode::Preserve)
        );
        assert_eq!(
            parse_dialogue_rewrite_mode_override("短剧化台词"),
            Some(DialogueRewriteMode::ShortDrama)
        );
        assert_eq!(
            parse_dialogue_rewrite_mode_override("对白润色"),
            Some(DialogueRewriteMode::Light)
        );
    }

    #[test]
    fn resolves_default_by_style() {
        assert_eq!(
            resolve_dialogue_rewrite_mode("", ScriptStyleProfile::Ad, false),
            DialogueRewriteMode::ShortDrama
        );
        assert_eq!(
            resolve_dialogue_rewrite_mode("", ScriptStyleProfile::Film, false),
            DialogueRewriteMode::Light
        );
        assert!(parse_skip_dialogue_rewrite("仅分镜"));
    }

    #[test]
    fn parses_rewrite_json() {
        let valid: std::collections::HashSet<usize> = [2usize, 5].into_iter().collect();
        let items = parse_dialogue_rewrite_json(SAMPLE_JSON, &valid).unwrap();
        assert_eq!(items.len(), 2);
        assert!(items[0].1.contains('：'));
    }

    #[test]
    fn validates_speaker_prefix() {
        let orig = "陈南：你好。";
        assert!(validate_rewrite(
            orig,
            "陈南：你好啊。",
            DialogueRewriteMode::Light
        ));
        assert!(!validate_rewrite(
            orig,
            "你好啊。",
            DialogueRewriteMode::Light
        ));
    }

    #[test]
    fn apply_updates_paragraph() {
        let mut structure = ScriptStructure {
            characters: HashMap::new(),
            paragraphs: vec![Paragraph {
                text: "陈南：旧台词".into(),
                is_dialogue_block: true,
                speakers: vec!["陈南".into()],
                emotion: String::new(),
                has_key_action: false,
                scene_index: 1,
                scene_heading: String::new(),
                is_scene_header: false,
            }],
            estimated_total_duration_sec: 0.0,
        };
        let mut map = HashMap::new();
        map.insert(0usize, "陈南：新台词".into());
        apply_dialogue_rewrites_to_structure(&mut structure, &map);
        assert_eq!(structure.paragraphs[0].text, "陈南：新台词");
    }
}
