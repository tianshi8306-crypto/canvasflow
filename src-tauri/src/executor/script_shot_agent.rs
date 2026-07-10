// ── 阶段 3：逐镜 LLM 视觉化生成 ──
// 为每个已规划的镜头单独调用 LLM，生成画面描述、台词和 Seedance 2.0 提示词

use crate::settings::AppSettings;
use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;

use super::llm::openai_chat_completion;
use super::script_parse::ScriptStyleProfile;
use super::script_pipeline::ShotPlan;

/// 逐镜 LLM 的解析要求上下文（底栏 prompt + 任务计划摘要 + 体裁）
pub(crate) struct ShotVisualContext {
    pub requirement_text: String,
    pub brief_summary: String,
    pub style: ScriptStyleProfile,
    pub dialogue_rewrite_applied: bool,
}

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
    #[serde(default)]
    pub(crate) lighting_mood: String,
}

const SHOT_SYSTEM_PROMPT_SHORT: &str = r#"你是专业竖屏短剧分镜师。规则引擎已给出景别、运镜、时长与剪辑建议，你必须遵循并在画面描述中体现。

若用户提供【解析要求】，在不违背规则引擎硬性决策（景别/运镜/时长数值）的前提下，优先满足其中的风格、氛围、角色与镜头偏好。

【输出格式】纯 JSON 对象（不是数组），字段（camelCase）：
{
  "shotDesc": "画面描述 —— 仅基于原文，描述可见主体、动作、环境、氛围；须与给定景别/运镜一致",
  "dialogue": "台词 —— 原文对话，保持原样；无台词传空字符串",
  "seedancePositive": "Seedance 2.0 正向提示词 —— 英文关键词+(keyword:weight)，涵盖景别、光线、质感、运镜、动作",
  "seedanceNegative": "Seedance 2.0 负面提示词 —— 画面质量问题 + 该镜应避免的元素",
  "lightingMood": "光影氛围 —— 中文一句话，如冷色侧光、霓虹逆光、暖黄室内光"
}

【竖屏短剧约束】
- 双人互动：前后错位站位，前实后虚，避免左右并排
- 近景/特写占比高；全景仅用于建立空间
- 避免复杂手指手势；侧重侧脸轮廓与道具遮挡
- 运镜仅用：固定、推/拉（慢/快）、摇、横移、跟拍（前/后/侧）、手持（微/中/强）
"#;

const SHOT_SYSTEM_PROMPT_FILM: &str = r#"你是院线电影分镜师。规则引擎已给出景别、运镜、时长与剪辑建议，你必须严格遵循。

【输出格式】纯 JSON 对象（camelCase）：shotDesc, dialogue, seedancePositive, seedanceNegative, lightingMood

【电影约束】
- 重视空间建立与轴线；中景/全景比例高于短剧
- 运镜可更舒缓：缓慢推、摇、跟拍、长固定
- 画面描述强调光影层次、构图与氛围，避免过度特写堆叠
"#;

const SHOT_SYSTEM_PROMPT_AD: &str = r#"你是商业广告/TVC 分镜师。规则引擎已给出景别、运镜、时长，你必须遵循。

【输出格式】纯 JSON 对象（camelCase）：shotDesc, dialogue, seedancePositive, seedanceNegative, lightingMood

【广告约束】
- 单镜时长短；产品/卖点优先特写与细节
- 画面干净、主体突出；运镜利落（推、固定、轻跟）
- seedancePositive 强调质感、品牌调性与产品清晰度
"#;

const SHOT_SYSTEM_PROMPT_ANIME: &str = r#"你是动漫/番剧分镜师。规则引擎已给出景别、运镜、时长，你必须遵循。

【输出格式】纯 JSON 对象（camelCase）：shotDesc, dialogue, seedancePositive, seedanceNegative, lightingMood

【动漫约束】
- 情绪段落可用近景与夸张构图；动作段落清晰可读
- 运镜：固定、推、摇、跟拍；避免写实电影式过长镜头
"#;

fn shot_system_prompt(style: ScriptStyleProfile) -> &'static str {
    match style {
        ScriptStyleProfile::Film => SHOT_SYSTEM_PROMPT_FILM,
        ScriptStyleProfile::Ad => SHOT_SYSTEM_PROMPT_AD,
        ScriptStyleProfile::Anime => SHOT_SYSTEM_PROMPT_ANIME,
        ScriptStyleProfile::ShortDrama | ScriptStyleProfile::Auto => SHOT_SYSTEM_PROMPT_SHORT,
    }
}

fn build_shot_user_prompt(
    plan: &ShotPlan,
    character_hints: &HashMap<String, String>,
    ctx: &ShotVisualContext,
) -> String {
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

    let arc_section = if plan.character_arc_hint.trim().is_empty() {
        String::new()
    } else {
        format!("\n人物弧（须在画面/表演中体现）：\n{}\n", plan.character_arc_hint.trim())
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

    let requirement_block = {
        let mut parts: Vec<String> = Vec::new();
        parts.push(format!("体裁：{}", style_profile_label(ctx.style)));
        if !ctx.brief_summary.trim().is_empty() {
            parts.push(format!("任务：{}", ctx.brief_summary.trim()));
        }
        if !ctx.requirement_text.trim().is_empty()
            && ctx.requirement_text.trim() != ctx.brief_summary.trim()
        {
            parts.push(format!("用户 brief：{}", ctx.requirement_text.trim()));
        }
        if parts.is_empty() {
            String::new()
        } else {
            format!(
                "【解析要求】（在不违背下方规则引擎决策时优先满足）\n{}\n",
                parts.join("\n")
            )
        }
    };

    let dialogue_note = if ctx.dialogue_rewrite_applied {
        "\n【台词说明】对白已经编剧 pass 润色，dialogue 字段须与原始文本段中的台词一致，勿回退为更书面语。\n"
    } else {
        ""
    };

    format!(
        r#"{}
{}
【镜头 #{}】
叙事目的：{}
场景上下文：{}
出场角色：{}{}{}
{}
原始文本：
{}
---
请输出该镜头的 JSON 对象。"#,
        requirement_block,
        dialogue_note,
        plan.serial,
        purpose_label,
        plan.scene_context,
        chars_line,
        char_desc_section,
        arc_section,
        if decision_block.is_empty() {
            String::new()
        } else {
            format!("\n{}\n", decision_block)
        },
        plan.text_segment,
    )
}

fn style_profile_label(style: ScriptStyleProfile) -> &'static str {
    use super::script_parse_requirement::style_profile_label as label;
    label(style)
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
    ctx: &ShotVisualContext,
) -> Result<ShotVisualOut, String> {
    let user = build_shot_user_prompt(plan, character_hints, ctx);

    let messages = json!([
        { "role": "system", "content": shot_system_prompt(ctx.style) },
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
