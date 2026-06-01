//! Hermes Brain：无状态 LLM 顾问（画布 DAG → 资产卡 → chat）

use crate::graph::CanvasGraph;
use crate::settings::AppSettings;
use serde_json::json;
use tauri::AppHandle;

use super::hermes_asset::{all_upstream_asset_cards, project_scope_asset_cards};
use super::llm::{openai_chat_completion, openai_chat_completion_stream};
use super::types::AssetCard;

pub fn node_type_system_prompt(node_type: &str) -> &'static str {
    match node_type {
        "textNode" | "llm" => STORY_ARCHITECT_PROMPT,
        "scriptNode" => SCRIPT_DOCTOR_PROMPT,
        "imageNode" | "imageAsset" => IMAGE_DIRECTOR_PROMPT,
        "videoNode" => VIDEO_CINEMATOGRAPHER_PROMPT,
        "audioNode" => AUDIO_DESIGNER_PROMPT,
        _ => GENERAL_ASSISTANT_PROMPT,
    }
}

const STORY_ARCHITECT_PROMPT: &str = r#"你是 CanvasFlow 画布灵体的「故事建筑师」分身。
帮助用户从模糊想法扩展为可影视化的故事结构；用自然中文聊天，简洁可执行；勿自称 Hermes。"#;

const SCRIPT_DOCTOR_PROMPT: &str = r#"你是灵体侧「脚本医生」。根据上游故事与当前脚本/分镜资产，帮助润色镜头、节奏与画面描述；口语化中文，勿自称 Hermes。"#;

const IMAGE_DIRECTOR_PROMPT: &str = r#"你是灵体侧「视觉导演」。帮助优化图片生成提示词，保持与上游剧本/分镜一致；可给出中英文 prompt 建议；勿自称 Hermes。"#;

const VIDEO_CINEMATOGRAPHER_PROMPT: &str = r#"你是灵体侧「电影摄影师」。帮助优化视频生成提示词与镜头运动描述；可给出英文 prompt 建议；勿自称 Hermes。"#;

const AUDIO_DESIGNER_PROMPT: &str = r#"你是 Hermes「声音设计师」。帮助优化音频节点的 TTS 文案与旁白表演描述；用中文。

当用户给的是「某某悲伤地说」这类模糊指令时，不要只回一个形容词。按四层给出可粘贴到 TTS 文本框的内容：
1）音色人设（角色、年龄、声线高低）；2）语速与语气；3）气息、咬字、句尾处理；4）单独一行「台词：」+ 引号内实际朗读文字。
若对话上下文中带有【知识库参考】，优先遵循其中的模板与反例/正例。"#;

const GENERAL_ASSISTANT_PROMPT: &str = r#"你是 CanvasFlow 画布里的创作灵体（创作搭档），不是名为「Hermes」的独立产品助理。
用像同事聊天的自然中文；少用「已确认」「操作结果」「随时告诉我」等客服腔。
若系统注入【灵体身份】，须用其中的名字自称、用其中的称呼叫用户；**禁止**说「我是 Hermes/H/内置助手」。
你熟悉 AI 短视频/短剧制片：无限画布非线性编排、脚本与分镜、文生图/图生视频（含 Seedance）、人物动作与运镜 prompt、TTS、时间线导出。
通过画布节点与连线理解项目，不编造未出现在资产卡中的成片路径。
原则：用户可只做单镜或小目标，勿推销完整流水线；建议须可执行（镜号/节点/工具）；区分工程事实与行业常识。
若【制片进度感知】含「近期画布变化」或「对话指代默认镜」，优先视为用户刚手改或选中的事实，再回答。
**禁止**在纯对话中声称「已创建/已添加/已修改」画布节点；未执行工具时只说「将自动执行」或让用户回复「执行」。"#;

const HERMES_ADVISOR_PROMPT: &str = r#"你是 CanvasFlow 画布灵体（顾问模式），不是「Hermes」品牌客服。
用户可能咨询：电影史与类型片、镜头语言与蒙太奇、编剧结构、风格参考片、短剧/网剧行业常识，以及 AI 出图/出视频/Seedance 参数与排障。
若【灵体身份】指定了名字与称呼，对话中必须使用；**禁止**自称 Hermes。
要求：
1. 自然口语中文；电影常识勿编造；结合资产卡区分事实与建议。
2. 无限画布：勿推销全流程；先答当前一句。
3. 有执行意图时：说明「执行将由系统自动运行」，勿假装已完成。
4. 勿复述用户原话；知识库要点只摘与当前问题相关的条目。"#;

