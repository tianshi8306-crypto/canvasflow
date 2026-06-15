use crate::db;
use crate::graph::{CanvasGraph, FlowNode};
use crate::settings::AppSettings;
use rusqlite::Connection;
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::path::Path;

use super::graph_flow::{
    incoming_reference_video_paths_ordered, incoming_texts_ordered_with_prompt_fallback,
};
use crate::media::{probe_media, MediaMeta};
use super::script_parse::{
    detect_style_from_text, normalize_script_beats, parse_style_profile, scene_key_from_heading,
    build_script_rhythm_report, style_profile_name, ScriptBeatOut, ScriptStyleProfile,
};
use super::script_decision::format_shot_storyboard_block;
use super::script_pipeline::{analyze_script_structure, design_shots};
use super::script_shot_agent::{generate_shot_visual, ShotVisualOut};

fn media_meta_suffix(meta: &MediaMeta) -> String {
    let mut parts: Vec<String> = Vec::new();
    if let (Some(w), Some(h)) = (meta.width, meta.height) {
        parts.push(format!("{}×{}", w, h));
    }
    if let Some(d) = meta.duration_sec {
        parts.push(format!("{:.1}s", d));
    }
    if parts.is_empty() {
        String::new()
    } else {
        format!(" [{}]", parts.join(", "))
    }
}

fn format_reference_video_path_lines(project_root: &Path, paths: &[String]) -> Vec<String> {
    paths
        .iter()
        .enumerate()
        .map(|(i, rel)| {
            let abs = project_root.join(rel);
            let suffix = probe_media(&abs)
                .ok()
                .map(|m| media_meta_suffix(&m))
                .unwrap_or_default();
            format!("{}. {}{}", i + 1, rel, suffix)
        })
        .collect()
}

