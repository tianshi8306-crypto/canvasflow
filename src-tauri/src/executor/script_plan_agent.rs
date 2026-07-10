//! 阶段 0：LLM 读剧本 + brief，生成 ScriptParsePlan 语义字段（静默，失败可 fallback）

use crate::settings::AppSettings;
use serde::Deserialize;
use serde_json::json;

use super::llm::openai_chat_completion;
use super::script_parse::ScriptStyleProfile;
use super::script_parse_requirement::ShotSizeBias;

#[derive(Debug, Clone, Default)]
pub(crate) struct LlmParsePlanOut {
    pub style_profile: Option<ScriptStyleProfile>,
    pub episode_only: Option<u32>,
    pub prefer_dense_cuts: Option<bool>,
    pub prefer_sparse_cuts: Option<bool>,
    pub prefer_reaction_shots: Option<bool>,
    pub per_shot_duration_sec: Option<f64>,
    pub shot_size_bias: Option<ShotSizeBias>,
    pub brief_summary: String,
    pub scope_note: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LlmParsePlanRaw {
    #[serde(default)]
    style_profile: Option<String>,
    #[serde(default)]
    episode_only: Option<u32>,
    #[serde(default)]
    prefer_dense_cuts: Option<bool>,
    #[serde(default)]
    prefer_sparse_cuts: Option<bool>,
    #[serde(default)]
    prefer_reaction_shots: Option<bool>,
    #[serde(default)]
    per_shot_duration_sec: Option<f64>,
    #[serde(default)]
    shot_size_bias: Option<String>,
    #[serde(default)]
    brief_summary: String,
    #[serde(default)]
    scope_note: String,
}

fn parse_style_profile_str(raw: &str) -> ScriptStyleProfile {
    match raw.trim().to_lowercase().as_str() {
        "film" => ScriptStyleProfile::Film,
        "ad" => ScriptStyleProfile::Ad,
        "anime" => ScriptStyleProfile::Anime,
        _ => ScriptStyleProfile::ShortDrama,
    }
}

fn parse_shot_bias_str(raw: &str) -> ShotSizeBias {
    match raw.trim().to_lowercase().as_str() {
        "close_up" | "closeup" => ShotSizeBias::CloseUp,
        "medium" => ShotSizeBias::Medium,
        "wide" => ShotSizeBias::Wide,
        _ => ShotSizeBias::None,
    }
}

fn raw_to_out(raw: LlmParsePlanRaw) -> LlmParsePlanOut {
    LlmParsePlanOut {
        style_profile: raw.style_profile.as_deref().map(parse_style_profile_str),
        episode_only: raw.episode_only,
        prefer_dense_cuts: raw.prefer_dense_cuts,
        prefer_sparse_cuts: raw.prefer_sparse_cuts,
        prefer_reaction_shots: raw.prefer_reaction_shots,
        per_shot_duration_sec: raw.per_shot_duration_sec,
        shot_size_bias: raw.shot_size_bias.as_deref().map(parse_shot_bias_str),
        brief_summary: raw.brief_summary,
        scope_note: raw.scope_note,
    }
}

const PLAN_SYSTEM_PROMPT: &str = r#"你是专业分镜导演。根据剧本文本与用户 brief（可能为空或极简），输出本次分解的任务计划 JSON（不要输出镜头列表）。

只输出一个 JSON 对象（camelCase）：
{
  "styleProfile": "short_drama | film | ad | anime",
  "episodeOnly": 集数数字或 null（仅当剧本有多集且应只拆某一集时）,
  "preferDenseCuts": true/false/null,
  "preferSparseCuts": true/false/null,
  "preferReactionShots": true/false/null,
  "perShotDurationSec": 数字或 null,
  "shotSizeBias": "close_up | medium | wide | none",
  "briefSummary": "一句话说明本次分解策略（内部用）",
  "scopeNote": "范围说明，如仅第一集"
}

约束：
- brief 为空时，必须从剧本推断体裁与范围
- 竖屏爽剧/对白密集 → short_drama + close_up + preferReactionShots
- 电影感/场次建立 → film + medium + preferSparseCuts
- 广告/TVC → ad + close_up + preferDenseCuts
"#;

fn truncate_script_sample(body: &str, max_chars: usize) -> String {
    let chars: Vec<char> = body.chars().collect();
    if chars.len() <= max_chars {
        return body.to_string();
    }
    chars[..max_chars].iter().collect::<String>() + "\n…（后续省略）"
}

fn extract_json_object_text(raw: &str) -> Option<&str> {
    let start = raw.find('{')?;
    let end = raw.rfind('}')?;
    if end < start {
        return None;
    }
    Some(&raw[start..=end])
}

pub(crate) async fn plan_from_script_llm(
    http: &reqwest::Client,
    settings: &AppSettings,
    params: &serde_json::Value,
    brief: &str,
    script_body: &str,
) -> Result<LlmParsePlanOut, String> {
    let sample = truncate_script_sample(script_body, 8000);
    let brief_line = if brief.trim().is_empty() {
        "（用户未填写 brief，请从剧本推断）".to_string()
    } else {
        brief.trim().to_string()
    };
    let user = format!(
        "【用户 brief】\n{}\n\n【剧本节选】\n{}",
        brief_line, sample
    );
    let messages = json!([
        { "role": "system", "content": PLAN_SYSTEM_PROMPT },
        { "role": "user", "content": user }
    ]);
    let raw = openai_chat_completion(http, settings, messages, params).await?;
    let obj_text = extract_json_object_text(&raw)
        .ok_or_else(|| "任务计划 LLM 未返回 JSON".to_string())?;
    let parsed: LlmParsePlanRaw =
        serde_json::from_str(obj_text).map_err(|e| format!("任务计划 JSON 解析失败: {e}"))?;
    Ok(raw_to_out(parsed))
}
