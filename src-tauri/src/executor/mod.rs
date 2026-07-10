//! 画布 DAG 执行：拓扑运行、脚本解析、LLM、FFmpeg 拼接等。

mod asset_resolve;
mod node_output;
mod engine;
mod ffmpeg;
mod graph_flow;
pub mod hermes_agent;
mod hermes_asset;
mod llm;
mod script_node;
mod script_parse;
mod script_parse_plan;
mod script_parse_requirement;
mod script_plan_agent;
mod script_draft_coherence;
mod script_character_arc;
mod script_dialogue_rewrite;
mod script_decision;
mod script_pipeline;
mod script_shot_agent;
mod shared;
mod types;

pub use engine::{run_graph, run_graph_with_patch, run_subgraph, run_subgraph_with_patch};
pub use llm::openai_chat_completion;
pub use types::{AssetCard, GraphRunResult, NodeDataPatch};

#[cfg(test)]
mod tests;
