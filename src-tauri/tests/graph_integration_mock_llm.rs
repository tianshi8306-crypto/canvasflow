//! Wiremock 模拟 OpenAI 兼容 `/v1/chat/completions`，串起「脚本解析 → 图片/视频节点 params 绑定」。
//! 依赖环境变量 `CANVASFLOW_TEST_API_KEY`（测试内自动设置与清理）。

use std::sync::Mutex;

use canvasflow_lib::executor::{self, GraphRunResult};
use canvasflow_lib::graph::{CanvasGraph, FlowEdge, FlowNode};
use canvasflow_lib::settings::{AppSettings, ProviderConfig};
use serde_json::json;
use tempfile::tempdir;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

struct ClearEnvVar(&'static str);
impl Drop for ClearEnvVar {
    fn drop(&mut self) {
        std::env::remove_var(self.0);
    }
}

/// 本文件内测试共享假 Key，并行跑会互相 `remove_var`，故串行化。
static INTEGRATION_SEQ: Mutex<()> = Mutex::new(());

#[tokio::test]
async fn mocked_openai_script_parse_then_image_params_binding() {
    let _seq = INTEGRATION_SEQ.lock().expect("integration test lock");
    let _clear_key = ClearEnvVar("CANVASFLOW_TEST_API_KEY");
    std::env::set_var("CANVASFLOW_TEST_API_KEY", "sk-integration-mock");

    let mock_server = MockServer::start().await;

    let beat_llm = json!([{
        "serialNumber": 1,
        "actNumber": 1,
        "duration": 2.0,
        "shotDesc": "开场",
        "roles": [],
        "shotType": "中景",
        "cameraMove": "固定",
        "lightAtmosphere": "",
        "soundEffect": "",
        "reference": "",
        "storyboardPrompt": "第二幕：[画面构图：x]+[主体内容：x]+[人物空间与互动关系：x]+[微表情：x]+[场景环境：x]+[光影：x]+[风格：x]+[技术：x]",
        "videoMotionPrompt": "[运镜：x]+[动作：x]+[互动：x]+[环境：x]+[时长：2.0秒]"
    }]);
    let openai_body = json!({
        "choices": [{
            "message": { "content": beat_llm.to_string() }
        }]
    });

    Mock::given(method("POST"))
        .and(path("/v1/chat/completions"))
        .respond_with(ResponseTemplate::new(200).set_body_json(openai_body))
        .expect(1..=4)
        .mount(&mock_server)
        .await;

    let base = mock_server.uri().trim_end_matches('/').to_string();
    let mut settings = AppSettings::default();
    settings.providers = vec![ProviderConfig {
        id: "openai-compatible-1".into(),
        label: "mock".into(),
        base_url: format!("{base}/v1"),
        model: "gpt-mock".into(),
        priority: 0,
        enabled: true,
    }];
    settings.default_provider_id = Some("openai-compatible-1".into());

    let graph = CanvasGraph {
        nodes: vec![
            FlowNode {
                id: "scr".into(),
                node_type: "scriptNode".into(),
                data: json!({
                    "prompt": "短片开场",
                    "scriptBeats": [
                        {"id": "alpha", "shotNumber": "10"},
                        {"id": "beta", "shotNumber": "20"},
                    ],
                    "scriptBeatSelection": ["beta"],
                }),
            },
            FlowNode {
                id: "img".into(),
                node_type: "imageNode".into(),
                data: json!({ "path": "", "params": {} }),
            },
        ],
        edges: vec![FlowEdge {
            id: "e0".into(),
            source: "scr".into(),
            target: "img".into(),
            source_handle: None,
            target_handle: None,
        }],
    };

    let dir = tempdir().expect("tempdir");
    let http = reqwest::Client::new();
    let GraphRunResult { node_patches, .. } = executor::run_graph_with_patch(&http, dir.path(), &graph, &settings)
        .await
        .expect("run_graph_with_patch should succeed");

    let img_patch = node_patches
        .iter()
        .find(|p| p.node_id == "img")
        .expect("image node should receive a params patch");
    assert_eq!(
        img_patch.data_patch["params"]["scriptBeatId"].as_str(),
        Some("beta")
    );
    assert_eq!(
        img_patch.data_patch["params"]["shotNumber"].as_str(),
        Some("20")
    );

    let scr_patch = node_patches
        .iter()
        .find(|p| p.node_id == "scr")
        .expect("script node patch");
    assert!(scr_patch.data_patch.get("scriptBeats").and_then(|v| v.as_array()).is_some());
}

#[tokio::test]
async fn mocked_openai_script_parse_then_video_params_binding() {
    let _seq = INTEGRATION_SEQ.lock().expect("integration test lock");
    let _clear_key = ClearEnvVar("CANVASFLOW_TEST_API_KEY");
    std::env::set_var("CANVASFLOW_TEST_API_KEY", "sk-integration-mock");

    let mock_server = MockServer::start().await;

    let beat_llm = json!([{
        "serialNumber": 1,
        "actNumber": 1,
        "duration": 2.0,
        "shotDesc": "开场",
        "roles": [],
        "shotType": "中景",
        "cameraMove": "固定",
        "lightAtmosphere": "",
        "soundEffect": "",
        "reference": "",
        "storyboardPrompt": "第二幕：[画面构图：x]+[主体内容：x]+[人物空间与互动关系：x]+[微表情：x]+[场景环境：x]+[光影：x]+[风格：x]+[技术：x]",
        "videoMotionPrompt": "[运镜：x]+[动作：x]+[互动：x]+[环境：x]+[时长：2.0秒]"
    }]);
    let openai_body = json!({
        "choices": [{
            "message": { "content": beat_llm.to_string() }
        }]
    });

    Mock::given(method("POST"))
        .and(path("/v1/chat/completions"))
        .respond_with(ResponseTemplate::new(200).set_body_json(openai_body))
        .expect(1..=4)
        .mount(&mock_server)
        .await;

    let base = mock_server.uri().trim_end_matches('/').to_string();
    let mut settings = AppSettings::default();
    settings.providers = vec![ProviderConfig {
        id: "openai-compatible-1".into(),
        label: "mock".into(),
        base_url: format!("{base}/v1"),
        model: "gpt-mock".into(),
        priority: 0,
        enabled: true,
    }];
    settings.default_provider_id = Some("openai-compatible-1".into());

    let graph = CanvasGraph {
        nodes: vec![
            FlowNode {
                id: "scr".into(),
                node_type: "scriptNode".into(),
                data: json!({
                    "prompt": "短片开场",
                    "scriptBeats": [
                        {"id": "alpha", "shotNumber": "10"},
                        {"id": "beta", "shotNumber": "20"},
                    ],
                    "scriptBeatSelection": ["beta"],
                }),
            },
            FlowNode {
                id: "vid".into(),
                node_type: "videoNode".into(),
                data: json!({ "path": "", "params": {} }),
            },
        ],
        edges: vec![FlowEdge {
            id: "e0".into(),
            source: "scr".into(),
            target: "vid".into(),
            source_handle: None,
            target_handle: None,
        }],
    };

    let dir = tempdir().expect("tempdir");
    let http = reqwest::Client::new();
    let GraphRunResult { node_patches, .. } = executor::run_graph_with_patch(&http, dir.path(), &graph, &settings)
        .await
        .expect("run_graph_with_patch should succeed");

    let vid_patch = node_patches
        .iter()
        .find(|p| p.node_id == "vid")
        .expect("video node should receive a params patch");
    assert_eq!(
        vid_patch.data_patch["params"]["scriptBeatId"].as_str(),
        Some("beta")
    );
    assert_eq!(
        vid_patch.data_patch["params"]["shotNumber"].as_str(),
        Some("20")
    );
}
