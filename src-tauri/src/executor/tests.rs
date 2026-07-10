use super::graph_flow::{incoming_texts_ordered, node_by_id, script_beat_params_patch_if_changed};
use super::script_parse::{normalize_script_beats, ScriptBeatOut};
use super::{run_graph, run_subgraph};
use crate::db;
use crate::graph::{CanvasGraph, FlowEdge, FlowNode};
use crate::settings::AppSettings;
use serde_json::{json, Value};
use std::collections::HashMap;
use tempfile::tempdir;

fn test_graph_chain() -> CanvasGraph {
    CanvasGraph {
        nodes: vec![
            FlowNode {
                id: "a".into(),
                node_type: "textNode".into(),
                data: json!({ "prompt": "A" }),
            },
            FlowNode {
                id: "b".into(),
                node_type: "textNode".into(),
                data: json!({ "prompt": "B" }),
            },
            FlowNode {
                id: "c".into(),
                node_type: "imageNode".into(),
                data: json!({ "path": "assets/c.png" }),
            },
        ],
        edges: vec![
            FlowEdge {
                id: "e1".into(),
                source: "a".into(),
                target: "b".into(),
                source_handle: None,
                target_handle: None,
            },
            FlowEdge {
                id: "e2".into(),
                source: "b".into(),
                target: "c".into(),
                source_handle: None,
                target_handle: None,
            },
        ],
    }
}

fn node_state_of(events: &[db::RunEventRow], node_id: &str) -> Vec<String> {
    events
        .iter()
        .filter(|e| e.kind == "node_state" && e.node_id.as_deref() == Some(node_id))
        .filter_map(|e| serde_json::from_str::<Value>(&e.payload_json).ok())
        .filter_map(|v| v.get("state").and_then(|s| s.as_str()).map(|s| s.to_string()))
        .collect()
}

fn node_output_of(events: &[db::RunEventRow], node_id: &str) -> Option<String> {
    events
        .iter()
        .find(|e| e.kind == "node_output" && e.node_id.as_deref() == Some(node_id))
        .and_then(|e| serde_json::from_str::<Value>(&e.payload_json).ok())
        .and_then(|v| v.get("output").and_then(|x| x.as_str()).map(|s| s.to_string()))
}

fn node_skip_reason_of(events: &[db::RunEventRow], node_id: &str) -> Vec<String> {
    events
        .iter()
        .filter(|e| e.kind == "node_state" && e.node_id.as_deref() == Some(node_id))
        .filter_map(|e| serde_json::from_str::<Value>(&e.payload_json).ok())
        .filter_map(|v| {
            let st = v.get("state").and_then(|s| s.as_str()).unwrap_or("");
            if st == "skipped" {
                v.get("reason").and_then(|r| r.as_str()).map(|s| s.to_string())
            } else {
                None
            }
        })
        .collect()
}

#[tokio::test]
async fn failed_node_skips_downstream_when_abort_disabled() {
    let dir = tempdir().expect("tempdir");
    let graph = test_graph_chain();
    let mut settings = AppSettings::default();
    settings.providers = vec![];
    settings.abort_workflow_on_failure = false;
    let http = reqwest::Client::new();

    let run_id = run_graph(&http, dir.path(), &graph, &settings)
        .await
        .expect("run should complete with downstream skipped");

    let conn = db::open_run_db(dir.path()).expect("open db");
    let runs = db::list_runs(&conn, 1).expect("list runs");
    assert_eq!(runs[0].id, run_id);
    assert_eq!(runs[0].status, "done");

    let events = db::list_run_events(&conn, &run_id).expect("events");
    let a_states = node_state_of(&events, "a");
    let b_states = node_state_of(&events, "b");
    let c_states = node_state_of(&events, "c");
    assert_eq!(a_states, vec!["running".to_string(), "failed".to_string()]);
    assert_eq!(b_states, vec!["skipped".to_string()]);
    assert_eq!(c_states, vec!["skipped".to_string()]);

    let summary = events
        .iter()
        .find(|e| e.kind == "run_summary")
        .expect("run_summary exists");
    let payload: Value = serde_json::from_str(&summary.payload_json).expect("summary json");
    assert_eq!(payload.get("anyNodeFailed").and_then(|v| v.as_bool()), Some(true));
    assert_eq!(
        payload.get("abortWorkflowOnFailure").and_then(|v| v.as_bool()),
        Some(false)
    );
}

