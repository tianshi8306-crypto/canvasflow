//! 画布 DAG 执行：拓扑运行、脚本解析、LLM、FFmpeg 拼接等。

mod engine;
mod ffmpeg;
mod graph_flow;
mod llm;
mod script_node;
mod script_parse;
mod types;

pub use engine::{run_graph, run_graph_with_patch, run_subgraph, run_subgraph_with_patch};
pub use llm::openai_chat_completion;
pub use types::{GraphRunResult, NodeDataPatch};

#[cfg(test)]
mod tests;
