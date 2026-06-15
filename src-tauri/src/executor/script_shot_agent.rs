// ── 阶段 3：逐镜 LLM 视觉化生成 ──
// 为每个已规划的镜头单独调用 LLM，生成画面描述、台词和 Seedance 2.0 提示词

use crate::settings::AppSettings;
use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;

use super::llm::openai_chat_completion;
use super::script_pipeline::ShotPlan;

/// LLM 返回的单镜结果（逐镜调用，返回单对象而非数组）
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ShotVisualOut {
    #[serde(default)]
    pub(crate) shot_desc: String,
    #[serde(default)]
    pub(crate) dialogue: String,
    #[serde(default)]
    pub(crate) seedance_positive: String,
    #[serde(default)]
    pub(crate) seedance_negative: String,
}

const SHOT_SYSTEM_PROMPT: &str = r#"你是专业竖屏短剧分镜师。规则引擎已给出景别、运镜、时长与剪辑建议，你必须遵循并在画面描述中体现。

【输出格式】纯 JSON 对象（不是数组），字段（camelCase）：
{
  "shotDesc": "画面描述 —— 仅基于原文，描述可见主体、动作、环境、氛围；须与给定景别/运镜一致",
  "dialogue": "台词 —— 原文对话，保持原样；无台词传空字符串",
  "seedancePositive": "Seedance 2.0 正向提示词 —— 英文关键词+(keyword:weight)，涵盖景别、光线、质感、运镜、动作",
  "seedanceNegative": "Seedance 2.0 负面提示词 —— 画面质量问题 + 该镜应避免的元素"
}

【竖屏短剧约束】
- 双人互动：前后错位站位，前实后虚，避免左右并排
- 近景/特写占比高；全景仅用于建立空间
- 避免复杂手指手势；侧重侧脸轮廓与道具遮挡
- 运镜仅用：固定、推/拉（慢/快）、摇、横移、跟拍（前/后/侧）、手持（微/中/强）
- 效果类（慢动作、叠化、定格）写在 seedancePositive，不要当作运镜名
"#;

fn build_shot_user_prompt(plan: &ShotPlan, character_hints: &HashMap<String, String>) -> String {
    let purpose_label = match plan.narrative_purpose {
        super::script_pipeline::NarrativePurpose::Establishing => "建立（开场/新场景）",
        super::script_pipeline::NarrativePurpose::Advancing => "推进（常规剧情）",
        super::script_pipeline::NarrativePurpose::Turning => "转折（情绪重大变化）",
        super::script_pipeline::NarrativePurpose::Closing => "收束（结尾）",
    };

    let chars_line = if plan.characters_in_shot.is_empty() {
        "（无对话角色）".to_string()
    } else {
        plan.characters_in_shot.join("、")
    };

    // 为每个角色附加描述线索
    let char_desc_lines: Vec<String> = plan.characters_in_shot.iter()
        .filter_map(|name| {
            let hints = character_hints.get(name)?;
            if hints.is_empty() { return None; }
            Some(format!("- {}：{}", name, hints))
        })
        .collect();
    let char_desc_section = if char_desc_lines.is_empty() {
        String::new()
    } else {
        format!("\n角色特征：\n{}", char_desc_lines.join("\n"))
    };

    let decision_block = if plan.shot_size.is_empty() {
        String::new()
    } else {
        format!(
            r#"规则引擎决策（须遵循）：
- 场景：{}
- 节奏功能：{}
- 景别：{}
- 运镜：{}（{}）
- 时长：{:.1}秒
- 声音：{}
- 剪辑：{}
- 构图：{}
- 竖屏：{}
- 标签：{}"#,
            plan.scene_heading,
            plan.rhythm_function,
            plan.shot_size,
            plan.camera_move,
            plan.camera_angle,
            plan.estimated_duration_sec,
            plan.sound_hint,
            plan.edit_focus,
            plan.composition_note,
            plan.vertical_note,
            plan.tags_summary,
        )
    };

    format!(
        r#"【镜头 #{}】
叙事目的：{}
场景上下文：{}
出场角色：{}{}
{}
原始文本：
{}
---
请输出该镜头的 JSON 对象。"#,
        plan.serial,
        purpose_label,
        plan.scene_context,
        chars_line,
        char_desc_section,
        if decision_block.is_empty() {
            String::new()
        } else {
            format!("\n{}\n", decision_block)
        },
        plan.text_segment,
    )
}

fn extract_json_object_text(raw: &str) -> Option<&str> {
    let start = raw.find('{')?;
    let end = raw.rfind('}')?;
    if end < start { return None; }
    Some(&raw[start..=end])
}

pub(crate) async fn generate_shot_visual(
    http: &reqwest::Client,
    settings: &AppSettings,
    params: &serde_json::Value,
    plan: &ShotPlan,
    character_hints: &HashMap<String, String>,
) -> Result<ShotVisualOut, String> {
    let user = build_shot_user_prompt(plan, character_hints);

    let messages = json!([
        { "role": "system", "content": SHOT_SYSTEM_PROMPT },
        { "role": "user", "content": user }
    ]);

    // 单镜最多重试 2 次
    for attempt in 1u32..=2u32 {
        let raw = openai_chat_completion(http, settings, messages.clone(), params)
            .await
            .map_err(|e| e)?;

        let obj_text = extract_json_object_text(&raw)
            .ok_or_else(|| "逐镜生成失败：未返回 JSON 对象".to_string())?;

        match serde_json::from_str::<ShotVisualOut>(obj_text) {
            Ok(v) => return Ok(v),
            Err(e) => {
                if attempt == 2 {
                    return Err(format!("逐镜生成 JSON 解析失败（镜头 #{}）: {}", plan.serial, e));
                }
                // 重试
            }
        }
    }

    Err(format!("逐镜生成失败（镜头 #{}）", plan.serial))
}
