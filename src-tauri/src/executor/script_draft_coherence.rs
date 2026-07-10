//! P2：整稿分镜稿连贯性 pass（解析完成后单次 LLM 润色，静默 fallback）

use crate::settings::AppSettings;
use serde_json::json;

use super::llm::openai_chat_completion;
use super::script_parse::ScriptStyleProfile;

const COHERENCE_SYSTEM: &str = r#"你是分镜稿编辑。输入为按「---」分隔的多镜分镜稿，请做连贯性润色后整稿输出。

【必须遵守】
- 保持镜头块数量与「---」分隔结构不变；不得合并、拆分或删镜
- 每块首行镜号（如「镜 1-1-01 · …」）与「时长/景别/画面/镜头运动/台词」等字段标签保持不变
- 只润色「画面」描述与衔接用语，修正人称/角色名/场号前后不一致
- 不要添加解释、前言或 JSON；直接输出润色后的完整分镜稿

【禁止】
- 改变镜号、时长数值、景别/运镜决策字段
- 编造剧本中未出现的剧情
"#;

fn count_draft_blocks(draft: &str) -> usize {
    let trimmed = draft.trim();
    if trimmed.is_empty() {
        return 0;
    }
    let normalized = if trimmed.starts_with("---") {
        trimmed.to_string()
    } else {
        format!("---\n{trimmed}")
    };
    normalized
        .split("\n---\n")
        .filter(|b| b.trim().len() > 20)
        .count()
        .max(1)
}

fn strip_markdown_fences(text: &str) -> String {
    let t = text.trim();
    if t.starts_with("```") {
        let inner = t
            .trim_start_matches('`')
            .trim_start_matches(|c: char| c.is_alphabetic() || c == '\n')
            .trim();
        if let Some(end) = inner.rfind("```") {
            return inner[..end].trim().to_string();
        }
        return inner.to_string();
    }
    t.to_string()
}

/// 润色后分镜稿须与原文块数一致且非空
pub(crate) fn validate_coherence_output(original: &str, polished: &str) -> bool {
    let polished = polished.trim();
    if polished.len() < original.len() / 4 {
        return false;
    }
    if !polished.contains("---") && !polished.contains('镜') {
        return false;
    }
    let orig_n = count_draft_blocks(original);
    let new_n = count_draft_blocks(polished);
    orig_n > 0 && orig_n == new_n
}

fn style_label(style: ScriptStyleProfile) -> &'static str {
    use super::script_parse_requirement::style_profile_label as label;
    label(style)
}

pub(crate) async fn polish_storyboard_draft_coherence(
    http: &reqwest::Client,
    settings: &AppSettings,
    params: &serde_json::Value,
    draft: &str,
    brief_summary: &str,
    style: ScriptStyleProfile,
) -> Result<String, String> {
    if draft.trim().is_empty() {
        return Err("分镜稿为空".into());
    }
    let block_count = count_draft_blocks(draft);
    let user = format!(
        "体裁：{}\n任务：{}\n镜头块数：{}\n\n【分镜稿】\n{}",
        style_label(style),
        if brief_summary.trim().is_empty() {
            "分镜连贯性润色"
        } else {
            brief_summary.trim()
        },
        block_count,
        draft.trim()
    );
    let messages = json!([
        { "role": "system", "content": COHERENCE_SYSTEM },
        { "role": "user", "content": user }
    ]);
    let raw = openai_chat_completion(http, settings, messages, params).await?;
    let polished = strip_markdown_fences(&raw);
    if validate_coherence_output(draft, &polished) {
        Ok(polished)
    } else {
        Err("连贯性润色输出未通过校验，已保留原稿".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "---\n镜 1-1-01 · 建立 · 2.5s\n画面：A\n\n---\n镜 1-1-02 · 推进 · 2.0s\n画面：B";

    #[test]
    fn counts_blocks() {
        assert_eq!(count_draft_blocks(SAMPLE), 2);
    }

    #[test]
    fn validates_matching_block_count() {
        let ok = "---\n镜 1\n画面：润色A\n\n---\n镜 2\n画面：润色B";
        assert!(validate_coherence_output(SAMPLE, ok));
    }

    #[test]
    fn rejects_wrong_block_count() {
        assert!(!validate_coherence_output(SAMPLE, "---\n镜 1\n画面：only one"));
    }

    #[test]
    fn strips_code_fence() {
        assert_eq!(
            strip_markdown_fences("```markdown\n---\n镜 1\n```"),
            "---\n镜 1"
        );
    }
}
