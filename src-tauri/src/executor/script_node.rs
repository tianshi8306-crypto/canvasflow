use crate::db;
use crate::graph::{CanvasGraph, FlowNode};
use crate::settings::AppSettings;
use rusqlite::Connection;
use serde_json::json;
use std::collections::HashMap;

use super::graph_flow::{
    incoming_reference_video_paths_ordered, incoming_texts_ordered_with_prompt_fallback,
};
use super::llm::openai_chat_completion;
use super::script_parse::{
    detect_style_from_text, normalize_script_beats, parse_script_beats_from_raw_llm, parse_style_profile,
    script_enums_config, style_profile_directive, style_profile_name, ScriptBeatOut, ScriptStyleProfile,
};

pub(crate) async fn run_script_node(
    http: &reqwest::Client,
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
    let video_paths = incoming_reference_video_paths_ordered(graph, &node.id);
    let has_upstream_text = !upstream_joined.trim().is_empty();

    let body_for_parse = if has_upstream_text {
        upstream_joined.clone()
    } else if !video_paths.is_empty() {
        let path_lines = video_paths
            .iter()
            .enumerate()
            .map(|(i, p)| format!("{}. {}", i + 1, p))
            .collect::<Vec<_>>()
            .join("\n");
        format!(
            "（当前未连接上游文本节点：请结合下方【解析要求】与参考视频路径，按工业分镜规范输出结构化结果；若仅凭路径无法还原画面，请在 storyboardPrompt 中合理推断并注明依据为「参考视频元信息」。）\n\n【参考视频路径】\n{}",
            path_lines
        )
    } else {
        requirement_text.clone()
    };

    let video_supplement_for_upstream = |paths: &[String]| -> String {
        if paths.is_empty() {
            return String::new();
        }
        let lines = paths
            .iter()
            .enumerate()
            .map(|(i, p)| format!("{}. {}", i + 1, p))
            .collect::<Vec<_>>()
            .join("\n");
        format!("\n\n【参考视频】\n{}", lines)
    };

    let user = if has_upstream_text {
        format!(
            "【解析要求】\n{}\n\n【待解析剧本文本】\n{}{}\n\n只输出 JSON 数组，字段必须严格匹配。",
            requirement_text,
            body_for_parse,
            video_supplement_for_upstream(&video_paths)
        )
    } else if !video_paths.is_empty() {
        format!(
            "【解析要求】\n{}\n\n【待解析素材】\n{}\n\n只输出 JSON 数组，字段必须严格匹配。",
            requirement_text, body_for_parse
        )
    } else {
        format!(
            "【剧本文本与创作要求（合写为一段）】\n{}\n\n只输出 JSON 数组，字段必须严格匹配。",
            requirement_text
        )
    };

    let source_text_for_output = if has_upstream_text {
        upstream_joined
    } else if !video_paths.is_empty() {
        body_for_parse.clone()
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

    let enums = script_enums_config();
    let shot_type_hint = enums.shot_type.join(",");
    let emotion_hint = enums.emotion.join(",");
    let camera_move_hint = enums.camera_move.join(",");
    let system_template = r#"【身份定位】
你是从业15年的顶级影视分镜师+AI视频提示词工程师。

【输出目标】
将输入剧本解析为 JSON 数组。每个元素必须包含以下字段（camelCase）：
serialNumber:number, actNumber:number, duration:number, shotDesc:string,
roles:Array<{roleName:string, roleDesc:string, action:string, emotion:string, lines:string}>,
shotType:string, cameraMove:string, lightAtmosphere:string, soundEffect:string, reference:string,
storyboardPrompt:string, videoMotionPrompt:string

【枚举约束】
shotType 仅可取：__SHOT_TYPE_OPTIONS__
emotion 仅可取：__EMOTION_OPTIONS__
cameraMove 仅可取：__CAMERA_MOVE_OPTIONS__

【硬性规则】
1) serialNumber 从 1 递增，不跳号不重复；
2) duration 单位秒，保留 1 位小数，通常 1~5，最大不超过 8；
3) 不得新增剧情，不得改写关键台词含义；
4) 若无人物，roles 传 []；
5) `roles[].roleDesc` 必须按以下五段结构组织（用于角色一致性与批量生成）；若原文缺失，必须自动分析补全：
基础身份：一位 [年龄] 的人类女性，[身高]，[身形比例]
面部特征：[脸型]，[眉形]，[眼型]，[鼻型]，[嘴型]，[肤色质感]，[发型发色]
服饰装备：身穿 [上装款式，材质质感]，下着 [下装款式，材质质感]，脚踩 [鞋履款式，材质质感]
姿态与互动：[主体动作]，[与环境/道具互动]，脸上是 [表情与情绪]，手持 [道具或特殊效果，材质质感]
环境与风格：处于 [背景环境]，[光影氛围]，整体呈现 [艺术风格/参考流派]
6) storyboardPrompt 必须严格格式：
第二幕：[画面构图：xxx] + [主体内容：xxx] + [人物空间与互动关系：xxx] + [极具体的微表情与面部特写：xxx] + [明确的场景环境元素与前景/背景道具：xxx] + [光影几何与大气效果：xxx] + [视觉风格/胶片质感：xxx] + [技术参数：xxx]
7) videoMotionPrompt 必须严格格式：
[明确的摄影机运镜轨迹与速度：xxx] + [主体极其具体的物理动作细节：xxx] + [角色之间的精确肢体互动过程：xxx] + [环境物理动态：xxx] + [时长：x.x秒]

