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

const SHOT_SYSTEM_PROMPT: &str = r#"你是专业影视分镜师。根据镜头上下文，为单个镜头生成结构化数据。

【输出格式】纯 JSON 对象（不是数组），字段（camelCase）：
{
  "shotDesc": "画面描述 —— 仅基于提供的原文信息，描述该镜头中可见的主体、动作、环境、氛围。不凭空添加原文没有的元素",
  "dialogue": "台词 —— 原文中的对话，保持原样。若无台词传空字符串",
  "seedancePositive": "Seedance 2.0 正向提示词 —— 用逗号分隔的英文关键词+括号权重，如 (cinematic lighting:1.3), (close-up:1.2)，涵盖构图景别、光线氛围、风格质感、运镜轨迹、主体动作",
  "seedanceNegative": "Seedance 2.0 负面提示词 —— 逗号分隔的英文关键词，列出该镜应避免的元素，如 blurry, low quality, distorted face, extra limbs"
}

【规则】
- shotDesc 只描述原文已有的信息
- seedancePositive 用英文关键词 + (keyword:weight) 格式，权重范围 0.5~2.0
- seedanceNegative 列出通用的画面质量问题 + 该镜头特定的违和元素
- duration 已由拆分引擎确定，无需生成
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

    format!(
        r#"【镜头 #{}】
叙事目的：{}
场景上下文：{}
出场角色：{}{}
原始文本：
{}
---
请输出该镜头的 JSON 对象。"#,
        plan.serial,
        purpose_label,
        plan.scene_context,
        chars_line,
        char_desc_section,
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