#[tokio::test]
async fn failed_node_aborts_run_when_abort_enabled() {
    let dir = tempdir().expect("tempdir");
    let graph = test_graph_chain();
    let mut settings = AppSettings::default();
    settings.providers = vec![];
    settings.abort_workflow_on_failure = true;
    let http = reqwest::Client::new();

    let err = run_graph(&http, dir.path(), &graph, &settings)
        .await
        .expect_err("run should fail fast when abort enabled");
    assert!(!err.is_empty());

    let conn = db::open_run_db(dir.path()).expect("open db");
    let runs = db::list_runs(&conn, 1).expect("list runs");
    assert_eq!(runs[0].status, "failed");

    let run_id = runs[0].id.clone();
    let events = db::list_run_events(&conn, &run_id).expect("events");
    let a_states = node_state_of(&events, "a");
    let b_states = node_state_of(&events, "b");
    let c_states = node_state_of(&events, "c");
    assert_eq!(a_states, vec!["running".to_string(), "failed".to_string()]);
    assert!(b_states.is_empty());
    assert!(c_states.is_empty());
}

#[tokio::test]
async fn run_graph_emits_node_output_for_asset_nodes() {
    let dir = tempdir().expect("tempdir");
    std::fs::create_dir_all(dir.path().join("assets")).expect("assets dir");
    std::fs::write(dir.path().join("assets/demo.png"), b"x").expect("write");
    let conn = db::open_run_db(dir.path()).expect("db");
    let aid = db::upsert_asset(&conn, "assets/demo.png", "image", None, None).expect("upsert");

    let graph = CanvasGraph {
        nodes: vec![FlowNode {
            id: "img".into(),
            node_type: "imageNode".into(),
            data: json!({ "path": "assets/demo.png", "assetId": aid }),
        }],
        edges: vec![],
    };
    let mut settings = AppSettings::default();
    settings.providers = vec![];
    let http = reqwest::Client::new();
    let run_id = run_graph(&http, dir.path(), &graph, &settings)
        .await
        .expect("asset-only graph should succeed");

    let conn = db::open_run_db(dir.path()).expect("open db");
    let events = db::list_run_events(&conn, &run_id).expect("events");
    assert_eq!(node_output_of(&events, "img"), Some("assets/demo.png".to_string()));
}

#[tokio::test]
async fn subgraph_skips_already_succeeded_nodes_by_default() {
    let dir = tempdir().expect("tempdir");
    let graph = CanvasGraph {
        nodes: vec![
            FlowNode {
                id: "a".into(),
                node_type: "imageNode".into(),
                data: json!({ "path": "assets/a.png" }),
            },
            FlowNode {
                id: "b".into(),
                node_type: "imageNode".into(),
                data: json!({ "path": "assets/b.png" }),
            },
        ],
        edges: vec![FlowEdge {
            id: "e1".into(),
            source: "a".into(),
            target: "b".into(),
            source_handle: None,
            target_handle: None,
        }],
    };
    let mut settings = AppSettings::default();
    settings.providers = vec![];
    let http = reqwest::Client::new();
    let first_run = run_graph(&http, dir.path(), &graph, &settings)
        .await
        .expect("first run");

    let second_run = run_subgraph(
        &http,
        dir.path(),
        &graph,
        &settings,
        "a",
        Some(&first_run),
        false,
        None,
    )
    .await
    .expect("second subgraph run");

    let conn = db::open_run_db(dir.path()).expect("open db");
    let events = db::list_run_events(&conn, &second_run).expect("events");
    assert_eq!(
        node_skip_reason_of(&events, "a"),
        vec!["already_succeeded".to_string()]
    );
    assert_eq!(
        node_skip_reason_of(&events, "b"),
        vec!["already_succeeded".to_string()]
    );
}

#[test]
fn incoming_texts_ordered_follows_upstream_topology() {
    let g = CanvasGraph {
        nodes: vec![
            FlowNode {
                id: "late".into(),
                node_type: "textNode".into(),
                data: json!({}),
            },
            FlowNode {
                id: "early".into(),
                node_type: "textNode".into(),
                data: json!({}),
            },
            FlowNode {
                id: "sink".into(),
                node_type: "scriptNode".into(),
                data: json!({}),
            },
        ],
        edges: vec![
            FlowEdge {
                id: "e1".into(),
                source: "late".into(),
                target: "early".into(),
                source_handle: None,
                target_handle: None,
            },
            FlowEdge {
                id: "e2".into(),
                source: "early".into(),
                target: "sink".into(),
                source_handle: None,
                target_handle: None,
            },
            FlowEdge {
                id: "e3".into(),
                source: "late".into(),
                target: "sink".into(),
                source_handle: None,
                target_handle: None,
            },
        ],
    };
    let mut outputs = HashMap::new();
    outputs.insert("early".into(), "E".into());
    outputs.insert("late".into(), "L".into());
    let merged = incoming_texts_ordered(&g, "sink", &outputs);
    assert_eq!(merged, vec!["L".to_string(), "E".to_string()]);
}