【绝对禁止】
- 禁止输出 markdown、注释、解释文字；
- 禁止输出 JSON 以外内容。
"#;
    let system = system_template
        .replace("__SHOT_TYPE_OPTIONS__", &shot_type_hint)
        .replace("__EMOTION_OPTIONS__", &emotion_hint)
        .replace("__CAMERA_MOVE_OPTIONS__", &camera_move_hint);
    let system = format!("{}\n\n{}", style_profile_directive(style), system);
    let messages = json!([
        { "role": "system", "content": system },
        { "role": "user", "content": user }
    ]);
    db::log_event(
        conn,
        run_id,
        Some(&node.id),
        "script_parse_request",
        &json!({
            "sourceLen": body_for_parse.len(),
            "styleProfile": style_profile_name(style),
            "hasUpstreamText": has_upstream_text,
            "videoRefCount": video_paths.len()
        }),
    )?;

    let mut final_parsed: Option<Vec<ScriptBeatOut>> = None;
    let mut last_err = String::new();
    for attempt in 1u32..=3u32 {
        db::log_event(
            conn,
            run_id,
            Some(&node.id),
            "script_parse_attempt",
            &json!({ "attempt": attempt }),
        )?;
        let raw = match openai_chat_completion(http, settings, messages.clone(), &params).await {
            Ok(r) => r,
            Err(e) => {
                last_err = e.clone();
                db::log_event(
                    conn,
                    run_id,
                    Some(&node.id),
                    "script_parse_retry",
                    &json!({ "attempt": attempt, "phase": "llm", "error": e }),
                )?;
                if attempt == 3 {
                    db::log_event(
                        conn,
                        run_id,
                        Some(&node.id),
                        "script_parse_failed",
                        &json!({ "error": last_err }),
                    )?;
                    return Err(last_err);
                }
                continue;
            }
        };
        match parse_script_beats_from_raw_llm(&raw) {
            Ok(p) => {
                final_parsed = Some(p);
                break;
            }
            Err(e) => {
                last_err = e;
                db::log_event(
                    conn,
                    run_id,
                    Some(&node.id),
                    "script_parse_retry",
                    &json!({ "attempt": attempt, "phase": "json", "error": last_err }),
                )?;
                if attempt == 3 {
                    db::log_event(
                        conn,
                        run_id,
                        Some(&node.id),
                        "script_parse_failed",
                        &json!({ "error": last_err }),
                    )?;
                    return Err(last_err);
                }
            }
        }
    }
    let parsed = final_parsed.ok_or_else(|| last_err)?;

    let beats = normalize_script_beats(parsed);
    let selection: Vec<String> = beats
        .iter()
        .filter_map(|v| v.get("id").and_then(|x| x.as_str()).map(|s| s.to_string()))
        .collect();
    let total_duration = beats
        .last()
        .and_then(|v| v.get("timeOut").and_then(|x| x.as_f64()))
        .unwrap_or(0.0);
    let shot_count = beats.len();
    let patch = json!({
        "scriptBeats": beats,
        "scriptBeatSelection": selection,
        "scriptTotalDurationSec": total_duration,
        "scriptShotCount": shot_count,
    });
    db::log_event(
        conn,
        run_id,
        Some(&node.id),
        "script_parse_response",
        &json!({ "beatCount": selection.len(), "totalDurationSec": total_duration }),
    )?;
    Ok((source_text_for_output, patch))
}
