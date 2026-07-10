use crate::db;

use crate::graph::{CanvasGraph, FlowNode};

use crate::settings::AppSettings;

use rusqlite::Connection;

use serde_json::json;

use std::collections::{HashMap, HashSet};

use std::path::Path;

use tauri::Emitter;



use super::graph_flow::{

    incoming_reference_video_paths_ordered, incoming_texts_ordered_with_prompt_fallback,

};

use crate::media::{probe_media, MediaMeta};

use super::script_parse::{

    normalize_script_beats, parse_style_profile, scene_key_from_heading,

    build_script_rhythm_report, style_profile_name, ScriptBeatOut,

};

use super::script_parse_plan::{

    assemble_storyboard_draft, plan_json, resolve_script_parse_plan,

};

use super::script_parse_requirement::{

    apply_requirement_hints_to_shots, requirement_hints_json,

};

use super::script_decision::format_shot_storyboard_block;

use super::script_pipeline::{analyze_script_structure, design_shots, scope_script_to_episode};

use super::script_shot_agent::{generate_shot_visual, ShotVisualContext, ShotVisualOut};



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



fn next_draft_revision(node: &FlowNode) -> i64 {

    node.data

        .get("storyboardDraftRevision")

        .and_then(|v| v.as_i64())

        .unwrap_or(0)

        + 1

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

    app: Option<&tauri::AppHandle>,

) -> Result<(String, serde_json::Value), String> {

    let requirement_text = node

        .data

        .get("prompt")

        .and_then(|v| v.as_str())

        .unwrap_or("")

        .to_string();

    let upstream_parts = incoming_texts_ordered_with_prompt_fallback(graph, &node.id, outputs);

    let upstream_joined = upstream_parts.join("\n\n");

    let video_paths = incoming_reference_video_paths_ordered(project_root, graph, &node.id);

    let has_upstream_text = !upstream_joined.trim().is_empty();



    if requirement_text.trim().is_empty() && !has_upstream_text && video_paths.is_empty() {

        return Err(

            "请连接上游剧本文本，或在底栏填写解析要求，再触发解析".into(),

        );

    }



    let mut body_for_parse = if has_upstream_text {

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



    // ═══════════════════════════════════════════

    // 阶段 0：任务计划（规则 + LLM，静默）

    // ═══════════════════════════════════════════

    let parse_plan = resolve_script_parse_plan(

        http,

        settings,

        &params,

        &requirement_text,

        &body_for_parse,

        style_param,

        has_upstream_text,

    )

    .await;



    if let Some(episode) = parse_plan.hints.episode_only {

        body_for_parse = scope_script_to_episode(&body_for_parse, episode);

        if body_for_parse.trim().is_empty() {

            return Err(format!(

                "未找到第{}集内容：请确认上游剧本含有「第{}集」标题，或先去掉集数限制",

                episode, episode

            ));

        }

    }



    db::log_event(

        conn, run_id, Some(&node.id), "script_parse_request",

        &json!({

            "sourceLen": body_for_parse.len(),

            "styleProfile": style_profile_name(parse_plan.style),

            "hasUpstreamText": has_upstream_text,

            "requirementLen": parse_plan.hints.requirement_text.chars().count(),

            "parseHints": requirement_hints_json(&parse_plan.hints),

            "parsePlan": plan_json(&parse_plan),

            "videoRefCount": video_paths.len(),

            "referenceVideoPaths": video_paths,

            "providerId": provider_id,

            "model": model_override

        }),

    )?;



    if parse_plan.auto_planned {

        db::log_event(

            conn, run_id, Some(&node.id), "script_plan_auto",

            &plan_json(&parse_plan),

        )?;

    }



    // ═══════════════════════════════════════════

    // 阶段 1：剧本理解

    // ═══════════════════════════════════════════

    let mut structure = analyze_script_structure(&body_for_parse);



    // ═══════════════════════════════════════════

    // 阶段 1b：人物弧（编剧域，静默 fallback）

    // ═══════════════════════════════════════════

    let character_arc = if has_upstream_text && !parse_plan.hints.skip_character_arc {

        super::script_character_arc::analyze_character_arcs(

            http,

            settings,

            &params,

            &structure,

            &body_for_parse,

            &parse_plan.brief_summary,

            parse_plan.style,

        )

        .await

    } else {

        super::script_character_arc::CharacterArcAnalysis::default()

    };



    if character_arc.applied {

        db::log_event(

            conn, run_id, Some(&node.id), "script_character_arc",

            &super::script_character_arc::character_arc_notes_json(&character_arc),

        )?;

    }



    // ═══════════════════════════════════════════

    // 阶段 1c：对白改写（编剧域，静默 fallback）

    // ═══════════════════════════════════════════

    let dialogue_mode = super::script_dialogue_rewrite::resolve_dialogue_rewrite_mode(

        &parse_plan.hints.requirement_text,

        parse_plan.style,

        parse_plan.hints.skip_dialogue_rewrite,

    );

    let dialogue_rewrite = if has_upstream_text && dialogue_mode != super::script_dialogue_rewrite::DialogueRewriteMode::Preserve {

        super::script_dialogue_rewrite::rewrite_dialogues(

            http,

            settings,

            &params,

            &mut structure,

            &parse_plan.brief_summary,

            parse_plan.style,

            dialogue_mode,

            &character_arc,

        )

        .await

    } else {

        super::script_dialogue_rewrite::DialogueRewriteResult {

            mode: dialogue_mode,

            ..Default::default()

        }

    };



    if dialogue_rewrite.applied {

        db::log_event(

            conn, run_id, Some(&node.id), "script_dialogue_rewrite",

            &super::script_dialogue_rewrite::dialogue_rewrite_notes_json(&dialogue_rewrite),

        )?;

    }



    // ═══════════════════════════════════════════

    // 阶段 2：分镜头设计

    // ═══════════════════════════════════════════

    let mut shot_plans = design_shots(&structure, &body_for_parse, Some(&parse_plan));

    if shot_plans.is_empty() {

        return Err("剧本分析未生成任何镜头，请检查输入文本是否包含有效内容".into());

    }

    apply_requirement_hints_to_shots(&mut shot_plans, &parse_plan.hints);

    super::script_character_arc::apply_character_arc_to_shots(

        &mut shot_plans,

        &character_arc,

    );



    let visual_ctx = ShotVisualContext {

        requirement_text: parse_plan.hints.requirement_text.clone(),

        brief_summary: parse_plan.brief_summary.clone(),

        style: parse_plan.style,

        dialogue_rewrite_applied: dialogue_rewrite.applied,

    };



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



    let mut character_hints: HashMap<String, String> = structure.characters.iter()

        .filter_map(|(name, info)| {

            let hints = info.description_hints.join("；");

            if hints.is_empty() { None } else { Some((name.clone(), hints)) }

        })

        .collect();

    super::script_character_arc::enrich_character_hints(&mut character_hints, &character_arc);



    for (idx, plan) in shot_plans.iter().enumerate() {

        if let Some(app) = app {

            let _ = app.emit(

                "script-parse-progress",

                json!({

                    "nodeId": node.id,

                    "current": idx + 1,

                    "total": shot_plans.len(),

                }),

            );

        }

        db::log_event(

            conn, run_id, Some(&node.id), "script_shot_generate",

            &json!({

                "serial": plan.serial,

                "purpose": plan.narrative_purpose.as_str(),

                "charCount": plan.text_segment.chars().count(),

            }),

        )?;



        let visual: ShotVisualOut = match generate_shot_visual(

            http, settings, &params, plan, &character_hints, &visual_ctx,

        )

        .await

        {

            Ok(v) => v,

            Err(e) => {

                db::log_event(

                    conn, run_id, Some(&node.id), "script_shot_failed",

                    &json!({ "serial": plan.serial, "error": e }),

                )?;

                ShotVisualOut {

                    shot_desc: plan.text_segment.clone(),

                    dialogue: plan.dialogue_text.clone(),

                    seedance_positive: String::new(),

                    seedance_negative: String::new(),

                    lighting_mood: String::new(),

                }

            }

        };



        let mut chars = plan.characters_in_shot.clone();

        chars.sort();

        chars.dedup();



        let range_start = plan.para_range.0.min(plan.para_range.1);

        let range_end = plan.para_range.1.min(structure.paragraphs.len());

        let emotion = plan

            .tags_summary

            .split('；')

            .find_map(|s| s.strip_prefix("情绪:").map(|e| e.trim().to_string()))

            .or_else(|| {

                if range_start < range_end {

                    structure.paragraphs[range_start..range_end].iter().find_map(|p| {

                        let e = p.emotion.trim();

                        if e.is_empty() { None } else { Some(e.to_string()) }

                    })

                } else {

                    None

                }

            })

            .unwrap_or_default();



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
            format_shot_storyboard_block(plan, &visual_desc, &dialogue_final, &visual.lighting_mood);

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

            lighting_mood: visual.lighting_mood.clone(),

        });

    }



    db::log_event(

        conn, run_id, Some(&node.id), "script_parse_response",

        &json!({ "beatCount": beats_out.len() }),

    )?;



    let mut storyboard_draft = assemble_storyboard_draft(&beats_out);

    match super::script_draft_coherence::polish_storyboard_draft_coherence(
        http,
        settings,
        &params,
        &storyboard_draft,
        &parse_plan.brief_summary,
        parse_plan.style,
    )
    .await
    {
        Ok(polished) => {
            db::log_event(
                conn,
                run_id,
                Some(&node.id),
                "script_draft_coherence",
                &json!({
                    "applied": true,
                    "beforeLen": storyboard_draft.len(),
                    "afterLen": polished.len(),
                }),
            )?;
            storyboard_draft = polished;
        }
        Err(e) => {
            db::log_event(
                conn,
                run_id,
                Some(&node.id),
                "script_draft_coherence",
                &json!({
                    "applied": false,
                    "reason": e,
                }),
            )?;
        }
    }

    let draft_revision = next_draft_revision(node);

    let rhythm_report = build_script_rhythm_report(&beats_out);

    let beats = normalize_script_beats(beats_out);



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

        new_beat_ids.into_iter().collect()

    } else {

        existing_selection.into_iter().filter(|id| new_beat_ids.contains(id)).collect()

    };



    let patch = json!({

        "scriptBeats": beats,

        "scriptBeatSelection": selection,

        "storyboardDraft": storyboard_draft,

        "storyboardDraftRevision": draft_revision,

        "scriptParseAutoPlanned": parse_plan.auto_planned,

        "characterArcNotes": super::script_character_arc::character_arc_notes_json(&character_arc),

        "dialogueRewriteNotes": super::script_dialogue_rewrite::dialogue_rewrite_notes_json(&dialogue_rewrite),

        "scriptRhythmReport": rhythm_report,

        "scriptTotalDurationSec": rhythm_report.get("totalDurationSec"),

        "scriptShotCount": rhythm_report.get("shotCount"),

    });



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

