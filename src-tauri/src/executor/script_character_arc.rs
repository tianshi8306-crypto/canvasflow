//! P2-③b：编剧域 · 人物弧分析（阶段 1 之后、分镜骨架之前，静默 fallback）

use crate::settings::AppSettings;
use serde::Deserialize;
use serde_json::{json, Value};

use super::llm::openai_chat_completion;
use super::script_parse::ScriptStyleProfile;
use super::script_pipeline::{NarrativePurpose, Paragraph, ScriptStructure, ShotPlan};

const ARC_SYSTEM_PROMPT: &str = r#"你是专业编剧顾问。根据剧本段落提纲，分析主要角色的弧光与关键转折，输出 JSON（不要 markdown 代码块）。

【输出格式】camelCase 纯 JSON：
{
  "characters": [
    {
      "name": "角色名（与提纲一致）",
      "arcSummary": "一句话弧光（如：隐忍→爆发）",
      "startState": "开场心理状态/立场",
      "endState": "本段结尾心理状态/立场",
      "relationshipNotes": "与其他主要角色的关系变化（可空）"
    }
  ],
  "paragraphBeats": [
    {
      "paraIndex": 0,
      "characters": ["角色名"],
      "arcBeat": "setup|rising|turning|falling|resolution|hook",
      "emotionState": "情绪词（如：压抑、愤怒、释然）",
      "performanceHint": "表演提示（微表情/肢体，20字内）",
      "isTurningPoint": false
    }
  ],
  "episodeHookNote": "集级钩子或悬念（无则空字符串）"
}

【要求】
- 只分析提纲中出现的角色；paragraphBeats.paraIndex 必须对应提纲 [索引]
- isTurningPoint=true 仅用于弧光明显翻转的段落（全篇不宜过多）
- performanceHint 须可拍摄，避免抽象心理独白
- 不要输出镜头/景别/运镜建议
"#;

#[derive(Debug, Clone, Default)]
pub(crate) struct CharacterArcProfile {
    pub name: String,
    pub arc_summary: String,
    pub start_state: String,
    pub end_state: String,
    pub relationship_notes: String,
}

#[derive(Debug, Clone)]
pub(crate) struct ParagraphArcAnnotation {
    pub para_index: usize,
    pub characters: Vec<String>,
    pub arc_beat: String,
    pub emotion_state: String,
    pub performance_hint: String,
    pub is_turning_point: bool,
}