pub(crate) async fn run_script_node(
    http: &reqwest::Client,
    project_root: &Path,
    graph: &CanvasGraph,
    node: &FlowNode,
    settings: &AppSettings,
    outputs: &HashMap<String, String>,
    conn: &mut Connection,
    run_id: &str,
) -> Result<(String, serde_json::Value), String> {
    let requirement_text = node
        .data
        .get("prompt")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if requirement_text.trim().is_empty() {
        return Err("请先在脚本节点输入框填写解析要求（或粘贴剧本文本），再触发解析".into());
    }
    let upstream_parts = incoming_texts_ordered_with_prompt_fallback(graph, &node.id, outputs);
    let upstream_joined = upstream_parts.join("\n\n");
    let video_paths = incoming_reference_video_paths_ordered(project_root, graph, &node.id);
    let has_upstream_text = !upstream_joined.trim().is_empty();

    let body_for_parse = if has_upstream_text {
        upstream_joined.clone()
    } else if !video_paths.is_empty() {
        let path_lines = format_reference_video_path_lines(project_root, &video_paths).join("\n");
        format!(
            "（当前未连接上游文本节点：请结合下方【解析要求】与参考视频路径，按工业分镜规范输出结构化结果；若仅凭路径无法还原画面，请在 storyboardPrompt 中合理推断并注明依据为「参考视频元信息（ffprobe）」。）\n\n【参考视频路径】\n{}",
            path_lines
        )
    } else {
        requirement_text.clone()
    };
    let params = node.data.get("params").cloned().unwrap_or(json!({}));
    let style_param = parse_style_profile(&params);
    let style = if style_param == ScriptStyleProfile::Auto {
        detect_style_from_text(&requirement_text, &body_for_parse)
    } else {
        style_param
    };
    let provider_id = params
        .get("providerId")
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());
    let model_override = params
        .get("model")
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());

    db::log_event(
        conn, run_id, Some(&node.id), "script_parse_request",
        &json!({
            "sourceLen": body_for_parse.len(),
            "styleProfile": style_profile_name(style),
            "hasUpstreamText": has_upstream_text,
            "videoRefCount": video_paths.len(),
            "referenceVideoPaths": video_paths,
            "providerId": provider_id,
            "model": model_override
        }),
    )?;

    // ═══════════════════════════════════════════
    // 阶段 1+2：规则引擎（剧本理解 + 分镜头设计）
    // ═══════════════════════════════════════════
    let structure = analyze_script_structure(&body_for_parse);
    let shot_plans = design_shots(&structure, &body_for_parse);
    if shot_plans.is_empty() {
        return Err("剧本分析未生成任何镜头，请检查输入文本是否包含有效内容".into());
    }

    db::log_event(
        conn, run_id, Some(&node.id), "script_pipeline_stage12",
        &json!({
            "characterCount": structure.characters.len(),
            "paragraphCount": structure.paragraphs.len(),
            "shotCount": shot_plans.len(),
            "estimatedDurationSec": structure.estimated_total_duration_sec,
        }),
    )?;

    // ═══════════════════════════════════════════
    // 阶段 3：逐镜 LLM 生成
    // ═══════════════════════════════════════════
    let mut beats_out: Vec<ScriptBeatOut> = Vec::with_capacity(shot_plans.len());
    let mut scene_shot_counters: HashMap<usize, usize> = HashMap::new();

    // Fix 4: 构建角色描述线索映射
    let character_hints: HashMap<String, String> = structure.characters.iter()
        .filter_map(|(name, info)| {
            let hints = info.description_hints.join("；");
            if hints.is_empty() { None } else { Some((name.clone(), hints)) }
        })
        .collect();

    for plan in &shot_plans {
        db::log_event(
            conn, run_id, Some(&node.id), "script_shot_generate",
            &json!({
                "serial": plan.serial,
                "purpose": plan.narrative_purpose.as_str(),
                "charCount": plan.text_segment.chars().count(),
            }),
        )?;

        let visual: ShotVisualOut = match generate_shot_visual(
            http, settings, &params, plan, &character_hints,
        )
        .await
        {
            Ok(v) => v,
            Err(e) => {
                db::log_event(
                    conn, run_id, Some(&node.id), "script_shot_failed",
                    &json!({ "serial": plan.serial, "error": e }),
                )?;
                // 单镜失败：用原文作为 fallback，不中断整个 pipeline
                ShotVisualOut {
                    shot_desc: plan.text_segment.clone(),
                    dialogue: plan.dialogue_text.clone(),
                    seedance_positive: String::new(),
                    seedance_negative: String::new(),
                }
            }
        };

        // 提取角色名列表（去重）
        let mut chars = plan.characters_in_shot.clone();
        chars.sort();
        chars.dedup();

        // Fix 7: 通过 para_range 直接索引 paragraphs，避免子串误匹配
        let range_start = plan.para_range.0.min(plan.para_range.1);
        let range_end = plan.para_range.1.min(structure.paragraphs.len());
        let emotion = if range_start < range_end {
            structure.paragraphs[range_start..range_end].iter()
                .find_map(|p| {
                    let e = p.emotion.trim();
                    if e.is_empty() { None } else { Some(e.to_string()) }
                })
                .unwrap_or_default()
        } else {
            String::new()
        };

        let dialogue_final = if visual.dialogue.trim().is_empty() {
            plan.dialogue_text.clone()
        } else {
            visual.dialogue.clone()
        };
        let visual_desc = if visual.shot_desc.trim().is_empty() {
            plan.text_segment.clone()
        } else {
            visual.shot_desc.clone()
        };
        let storyboard_block =
            format_shot_storyboard_block(plan, &visual_desc, &dialogue_final);
        let scene_key = scene_key_from_heading(&plan.scene_heading);
        let scene_counter = scene_shot_counters.entry(plan.scene_index).or_insert(0);
        *scene_counter += 1;
        let episode_scene_shot = format!("{}-{:02}", scene_key, *scene_counter);
        let rhythm_tag = if plan.rhythm_function.trim().is_empty() {
            plan.narrative_purpose.as_str().to_string()
        } else {
            plan.rhythm_function.clone()
        };

        beats_out.push(ScriptBeatOut {
            serial_number: plan.serial,
            duration: plan.estimated_duration_sec,
            shot_desc: visual_desc,
            storyboard_block,
            dialogue: dialogue_final,
            seedance_positive: visual.seedance_positive,
            seedance_negative: visual.seedance_negative,
            characters_in_shot: chars,
            emotion,
            narrative_purpose: plan.narrative_purpose.as_str().to_string(),
            scene_heading: plan.scene_heading.clone(),
            episode_scene_shot,
            shot_size: plan.shot_size.clone(),
            camera_move: plan.camera_move.clone(),
            camera_angle: plan.camera_angle.clone(),
            sound_hint: plan.sound_hint.clone(),
            edit_focus: plan.edit_focus.clone(),
            rhythm_tag,
            is_reaction_shot: plan.is_reaction_shot,
            dialogue_type: plan.dialogue_type.clone(),
            performance_note: plan.performance_note.clone(),
            bgm_hint: plan.bgm_hint.clone(),
        });
    }

    db::log_event(
        conn, run_id, Some(&node.id), "script_parse_response",
        &json!({ "beatCount": beats_out.len() }),
    )?;

    let rhythm_report = build_script_rhythm_report(&beats_out);
    let beats = normalize_script_beats(beats_out);

    // Fix 12: 保留已有的有效勾选
    let existing_selection: Vec<String> = node
        .data
        .get("scriptBeatSelection")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())
        .unwrap_or_default();
    let new_beat_ids: HashSet<String> = beats
        .iter()
        .filter_map(|v| v.get("id").and_then(|x| x.as_str()).map(|s| s.to_string()))
        .collect();
    let selection: Vec<String> = if existing_selection.is_empty() {
        // 之前无勾选：全选新 beats
        new_beat_ids.into_iter().collect()
    } else {
        // 保留之前勾选中的有效 id
        existing_selection.into_iter().filter(|id| new_beat_ids.contains(id)).collect()
    };

    let patch = json!({
        "scriptBeats": beats,
        "scriptBeatSelection": selection,
        "scriptRhythmReport": rhythm_report,
        "scriptTotalDurationSec": rhythm_report.get("totalDurationSec"),
        "scriptShotCount": rhythm_report.get("shotCount"),
    });

    // Fix 10: 将结构化结果摘要作为 node_output，供下游节点使用
    let shot_summary: String = beats.iter().enumerate().map(|(i, v)| {
        let default_sn = (i + 1).to_string();
        let sn = v.get("shotNumber").and_then(|x| x.as_str()).unwrap_or(&default_sn);
        let desc = v.get("description").and_then(|x| x.as_str()).unwrap_or("").trim();
        format!("镜头 {}: {}", sn, desc)
    }).collect::<Vec<_>>().join("\n");
    let output_summary = format!(
        "[脚本解析结果 - 共 {} 镜头]\n{}",
        beats.len(),
        shot_summary,
    );
    Ok((output_summary, patch))
}