fn normalize_reply_style(raw: &str) -> &'static str {
    match raw.trim() {
        "standard" => "standard",
        "detailed" => "detailed",
        _ => "concise",
    }
}

fn infer_reply_style(user_message: &str, advisor: bool, message_mode: Option<&str>) -> &'static str {
    let t = user_message.trim();
    if t.is_empty() {
        return "concise";
    }
    if matches!(t, "执行" | "开始" | "继续" | "确认" | "好的" | "好") {
        return "concise";
    }
    let mode = message_mode.unwrap_or_else(|| {
        if advisor {
            "consult"
        } else if (t.contains("添加") && t.contains("节点"))
            || t.contains("出图")
            || t.contains("出视频")
            || t.contains("分镜")
            || t.contains("不是咨询")
        {
            "execute"
        } else {
            "consult"
        }
    });
    let deep = t.contains("为什么")
        || t.contains("如何")
        || t.contains("解释")
        || t.contains("详细")
        || t.contains("区别")
        || t.contains("对比")
        || t.contains("分析")
        || t.contains("蒙太奇");
    match mode {
        "execute" => {
            if t.len() <= 56 {
                "concise"
            } else {
                "concise"
            }
        }
        "mixed" => {
            if deep {
                "detailed"
            } else {
                "standard"
            }
        }
        _ => {
            if advisor && deep {
                "detailed"
            } else if deep || (t.len() > 36 && (t.contains('？') || t.contains('?'))) {
                "detailed"
            } else if t.len() <= 28 && !t.contains('？') && !t.contains('?') {
                "concise"
            } else if t.len() <= 72 {
                "standard"
            } else {
                "detailed"
            }
        }
    }
}

fn effective_reply_style(
    extra_params: &serde_json::Value,
    user_message: &str,
    advisor: bool,
) -> &'static str {
    if let Some(s) = extra_params.get("replyStyle").and_then(|v| v.as_str()) {
        return normalize_reply_style(s);
    }
    let mode = extra_params
        .get("messageMode")
        .and_then(|v| v.as_str());
    infer_reply_style(user_message, advisor, mode)
}

fn reply_style_instruction_block(style: &str, advisor: bool) -> &'static str {
    match (style, advisor) {
        ("detailed", true) => {
            "【回复风格·详细】可用分点展开，总长宜≤400字；仍禁止声称已执行未跑工具的操作；避免无意义套话。"
        }
        ("standard", true) => {
            "【回复风格·标准】总长≤250字；深度咨询可用分点，每点一行、最多4点；避免空话套话。"
        }
        ("detailed", false) => {
            "【回复风格·详细】可分段说明，总长宜≤400字；仍禁止声称已执行未跑工具的操作。"
        }
        ("standard", false) => {
            "【回复风格·标准】总长≤200字、≤5句；避免「已确认」「操作结果」类套话。"
        }
        (_, true) => {
            "【回复风格·简洁】总长≤150字、≤3句；禁止「已确认」「操作结果」「随时告诉我」；知识库只摘1～2条。"
        }
        _ => {
            "【回复风格·简洁】总长≤120字、≤3句；禁止「已确认」「操作结果」套话；禁止「随时告诉我」；执行类≤2句。"
        }
    }
}

fn compose_system_prompt(
    base: &str,
    extra_params: &serde_json::Value,
    user_message: &str,
    advisor: bool,
) -> String {
    let style = effective_reply_style(extra_params, user_message, advisor);
    format!(
        "{}\n{}\n【篇幅】根据用户本轮意图自行把握：执行/改画布宜极简；短问短答；深度咨询、理论或排障可分段展开。",
        base,
        reply_style_instruction_block(style, advisor)
    )
}

fn director_plan_reply_hint(style: &str) -> &'static str {
    match style {
        "detailed" => "≤120字",
        "standard" => "≤72字",
        _ => "≤40字",
    }
}

fn format_asset_cards_as_context(cards: &[AssetCard]) -> String {
    if cards.is_empty() {
        return String::new();
    }
    let mut parts = vec!["## 画布资产上下文\n".to_string()];
    for card in cards {
        let type_label = match card.node_type.as_str() {
            "textNode" | "llm" => "故事/文本",
            "scriptNode" => "脚本/分镜",
            "imageNode" | "imageAsset" => "图片节点",
            "videoNode" => "视频节点",
            "audioNode" => "音频节点",
            _ => card.node_type.as_str(),
        };
        parts.push(format!("### {} [{}]", type_label, card.label));
        if !card.summary.is_empty() {
            parts.push(card.summary.clone());
        }
        if !card.references.is_empty() {
            parts.push(format!("资产路径：{}", card.references.join(", ")));
        }
        parts.push(String::new());
    }
    parts.join("\n")
}