#[derive(Debug, Clone, Default)]
pub(crate) struct CharacterArcAnalysis {
    pub characters: Vec<CharacterArcProfile>,
    pub paragraph_annotations: Vec<ParagraphArcAnnotation>,
    pub episode_hook_note: String,
    pub applied: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArcCharacterRaw {
    #[serde(default)]
    name: String,
    #[serde(default)]
    arc_summary: String,
    #[serde(default)]
    start_state: String,
    #[serde(default)]
    end_state: String,
    #[serde(default)]
    relationship_notes: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ParagraphBeatRaw {
    #[serde(default)]
    para_index: usize,
    #[serde(default)]
    characters: Vec<String>,
    #[serde(default)]
    arc_beat: String,
    #[serde(default)]
    emotion_state: String,
    #[serde(default)]
    performance_hint: String,
    #[serde(default)]
    is_turning_point: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CharacterArcRaw {
    #[serde(default)]
    characters: Vec<ArcCharacterRaw>,
    #[serde(default)]
    paragraph_beats: Vec<ParagraphBeatRaw>,
    #[serde(default)]
    episode_hook_note: String,
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

fn extract_json_object_text(raw: &str) -> Option<&str> {
    let start = raw.find('{')?;
    let end = raw.rfind('}')?;
    if end < start {
        return None;
    }
    Some(&raw[start..=end])
}

fn truncate_script_sample(body: &str, max_chars: usize) -> String {
    let t = body.trim();
    if t.chars().count() <= max_chars {
        return t.to_string();
    }
    truncate_chars(t, max_chars)
}

fn build_paragraph_outline(paragraphs: &[Paragraph]) -> String {
    paragraphs
        .iter()
        .enumerate()
        .map(|(i, p)| {
            let speakers = if p.speakers.is_empty() {
                "—".to_string()
            } else {
                p.speakers.join("/")
            };
            let kind = if p.is_scene_header {
                "场头"
            } else if p.is_dialogue_block {
                "对白"
            } else {
                "叙述"
            };
            format!(
                "[{i}] {kind} 场:{} 说话:{}{} | {}",
                if p.scene_heading.is_empty() {
                    "—".to_string()
                } else {
                    p.scene_heading.clone()
                },
                speakers,
                if p.emotion.is_empty() {
                    String::new()
                } else {
                    format!(" 情绪:{}", p.emotion)
                },
                truncate_chars(p.text.trim(), 100)
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn raw_to_analysis(raw: CharacterArcRaw, para_count: usize) -> CharacterArcAnalysis {
    let characters: Vec<CharacterArcProfile> = raw
        .characters
        .into_iter()
        .filter(|c| !c.name.trim().is_empty())
        .map(|c| CharacterArcProfile {
            name: c.name.trim().to_string(),
            arc_summary: c.arc_summary.trim().to_string(),
            start_state: c.start_state.trim().to_string(),
            end_state: c.end_state.trim().to_string(),
            relationship_notes: c.relationship_notes.trim().to_string(),
        })
        .collect();

    let paragraph_annotations: Vec<ParagraphArcAnnotation> = raw
        .paragraph_beats
        .into_iter()
        .filter(|b| b.para_index < para_count)
        .map(|b| ParagraphArcAnnotation {
            para_index: b.para_index,
            characters: b
                .characters
                .into_iter()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect(),
            arc_beat: b.arc_beat.trim().to_string(),
            emotion_state: b.emotion_state.trim().to_string(),
            performance_hint: b.performance_hint.trim().to_string(),
            is_turning_point: b.is_turning_point,
        })
        .collect();

    let applied = !characters.is_empty() || !paragraph_annotations.is_empty();
    CharacterArcAnalysis {
        characters,
        paragraph_annotations,
        episode_hook_note: raw.episode_hook_note.trim().to_string(),
        applied,
    }
}

pub(crate) fn parse_character_arc_json(raw: &str, para_count: usize) -> Result<CharacterArcAnalysis, String> {
    let obj_text = extract_json_object_text(raw)
        .ok_or_else(|| "人物弧 LLM 未返回 JSON".to_string())?;
    let parsed: CharacterArcRaw =
        serde_json::from_str(obj_text).map_err(|e| format!("人物弧 JSON 解析失败: {e}"))?;
    Ok(raw_to_analysis(parsed, para_count))
}

fn style_label(style: ScriptStyleProfile) -> &'static str {
    use super::script_parse_requirement::style_profile_label as label;
    label(style)
}

pub(crate) async fn analyze_character_arcs(
    http: &reqwest::Client,
    settings: &AppSettings,
    params: &Value,
    structure: &ScriptStructure,
    script_body: &str,
    brief_summary: &str,
    style: ScriptStyleProfile,
) -> CharacterArcAnalysis {
    if structure.paragraphs.is_empty() {
        return CharacterArcAnalysis::default();
    }

    let char_names: Vec<String> = structure.characters.keys().cloned().collect();
    let outline = build_paragraph_outline(&structure.paragraphs);
    let sample = truncate_script_sample(script_body, 6000);
    let user = format!(
        "体裁：{}\n任务：{}\n已知角色：{}\n段落数：{}\n\n【段落提纲】\n{}\n\n【剧本节选】\n{}",
        style_label(style),
        if brief_summary.trim().is_empty() {
            "分析人物弧与关键转折"
        } else {
            brief_summary.trim()
        },
        if char_names.is_empty() {
            "（未识别到对白角色，请从正文推断主要人物）".to_string()
        } else {
            char_names.join("、")
        },
        structure.paragraphs.len(),
        outline,
        sample
    );
    let messages = json!([
        { "role": "system", "content": ARC_SYSTEM_PROMPT },
        { "role": "user", "content": user }
    ]);

    match openai_chat_completion(http, settings, messages, params).await {
        Ok(raw) => match parse_character_arc_json(&raw, structure.paragraphs.len()) {
            Ok(analysis) => analysis,
            Err(_) => CharacterArcAnalysis::default(),
        },
        Err(_) => CharacterArcAnalysis::default(),
    }
}

fn annotations_for_shot<'a>(
    plan: &ShotPlan,
    annotations: &'a [ParagraphArcAnnotation],
) -> Vec<&'a ParagraphArcAnnotation> {
    let (start, end) = plan.para_range;
    annotations
        .iter()
        .filter(|a| a.para_index >= start && a.para_index < end)
        .collect()
}

fn merge_performance_note(existing: &str, hint: &str) -> String {
    let hint = hint.trim();
    if hint.is_empty() {
        return existing.trim().to_string();
    }
    let existing = existing.trim();
    if existing.is_empty() {
        return hint.to_string();
    }
    if existing.contains(hint) {
        return existing.to_string();
    }
    format!("{existing}；{hint}")
}

fn arc_beat_label(beat: &str) -> &str {
    match beat.trim().to_lowercase().as_str() {
        "setup" => "弧光·铺垫",
        "rising" => "弧光·上升",
        "turning" => "弧光·转折",
        "falling" => "弧光·回落",
        "resolution" => "弧光·收束",
        "hook" => "弧光·钩子",
        _ if !beat.trim().is_empty() => "弧光",
        _ => "",
    }
}

/// 将人物弧标注写入镜头规划（在 design_shots 之后、逐镜 LLM 之前）
pub(crate) fn apply_character_arc_to_shots(
    shots: &mut [ShotPlan],
    arc: &CharacterArcAnalysis,
) {
    if !arc.applied {
        return;
    }

    for shot in shots.iter_mut() {
        let matched = annotations_for_shot(shot, &arc.paragraph_annotations);
        if matched.is_empty() {
            continue;
        }

        let mut hints: Vec<String> = Vec::new();
        let mut has_turning = false;

        for ann in &matched {
            if ann.is_turning_point {
                has_turning = true;
            }
            if !ann.performance_hint.is_empty() {
                shot.performance_note =
                    merge_performance_note(&shot.performance_note, &ann.performance_hint);
            }
            let label = arc_beat_label(&ann.arc_beat);
            if !label.is_empty() && shot.rhythm_function.is_empty() {
                shot.rhythm_function = label.to_string();
            } else if ann.is_turning_point && !shot.rhythm_function.contains("转折") {
                shot.rhythm_function = if shot.rhythm_function.is_empty() {
                    "弧光·转折".to_string()
                } else {
                    format!("{}·转折", shot.rhythm_function)
                };
            }

            for name in &ann.characters {
                if let Some(profile) = arc.characters.iter().find(|c| c.name == *name) {
                    if !profile.arc_summary.is_empty() {
                        hints.push(format!("{name}：{}", profile.arc_summary));
                    }
                }
                if !ann.emotion_state.is_empty() {
                    hints.push(format!("{name}·{}", ann.emotion_state));
                }
            }
        }

        if has_turning && shot.narrative_purpose == NarrativePurpose::Advancing {
            shot.narrative_purpose = NarrativePurpose::Turning;
        }

        if let Some(ann) = matched.iter().find(|a| !a.emotion_state.is_empty()) {
            if shot.tags_summary.is_empty() || !shot.tags_summary.contains(&ann.emotion_state) {
                // emotion stored on beat via paragraphs; enrich tags for LLM
                if !shot.tags_summary.is_empty() {
                    shot.tags_summary =
                        format!("{}；情绪:{}", shot.tags_summary, ann.emotion_state);
                } else {
                    shot.tags_summary = format!("情绪:{}", ann.emotion_state);
                }
            }
        }

        if has_turning {
            shot.edit_focus = merge_performance_note(
                &shot.edit_focus,
                "弧光转折：加强微表情/反应",
            );
        }

        hints.sort();
        hints.dedup();
        shot.character_arc_hint = hints.join("；");
    }
}

pub(crate) fn enrich_character_hints(
    base: &mut std::collections::HashMap<String, String>,
    arc: &CharacterArcAnalysis,
) {
    for profile in &arc.characters {
        if profile.arc_summary.is_empty() {
            continue;
        }
        let entry = base.entry(profile.name.clone()).or_default();
        let arc_line = format!("弧光：{}", profile.arc_summary);
        if entry.is_empty() {
            *entry = arc_line;
        } else if !entry.contains(&profile.arc_summary) {
            *entry = format!("{entry}；{arc_line}");
        }
    }
}

pub(crate) fn character_arc_notes_json(arc: &CharacterArcAnalysis) -> Value {
    json!({
        "applied": arc.applied,
        "episodeHookNote": arc.episode_hook_note,
        "characters": arc.characters.iter().map(|c| json!({
            "name": c.name,
            "arcSummary": c.arc_summary,
            "startState": c.start_state,
            "endState": c.end_state,
            "relationshipNotes": c.relationship_notes,
        })).collect::<Vec<_>>(),
        "turningPointCount": arc.paragraph_annotations.iter().filter(|a| a.is_turning_point).count(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_JSON: &str = r#"{
      "characters": [
        {
          "name": "陈南",
          "arcSummary": "隐忍→爆发",
          "startState": "克制",
          "endState": "对抗",
          "relationshipNotes": "与师父对立"
        }
      ],
      "paragraphBeats": [
        {
          "paraIndex": 1,
          "characters": ["陈南"],
          "arcBeat": "rising",
          "emotionState": "压抑",
          "performanceHint": "指节发白",
          "isTurningPoint": false
        },
        {
          "paraIndex": 3,
          "characters": ["陈南"],
          "arcBeat": "turning",
          "emotionState": "愤怒",
          "performanceHint": "抬眼直视",
          "isTurningPoint": true
        }
      ],
      "episodeHookNote": "师徒决裂未了"
    }"#;

    #[test]
    fn parses_arc_json() {
        let arc = parse_character_arc_json(SAMPLE_JSON, 5).unwrap();
        assert!(arc.applied);
        assert_eq!(arc.characters.len(), 1);
        assert_eq!(arc.paragraph_annotations.len(), 2);
        assert_eq!(arc.episode_hook_note, "师徒决裂未了");
    }

    #[test]
    fn apply_marks_turning_shot() {
        let arc = parse_character_arc_json(SAMPLE_JSON, 5).unwrap();
        let mut shots = vec![ShotPlan {
            serial: 1,
            para_range: (3, 4),
            narrative_purpose: NarrativePurpose::Advancing,
            characters_in_shot: vec!["陈南".into()],
            performance_note: String::new(),
            ..Default::default()
        }];
        apply_character_arc_to_shots(&mut shots, &arc);
        assert_eq!(shots[0].narrative_purpose, NarrativePurpose::Turning);
        assert!(shots[0].performance_note.contains("抬眼直视"));
        assert!(shots[0].character_arc_hint.contains("隐忍"));
    }

    #[test]
    fn enrich_character_hints_merges_arc() {
        let arc = parse_character_arc_json(SAMPLE_JSON, 5).unwrap();
        let mut hints = std::collections::HashMap::new();
        hints.insert("陈南".into(), "少年剑客".into());
        enrich_character_hints(&mut hints, &arc);
        assert!(hints["陈南"].contains("弧光"));
        assert!(hints["陈南"].contains("少年剑客"));
    }
}
