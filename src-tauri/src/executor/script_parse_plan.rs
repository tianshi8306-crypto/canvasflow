//! 脚本解析任务计划：规则硬约束 + LLM 语义理解（brief 模糊时读剧本自动规划）

use crate::settings::AppSettings;
use serde_json::{json, Value};

use super::script_parse::{detect_style_from_text, style_profile_name, ScriptStyleProfile};
use super::script_parse_requirement::{
    parse_requirement_hints, resolve_cut_profile, CutProfile, ScriptParseRequirementHints,
    ShotSizeBias,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum PlanSource {
    UserBrief,
    AutoFromScript,
    Hybrid,
}

#[derive(Debug, Clone)]
pub(crate) struct ScriptParsePlan {
    pub hints: ScriptParseRequirementHints,
    pub style: ScriptStyleProfile,
    pub cut: CutProfile,
    /// LLM / 规则生成的 brief 摘要（逐镜 LLM 与日志用，不对用户展示）
    pub brief_summary: String,
    pub plan_source: PlanSource,
    pub auto_planned: bool,
}

const COARSE_STYLE_KEYWORDS: &[&str] = &[
    "短剧", "竖屏", "微短剧", "爽剧", "网剧", "电影", "院线", "广告", "tvc", "TVC", "动漫", "番剧",
    "二次元", "动画", "甜宠", "霸总",
];

const EXPLICIT_CONSTRAINT_MARKERS: &[&str] = &[
    "每镜", "单镜", "总时长", "全长", "第", "集", "特写", "全景", "近景", "反应", "快剪", "慢节奏",
    "长镜头", "秒",
];

/// brief 是否过于模糊，需 LLM 读剧本自动规划
pub(crate) fn is_brief_vague(brief: &str) -> bool {
    let t = brief.trim();
    if t.is_empty() {
        return true;
    }
    let char_count = t.chars().count();
    if char_count >= 8 && has_explicit_constraint(t) {
        return false;
    }
    if char_count < 8 && is_coarse_style_only(t) {
        return true;
    }
    char_count < 8 && !has_explicit_constraint(t)
}

fn is_coarse_style_only(text: &str) -> bool {
    let t = text.trim();
    COARSE_STYLE_KEYWORDS.iter().any(|k| t.contains(k))
        && !has_explicit_constraint(t)
}

fn has_explicit_constraint(text: &str) -> bool {
    EXPLICIT_CONSTRAINT_MARKERS.iter().any(|m| text.contains(m))
}

pub(crate) fn default_plan_from_script_body(body: &str, brief: &str) -> ScriptParsePlan {
    let style = detect_style_from_text(brief, body);
    let mut hints = parse_requirement_hints(if brief.trim().is_empty() { "短剧" } else { brief });
    if hints.style_profile.is_none() {
        hints.style_profile = Some(style);
    }
    apply_style_to_hints(&mut hints, style);
    let cut = resolve_cut_profile(&hints);
    ScriptParsePlan {
        hints,
        style,
        cut,
        brief_summary: "竖屏短剧默认分解策略".to_string(),
        plan_source: PlanSource::AutoFromScript,
        auto_planned: true,
    }
}

fn apply_style_to_hints(hints: &mut ScriptParseRequirementHints, style: ScriptStyleProfile) {
    hints.style_profile = Some(style);
    match style {
        ScriptStyleProfile::ShortDrama => {
            if hints.shot_size_bias == ShotSizeBias::None {
                hints.shot_size_bias = ShotSizeBias::CloseUp;
            }
        }
        ScriptStyleProfile::Film => {
            if hints.shot_size_bias == ShotSizeBias::None {
                hints.shot_size_bias = ShotSizeBias::Medium;
            }
        }
        ScriptStyleProfile::Ad => {
            if hints.shot_size_bias == ShotSizeBias::None {
                hints.shot_size_bias = ShotSizeBias::CloseUp;
            }
        }
        _ => {}
    }
}

/// 规则初稿 + 可选 LLM 覆盖（显式 brief 约束优先）
pub(crate) fn merge_llm_plan(
    rule_hints: ScriptParseRequirementHints,
    llm: &super::script_plan_agent::LlmParsePlanOut,
    brief: &str,
) -> ScriptParseRequirementHints {
    let mut hints = rule_hints;
    if hints.style_profile.is_none() {
        if let Some(style) = llm.style_profile {
            hints.style_profile = Some(style);
        }
    }
    if hints.episode_only.is_none() {
        hints.episode_only = llm.episode_only;
    }
    if hints.per_shot_duration_sec.is_none() {
        hints.per_shot_duration_sec = llm.per_shot_duration_sec;
    }
    if !hints.prefer_reaction_shots {
        hints.prefer_reaction_shots = llm.prefer_reaction_shots.unwrap_or(false);
    }
    if hints.shot_size_bias == ShotSizeBias::None {
        if let Some(bias) = llm.shot_size_bias {
            hints.shot_size_bias = bias;
        }
    }
    if !hints.prefer_dense_cuts && !hints.prefer_sparse_cuts {
        if llm.prefer_dense_cuts == Some(true) {
            hints.prefer_dense_cuts = true;
        } else if llm.prefer_sparse_cuts == Some(true) {
            hints.prefer_sparse_cuts = true;
        }
    }
    if !brief.trim().is_empty() {
        hints.requirement_text = brief.trim().to_string();
    } else if !llm.brief_summary.trim().is_empty() {
        hints.requirement_text = llm.brief_summary.trim().to_string();
    }
    hints
}

pub(crate) fn finalize_plan(
    hints: ScriptParseRequirementHints,
    style_param: ScriptStyleProfile,
    brief: &str,
    body: &str,
    plan_source: PlanSource,
    auto_planned: bool,
    brief_summary: String,
) -> ScriptParsePlan {
    let style = if style_param != ScriptStyleProfile::Auto {
        style_param
    } else if let Some(from_hints) = hints.style_profile {
        from_hints
    } else {
        detect_style_from_text(brief, body)
    };
    let cut = resolve_cut_profile(&hints);
    ScriptParsePlan {
        hints,
        style,
        cut,
        brief_summary,
        plan_source,
        auto_planned,
    }
}

pub(crate) fn plan_json(plan: &ScriptParsePlan) -> Value {
    json!({
        "styleProfile": style_profile_name(plan.style),
        "autoPlanned": plan.auto_planned,
        "planSource": match plan.plan_source {
            PlanSource::UserBrief => "user_brief",
            PlanSource::AutoFromScript => "auto_from_script",
            PlanSource::Hybrid => "hybrid",
        },
        "briefSummaryLen": plan.brief_summary.chars().count(),
        "episodeOnly": plan.hints.episode_only,
    })
}

pub(crate) fn assemble_storyboard_draft(beats: &[super::script_parse::ScriptBeatOut]) -> String {
    beats
        .iter()
        .map(|b| {
            let sn = b.episode_scene_shot.trim();
            let sn_label = if sn.is_empty() {
                format!("镜 {}", b.serial_number)
            } else {
                format!("镜 {}", sn)
            };
            let purpose = b.narrative_purpose.trim();
            let header = if purpose.is_empty() {
                format!("---\n{} · {:.1}s", sn_label, b.duration)
            } else {
                format!("---\n{} · {} · {:.1}s", sn_label, purpose, b.duration)
            };
            let heading = b.scene_heading.trim();
            let scene_line = if heading.is_empty() {
                String::new()
            } else {
                format!("\n场：{}", heading)
            };
            format!(
                "{}{}\n{}",
                header,
                scene_line,
                b.storyboard_block.trim()
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

/// 构建完整任务计划（规则 + 可选 LLM，静默 fallback）
pub(crate) async fn resolve_script_parse_plan(
    http: &reqwest::Client,
    settings: &AppSettings,
    params: &serde_json::Value,
    brief: &str,
    script_body: &str,
    style_param: ScriptStyleProfile,
    has_upstream_text: bool,
) -> ScriptParsePlan {
    let rule_hints = parse_requirement_hints(brief);
    let vague = is_brief_vague(brief);

    if vague && has_upstream_text {
        match super::script_plan_agent::plan_from_script_llm(
            http, settings, params, brief, script_body,
        )
        .await
        {
            Ok(llm) => {
                let summary = if llm.brief_summary.trim().is_empty() {
                    if llm.scope_note.trim().is_empty() {
                        "读剧本自动规划".to_string()
                    } else {
                        llm.scope_note.trim().to_string()
                    }
                } else {
                    llm.brief_summary.trim().to_string()
                };
                let hints = merge_llm_plan(rule_hints, &llm, brief);
                let source = if brief.trim().is_empty() {
                    PlanSource::AutoFromScript
                } else {
                    PlanSource::Hybrid
                };
                return finalize_plan(
                    hints,
                    style_param,
                    brief,
                    script_body,
                    source,
                    true,
                    summary,
                );
            }
            Err(_) => {
                return default_plan_from_script_body(script_body, brief);
            }
        }
    }

    let summary = if brief.trim().is_empty() {
        "竖屏短剧默认分解策略".to_string()
    } else {
        brief.trim().to_string()
    };
    finalize_plan(
        rule_hints,
        style_param,
        brief,
        script_body,
        PlanSource::UserBrief,
        false,
        summary,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn assemble_draft_has_separators() {
        use super::super::script_parse::ScriptBeatOut;
        let draft = assemble_storyboard_draft(&[ScriptBeatOut {
            serial_number: 1,
            duration: 2.5,
            episode_scene_shot: "1-1-01".to_string(),
            narrative_purpose: "建立".to_string(),
            scene_heading: "1-1日 外 悬崖".to_string(),
            storyboard_block: "时长：2.5秒\n景别：全景".to_string(),
            ..ScriptBeatOut::default()
        }]);
        assert!(draft.contains("---"));
        assert!(draft.contains("1-1-01"));
        assert!(draft.contains("悬崖"));
    }

    #[test]
    fn vague_empty_and_coarse_only() {
        assert!(is_brief_vague(""));
        assert!(is_brief_vague("短剧"));
        assert!(!is_brief_vague("短剧 先输出第一集"));
        assert!(!is_brief_vague("每镜3秒"));
    }
}