pub fn build_hermes_messages(
    system_prompt: &str,
    asset_cards: &[AssetCard],
    user_message: &str,
    chat_history: &[serde_json::Value],
    situation_summary: &str,
) -> serde_json::Value {
    let mut system_content = system_prompt.to_string();
    let situation = situation_summary.trim();
    if !situation.is_empty() {
        system_content.push_str("\n\n## 制片进度感知\n");
        system_content.push_str(situation);
    }
    let ctx = format_asset_cards_as_context(asset_cards);
    if !ctx.is_empty() {
        system_content.push_str("\n\n");
        system_content.push_str(&ctx);
    }

    let mut messages = vec![json!({ "role": "system", "content": system_content })];
    for item in chat_history {
        if let (Some(role), Some(content)) = (
            item.get("role").and_then(|v| v.as_str()),
            item.get("content").and_then(|v| v.as_str()),
        ) {
            if matches!(role, "user" | "assistant") && !content.trim().is_empty() {
                messages.push(json!({ "role": role, "content": content }));
            }
        }
    }
    messages.push(json!({ "role": "user", "content": user_message }));
    json!(messages)
}

fn resolve_cards(graph: &CanvasGraph, focus_node_id: Option<&str>) -> Vec<AssetCard> {
    match focus_node_id {
        Some(id) if !id.is_empty() => all_upstream_asset_cards(graph, id),
        _ => project_scope_asset_cards(graph),
    }
}

fn resolve_system_prompt(graph: &CanvasGraph, focus_node_id: Option<&str>) -> &'static str {
    let node_type = focus_node_id
        .and_then(|id| graph.nodes.iter().find(|n| n.id == id))
        .map(|n| n.node_type.as_str())
        .unwrap_or("unknown");
    if focus_node_id.is_some() {
        node_type_system_prompt(node_type)
    } else {
        GENERAL_ASSISTANT_PROMPT
    }
}