#[test]
fn normalize_script_beats_accumulates_timeline() {
    let v: Vec<ScriptBeatOut> = serde_json::from_str(
        r#"[{"serialNumber":1,"duration":2.0,"shotDesc":"a"},{"serialNumber":2,"duration":1.5,"shotDesc":"b"}]"#,
    )
    .expect("parse fixture");
    let beats = normalize_script_beats(v);
    assert_eq!(beats.len(), 2);
    let b0 = beats[0].as_object().expect("obj");
    let b1 = beats[1].as_object().expect("obj");
    assert_eq!(b0.get("timeIn").and_then(|x| x.as_f64()), Some(0.0));
    assert_eq!(b0.get("timeOut").and_then(|x| x.as_f64()), Some(2.0));
    assert_eq!(b1.get("timeIn").and_then(|x| x.as_f64()), Some(2.0));
    assert_eq!(b1.get("timeOut").and_then(|x| x.as_f64()), Some(3.5));
    assert_eq!(b0.get("id"), b0.get("shotId"));
}

#[test]
fn script_beat_params_patch_uses_selection_when_params_empty() {
    let graph = CanvasGraph {
        nodes: vec![
            FlowNode {
                id: "s".into(),
                node_type: "scriptNode".into(),
                data: json!({
                    "scriptBeats": [
                        {"id": "beat-a", "shotNumber": "1"},
                        {"id": "beat-b", "shotNumber": "2"},
                    ],
                    "scriptBeatSelection": ["beat-b"],
                }),
            },
            FlowNode {
                id: "img".into(),
                node_type: "imageNode".into(),
                data: json!({ "path": "x.png", "params": {} }),
            },
        ],
        edges: vec![FlowEdge {
            id: "e".into(),
            source: "s".into(),
            target: "img".into(),
            source_handle: None,
            target_handle: None,
        }],
    };
    let img = node_by_id(&graph, "img").expect("img");
    let patch = script_beat_params_patch_if_changed(&graph, img).expect("patch");
    let params = patch.get("params").expect("params");
    assert_eq!(params.get("scriptBeatId").and_then(|v| v.as_str()), Some("beat-b"));
    assert_eq!(params.get("shotNumber").and_then(|v| v.as_str()), Some("2"));
}

#[test]
fn script_beat_params_patch_keeps_valid_existing_id() {
    let graph = CanvasGraph {
        nodes: vec![
            FlowNode {
                id: "s".into(),
                node_type: "scriptNode".into(),
                data: json!({
                    "scriptBeats": [
                        {"id": "beat-a", "shotNumber": "1"},
                        {"id": "beat-b", "shotNumber": "2"},
                    ],
                    "scriptBeatSelection": ["beat-b"],
                }),
            },
            FlowNode {
                id: "img".into(),
                node_type: "imageNode".into(),
                data: json!({
                    "path": "x.png",
                    "params": { "scriptBeatId": "beat-a", "shotNumber": "1" },
                }),
            },
        ],
        edges: vec![FlowEdge {
            id: "e".into(),
            source: "s".into(),
            target: "img".into(),
            source_handle: None,
            target_handle: None,
        }],
    };
    let img = node_by_id(&graph, "img").expect("img");
    assert!(script_beat_params_patch_if_changed(&graph, img).is_none());
}

#[test]
fn script_beat_params_patch_applies_to_video_node() {
    let graph = CanvasGraph {
        nodes: vec![
            FlowNode {
                id: "s".into(),
                node_type: "scriptNode".into(),
                data: json!({
                    "scriptBeats": [
                        {"id": "a1", "shotNumber": "1"},
                        {"id": "b2", "shotNumber": "2"},
                    ],
                    "scriptBeatSelection": ["b2"],
                }),
            },
            FlowNode {
                id: "vid".into(),
                node_type: "videoNode".into(),
                data: json!({ "path": "", "params": {} }),
            },
        ],
        edges: vec![FlowEdge {
            id: "e".into(),
            source: "s".into(),
            target: "vid".into(),
            source_handle: None,
            target_handle: None,
        }],
    };
    let vid = node_by_id(&graph, "vid").expect("vid");
    let patch = script_beat_params_patch_if_changed(&graph, vid).expect("patch");
    let params = patch.get("params").expect("params");
    assert_eq!(params.get("scriptBeatId").and_then(|v| v.as_str()), Some("b2"));
    assert_eq!(params.get("shotNumber").and_then(|v| v.as_str()), Some("2"));
}