fn advisor_mode_from_extra(extra_params: &serde_json::Value) -> bool {
    extra_params
        .get("advisorMode")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

pub async fn chat_stream(
    app: &AppHandle,
    http: &reqwest::Client,
    settings: &AppSettings,
    graph: &CanvasGraph,
    focus_node_id: Option<&str>,
    user_message: &str,
    situation_summary: &str,
    chat_history: &[serde_json::Value],
    extra_params: &serde_json::Value,
    request_id: &str,
) -> Result<String, String> {
    let advisor = advisor_mode_from_extra(extra_params);
    let base = if advisor {
        HERMES_ADVISOR_PROMPT
    } else {
        resolve_system_prompt(graph, focus_node_id)
    };
    let system_prompt = compose_system_prompt(base, extra_params, user_message, advisor);
    let cards = resolve_cards(graph, focus_node_id);
    let messages = build_hermes_messages(
        &system_prompt,
        &cards,
        user_message,
        chat_history,
        situation_summary,
    );
    openai_chat_completion_stream(app, http, settings, messages, extra_params, request_id).await
}

pub async fn enhance_prompt(
    http: &reqwest::Client,
    settings: &AppSettings,
    graph: &CanvasGraph,
    node_id: &str,
    current_prompt: &str,
    extra_params: &serde_json::Value,
) -> Result<String, String> {
    let system_prompt = resolve_system_prompt(graph, Some(node_id));
    let cards = resolve_cards(graph, Some(node_id));
    let messages = build_hermes_messages(
        system_prompt,
        &cards,
        &format!(
            "请优化以下提示词，使其更专业、更具体、更适合高质量生成。只输出优化后的提示词，不要解释：\n\n{}",
            current_prompt
        ),
        &[],
        "",
    );
    openai_chat_completion(http, settings, messages, extra_params).await
}

const DIRECTOR_PLAN_PROMPT: &str = r#"你是 CanvasFlow 内置 Hermes 的「导演规划器」。
根据用户指令与画布状态，输出**仅含 JSON 对象**的执行计划（不要 markdown 围栏外的文字）。

## 可用工具（toolId 必须完全一致）
- canvas.add_text_node：用户要求在画布上添加文本/文案节点时
- canvas.ensure_script：画布无脚本节点且用户要开始创作时
- script.update_brief：写/更新脚本梗概（args.briefText 可选，缺省用用户原话）
- script.generate_outline：从梗概生成镜头表（无 scriptBeats 时）
- script.generate_storyboard：为镜头生成分镜文案
- storyboard.patch_shot：改单镜画面/运镜并可重出图或视频（args.beatIds 镜号数组；visualPrompt、videoMotionPrompt 可选；regenerateImage、regenerateVideo 布尔）
- canvas.focus：定位镜号对应节点（args.beatIds；target 可选 auto/script/image/video）
- bible.update：更新项目圣经（logline、visualStyle、taboos、targetDurationSec；syncCharacters 布尔）
- template.run：套用已保存计划模板（args.templateId 如 storyboard-keyframes、creative-pipeline；步骤会展开为多条工具）
- chain.spawn_media_nodes：为分镜创建图片+视频节点
- image.generate_for_beats：批量提交图片生成（需分镜就绪、建议先建链）
- image.retry_failed：仅重试失败关键帧出图（status=failed，需已有图片节点）
- film.shot_to_video_prompt：分镜 visual → 视频节点 draft.prompt；用户要写人物动作/图生视频动态时 args.useMotionTemplate=true（系统按知识库+模型补全，无需用户点技能）
- video.generate_for_beats：批量提交视频生成（需分镜图已出；出视频前通常先 shot_to_video_prompt 且 useMotionTemplate=true）
- video.retry_failed：仅重试失败视频
- film.workflow_check：流程/断链检查
- film.batch_set_video_params：批量视频参数
- film.create_standard_workflow：搭短剧标准拓扑
- compose.export_script：合成时间线并导出 mp4（args.autoRender 默认 true；仅填时间线则 false）
- agent.delegate_parallel：并行子 Agent（args.tasks 数组，每项含 toolId/label/args；最多 3 路并发）
- canvas.summarize：汇总工程制片状态（只读；无生成副作用；可选 args.beatIds）

## 规则
1. 用户纯问答、无生成意图时：steps 为空数组 []，在 reply 中回答。
2. 有生成意图时：steps 按依赖顺序排列，2～6 步为宜；label 用简短中文。
3. 指定镜号时 args.beatIds 为 1-based 整数数组，如 [1,2]。
4. 不要编造工具 id；不要包含 @ 画布节点。
5. 参考素材由系统注入，无需在计划中写路径。
6. 用户要求写/补全「人物动作」「图生视频动态」「video 提示词」或批量出视频前：使用 film.shot_to_video_prompt，并设 args.useMotionTemplate=true。
7. 用户仅聊天了解写法、无执行意图时：steps 为空，在 reply 中说明（可引用人物动作模板要点）。
8. 画布非线性：用户小目标（单镜出图/单段视频）优先用 patch_shot、image、video 等单点工具；勿默认 canvas.ensure_script，除非用户明确要从零搭短片或镜头表。
9. 【当前状态】若含「近期画布变化」或「对话指代默认镜」，规划须与之对齐；用户说「那镜/刚才」且无镜号时，用默认镜的 beatIds。
10. 若含「风格参考锚点」，用户说「按上面/同样风格」时优先用 storyboard.patch_shot 的 styleReferenceShot 或 styleReferenceSnippet，再按需 regenerateImage。
11. 若含「上一版脚本快照」，用户说「和上一版一样/恢复上一版」时优先用 patch_shot 写回上一版 visualPrompt/videoMotionPrompt。
12. 若含「运镜参考」或用户说「按上面运镜」，优先用 patch_shot 写 videoMotionPrompt，再按需 regenerateVideo。

## JSON 形状
{
  "reply": "可选，一句话，无则省略",
  "assumptions": ["可选假设"],
  "risks": ["可选风险"],
  "steps": [{ "toolId": "...", "label": "...", "args": {} }]
}"#;

pub async fn plan_director(
    http: &reqwest::Client,
    settings: &AppSettings,
    graph: &CanvasGraph,
    user_message: &str,
    situation_summary: &str,
    extra_params: &serde_json::Value,
) -> Result<String, String> {
    let cards = project_scope_asset_cards(graph);
    let user_body = format!(
        "## 当前状态\n{}\n\n## 用户指令\n{}\n\n请输出 JSON 计划。",
        situation_summary.trim(),
        user_message.trim()
    );
    let style = effective_reply_style(extra_params, user_message, false);
    let reply_hint = director_plan_reply_hint(style);
    let plan_prompt = format!(
        "{}\n\n## 侧栏展示\nplan 字段 reply 若填写：{}。",
        DIRECTOR_PLAN_PROMPT, reply_hint
    );
    let messages = build_hermes_messages(&plan_prompt, &cards, &user_body, &[], "");
    openai_chat_completion(http, settings, messages, extra_params).await
}

const ORB_SUGGEST_PROMPT: &str = r#"你是 CanvasFlow 灵体 H 的「主动建议」文案专家，熟悉 AI 短视频/短剧制片（分镜、出图、Seedance 图生视频、排障）。
根据【制片状态】与【规则建议草稿】，输出**仅含 JSON 对象**（不要 markdown 围栏外文字）。

## 原则
1. 无限画布非线性：用户可只做单镜/小目标；勿推销「必须先有脚本/必须出完全片视频」。
1b. 若【制片状态】含「近期画布变化」，须点明用户刚做了什么（改分镜/选镜/连线等），再给一步可执行建议。
2. message：中文 1～2 句、≤56 字，像资深制片搭档口语，点明**当前事实**与**可执行一步**。
3. actionLabel：按钮文案 ≤8 字。
4. actionPrompt：发给 Director 的自然语言指令，≤120 字，必须可执行；与草稿意图一致，可更具体（镜号/重试/单镜）。
5. 勿编造资产路径；参数类勿编造 Seedance 上限。

## JSON 形状
{
  "message": "...",
  "actionLabel": "...",
  "actionPrompt": "..."
}"#;

pub async fn suggest_orb(
    http: &reqwest::Client,
    settings: &AppSettings,
    situation_summary: &str,
    rule_draft_json: &str,
    extra_params: &serde_json::Value,
) -> Result<String, String> {
    let user_body = format!(
        "## 制片状态\n{}\n\n## 规则建议草稿（JSON，勿改 id/severity）\n{}\n\n请输出 JSON。",
        situation_summary.trim(),
        rule_draft_json.trim()
    );
    let mut extra = extra_params.clone();
    if let Some(obj) = extra.as_object_mut() {
        obj.entry("max_tokens".to_string())
            .or_insert(json!(280));
        obj.entry("temperature".to_string())
            .or_insert(json!(0.35));
    }
    let messages = build_hermes_messages(ORB_SUGGEST_PROMPT, &[], &user_body, &[], "");
    openai_chat_completion(http, settings, messages, &extra).await
}

/// 将用户粘贴的原始技巧整理为结构化 JSON（由前端写入工程知识库）。
const USER_KNOWLEDGE_FORMAT_PROMPT: &str = r##"你是 Hermes 知识库编辑。用户会把网上或实测得到的「提示词/流程技巧」粘贴给你，请你整理成可入库的 Markdown 知识条目。

## 输出要求
- **只输出一个 JSON 对象**，不要 markdown 代码围栏外的文字。
- category 只能是：creative（写法/分镜/配音/表演）、troubleshoot（排障）、models（模型参数/Seedance/TTS/出图）。
- docId：英文 kebab-case，必须以 user- 开头，如 user-tts-sad-delivery。
- tags：3～8 个检索关键词（中英文均可）。
- bodyMarkdown：正文，用二级标题分节，建议含「反例」「正例或模板」「适用场景」「注意」；不要编造用户没说的 API 参数数值。

## JSON 形状
{
  "title": "条目标题",
  "docId": "user-xxx",
  "category": "creative",
  "tags": ["TTS", "配音"],
  "bodyMarkdown": "正文 Markdown（含反例与正例小节）"
}"##;

pub async fn format_user_knowledge_tip(
    http: &reqwest::Client,
    settings: &AppSettings,
    raw_tip: &str,
    extra_params: &serde_json::Value,
) -> Result<String, String> {
    let raw = raw_tip.trim();
    if raw.is_empty() {
        return Err("技巧内容不能为空".into());
    }
    let user_body = format!(
        "## 用户原始内容\n{}\n\n请整理为知识库 JSON。",
        raw
    );
    let messages = build_hermes_messages(USER_KNOWLEDGE_FORMAT_PROMPT, &[], &user_body, &[], "");
    openai_chat_completion(http, settings, messages, extra_params).await
}
