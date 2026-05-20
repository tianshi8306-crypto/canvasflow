//! 即梦 CLI 登录与状态管理（参考《即梦 CLI 体验指南》与 AI CanvasPro dreamina_cli_service）

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

const LOGIN_SUCCESS_MARKER: &str = "[DREAMINA:LOGIN_SUCCESS]";
const LOGIN_REUSED_MARKER: &str = "[DREAMINA:LOGIN_REUSED]";
const QR_READY_MARKER: &str = "[DREAMINA:QR_READY]";
const LOGIN_PAGE_URL: &str = "https://jimeng.jianying.com/";
const WINDOWS_BINARY_URL: &str =
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/psj_hupthlyk/ljhwZthlaukjlkulzlp/dreamina_cli_beta/dreamina_cli_windows_amd64.exe";
#[allow(dead_code)]
const DEFAULT_LOGIN_TIMEOUT_SEC: u64 = 90;
const OUTPUT_TAIL_LIMIT: usize = 80;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DreaminaLoginRuntime {
    pub active: bool,
    pub phase: String,
    pub message: String,
    pub error: String,
    pub started_at: i64,
    pub completed_at: i64,
    pub exit_code: Option<i32>,
    pub qr_available: bool,
    pub qr_version: i32,
    pub qr_updated_at: i64,
    pub verification_url: String,
    pub user_code: String,
    pub login_mode: String,
    pub login_page_url: String,
    pub authorize_url: String,
    pub callback_url: String,
    pub manual_login_available: bool,
    pub output_tail: Vec<String>,
    #[serde(skip)]
    pub qr_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DreaminaCliStatus {
    pub installed: bool,
    pub login_mode: String,
    pub logged_in: bool,
    pub credit: Option<Value>,
    pub message: String,
    pub runtime: DreaminaLoginRuntime,
}

struct CreditCache {
    checked_at: Instant,
    logged_in: bool,
    credit: Option<Value>,
    message: String,
}

struct Inner {
    runtime: DreaminaLoginRuntime,
    credit_cache: Option<CreditCache>,
    active_login: Option<Child>,
}

pub struct DreaminaCliState {
    inner: Arc<Mutex<Inner>>,
    http: reqwest::Client,
}

impl DreaminaCliState {
    pub fn new(http: reqwest::Client) -> Self {
        Self {
            inner: Arc::new(Mutex::new(Inner {
                runtime: default_runtime(),
                credit_cache: None,
                active_login: None,
            })),
            http,
        }
    }

    pub fn get_login_runtime(&self) -> DreaminaLoginRuntime {
        let inner = self.inner.lock().expect("dreamina lock");
        runtime_snapshot(&inner.runtime)
    }

    pub fn get_status(&self, force_refresh: bool) -> Result<DreaminaCliStatus, String> {
        let command_path = resolve_command_path();
        let installed = command_path.is_some();

        let (runtime_snapshot, cache_logged_in, cache_credit, cache_message) = {
            let inner = self.inner.lock().expect("dreamina lock");
            let snap = runtime_snapshot(&inner.runtime);
            let cache = inner.credit_cache.as_ref();
            (
                snap,
                cache.map(|c| c.logged_in),
                cache.and_then(|c| c.credit.clone()),
                cache.map(|c| c.message.clone()),
            )
        };

        let mut status = DreaminaCliStatus {
            installed,
            login_mode: "headless".to_string(),
            logged_in: false,
            credit: None,
            message: "首次登录时会自动准备即梦组件".to_string(),
            runtime: runtime_snapshot,
        };

        if status.runtime.active {
            status.logged_in = cache_logged_in.unwrap_or(false);
            status.credit = cache_credit;
            if let Some(msg) = cache_message {
                status.message = msg;
            }
            return Ok(status);
        }

        if !installed {
            return Ok(status);
        }

        if !force_refresh {
            if let Some(cache) = self.inner.lock().expect("dreamina lock").credit_cache.as_ref() {
                if cache.checked_at.elapsed() < Duration::from_secs(8) {
                    status.logged_in = cache.logged_in;
                    status.credit = cache.credit.clone();
                    status.message = cache.message.clone();
                    return Ok(status);
                }
            }
        }

        let path = command_path.unwrap();
        let result = run_command(&path, &["user_credit"], 30)?;
        let (logged_in, credit, message) = parse_user_credit_result(&result);

        {
            let mut inner = self.inner.lock().expect("dreamina lock");
            inner.credit_cache = Some(CreditCache {
                checked_at: Instant::now(),
                logged_in,
                credit: credit.clone(),
                message: message.clone(),
            });
        }

        status.logged_in = logged_in;
        status.credit = credit;
        status.message = message;
        Ok(status)
    }

    pub fn start_login(&self, mode: &str, force: bool) -> Result<DreaminaLoginRuntime, String> {
        let login_mode = normalize_login_mode(mode)?;
        let is_web = login_mode == "web";

        {
            let inner = self.inner.lock().expect("dreamina lock");
            if inner.runtime.active {
                return Ok(runtime_snapshot(&inner.runtime));
            }
        }

        {
            let mut inner = self.inner.lock().expect("dreamina lock");
            inner.credit_cache = None;
            inner.runtime = default_runtime();
            inner.runtime.active = true;
            inner.runtime.phase = "preparing".into();
            inner.runtime.message = if is_web {
                "正在准备即梦网页登录...".into()
            } else {
                "正在准备即梦扫码登录...".into()
            };
            inner.runtime.login_mode = login_mode.clone();
            inner.runtime.login_page_url = LOGIN_PAGE_URL.into();
        }

        let state = self.clone_refs();
        thread::spawn(move || state.run_login_sequence(force, &login_mode));

        Ok(self.get_login_runtime())
    }

    pub fn logout(&self) -> Result<DreaminaCliStatus, String> {
        {
            let inner = self.inner.lock().expect("dreamina lock");
            if inner.runtime.active {
                return Err("请先完成当前登录流程，再退出登录".into());
            }
        }

        if let Some(path) = resolve_command_path() {
            let result = run_command(&path, &["logout"], 20)?;
            if !result.ok {
                let output = result.output.trim();
                if !output.is_empty() && !output.contains("未检测到有效登录态") {
                    return Err(
                        extract_error_from_tail(&output)
                            .unwrap_or_else(|| "退出登录失败，请重试".into()),
                    );
                }
            }
        }

        {
            let mut inner = self.inner.lock().expect("dreamina lock");
            inner.credit_cache = Some(CreditCache {
                checked_at: Instant::now(),
                logged_in: false,
                credit: None,
                message: "已退出登录".into(),
            });
            inner.runtime = default_runtime();
            inner.runtime.phase = "done".into();
            inner.runtime.message = "已退出登录".into();
        }

        self.get_status(false)
    }

    pub fn get_qr_base64(&self) -> Option<String> {
        let path = {
            let inner = self.inner.lock().expect("dreamina lock");
            inner.runtime.qr_path.clone()
        };
        if path.is_empty() {
            return None;
        }
        let bytes = std::fs::read(&path).ok()?;
        Some(base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            bytes,
        ))
    }

    pub fn open_authorize_url(&self, _app: &tauri::AppHandle) -> Result<(), String> {
        let url = {
            let inner = self.inner.lock().expect("dreamina lock");
            let url = inner.runtime.authorize_url.trim();
            if !url.is_empty() {
                url.to_string()
            } else if !inner.runtime.verification_url.trim().is_empty() {
                inner.runtime.verification_url.clone()
            } else {
                LOGIN_PAGE_URL.to_string()
            }
        };
        tauri_plugin_opener::open_url(url, None::<&str>).map_err(|e| e.to_string())
    }

    fn clone_refs(&self) -> DreaminaWorker {
        DreaminaWorker {
            inner: Arc::clone(&self.inner),
            http: self.http.clone(),
        }
    }
}

struct DreaminaWorker {
    inner: Arc<Mutex<Inner>>,
    http: reqwest::Client,
}

impl DreaminaWorker {
    fn run_login_sequence(&self, force: bool, login_mode: &str) {
        let is_web = login_mode == "web";
        let http = self.http.clone();
        let result = (|| -> Result<(), String> {
            let _ = cleanup_stale_login_processes();

            let command_path = match resolve_command_path() {
                Some(p) => p,
                None => {
                    self.set_phase_message("preparing", "首次使用正在准备即梦组件...");
                    block_on_async(ensure_managed_cli_async(&http))?
                }
            };

            {
                let mut inner = self.inner.lock().expect("dreamina lock");
                inner.runtime.phase = "starting".into();
                inner.runtime.message = if is_web {
                    "正在启动即梦网页登录，请在浏览器完成授权...".into()
                } else {
                    "正在启动即梦扫码登录...".into()
                };
            }

            let mut args = vec![
                if force { "relogin" } else { "login" }.to_string(),
            ];
            if !is_web {
                args.push("--headless".into());
            }

            let mut cmd = Command::new(&command_path);
            cmd.args(&args)
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .current_dir(dreamina_user_dir()?);

            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                cmd.creation_flags(CREATE_NO_WINDOW);
            }

            let mut child = cmd.spawn().map_err(|e| format!("启动即梦登录失败：{e}"))?;

            let stdout = child
                .stdout
                .take()
                .ok_or_else(|| "无法读取即梦登录输出".to_string())?;

            {
                let mut inner = self.inner.lock().expect("dreamina lock");
                inner.active_login = Some(child);
            }

            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                let line = match line {
                    Ok(l) => l,
                    Err(_) => break,
                };
                self.handle_login_line(&line);
            }

            let exit_code = {
                let mut inner = self.inner.lock().expect("dreamina lock");
                if let Some(mut child) = inner.active_login.take() {
                    child.wait().ok().map(|s| s.code().unwrap_or(-1))
                } else {
                    None
                }
            };

            self.finalize_login(exit_code);
            Ok(())
        })();

        if let Err(err) = result {
            self.set_failure(&err);
        }
    }

    fn handle_login_line(&self, raw_line: &str) {
        let line = raw_line.trim_end_matches(['\r', '\n']).to_string();
        if line.is_empty() {
            return;
        }

        let mut inner = self.inner.lock().expect("dreamina lock");
        append_output_tail(&mut inner.runtime, &line);

        if line.contains(QR_READY_MARKER) {
            let qr_path = line
                .split(QR_READY_MARKER)
                .nth(1)
                .unwrap_or("")
                .trim()
                .to_string();
            if !qr_path.is_empty() {
                inner.runtime.phase = "qr_ready".into();
                inner.runtime.qr_path = qr_path.clone();
                inner.runtime.qr_version += 1;
                inner.runtime.qr_updated_at = now_ms();
                inner.runtime.message =
                    "请使用抖音 App 扫码，并在手机上确认即梦授权".into();
                inner.runtime.error.clear();
            }
        } else if line.contains(LOGIN_SUCCESS_MARKER) {
            mark_login_success(&mut inner.runtime, false);
        } else if line.contains(LOGIN_REUSED_MARKER) {
            mark_login_success(&mut inner.runtime, true);
        } else if let Some(rest) = line.strip_prefix("verification_uri:") {
            let url = normalize_url_candidate(rest);
            if !url.is_empty() {
                inner.runtime.phase = "qr_ready".into();
                inner.runtime.verification_url = url.clone();
                inner.runtime.authorize_url = url;
                inner.runtime.manual_login_available = true;
                inner.runtime.message = "请在浏览器中打开即梦登录链接完成授权".into();
                inner.runtime.error.clear();
            }
        } else if let Some(code) = line.strip_prefix("user_code:") {
            let code = code.trim().to_string();
            inner.runtime.user_code = code.clone();
            inner.runtime.phase = "qr_ready".into();
            inner.runtime.message = format!("请在浏览器中完成即梦授权，验证码：{code}");
            inner.runtime.error.clear();
        } else if inner.runtime.phase == "preparing" || inner.runtime.phase == "starting" {
            inner.runtime.phase = "starting".into();
            inner.runtime.message = if inner.runtime.login_mode == "web" {
                "即梦网页登录已启动，正在等待授权链接".into()
            } else {
                "即梦登录已启动，正在等待二维码".into()
            };
        }

        sync_manual_login_links(&mut inner.runtime);
    }

    fn finalize_login(&self, exit_code: Option<i32>) {
        let mut inner = self.inner.lock().expect("dreamina lock");
        inner.runtime.active = false;
        inner.runtime.completed_at = now_ms();
        inner.runtime.exit_code = exit_code;

        let phase = inner.runtime.phase.clone();
        if phase == "success" || phase == "reused" {
            inner.credit_cache = None;
            return;
        }
        if exit_code == Some(0) {
            if phase != "failed" {
                inner.runtime.phase = "done".into();
                if inner.runtime.message.is_empty() {
                    inner.runtime.message = "即梦登录流程已完成".into();
                }
            }
            return;
        }
        inner.runtime.phase = "failed".into();
        if inner.runtime.error.is_empty() {
            inner.runtime.error = extract_error_from_tail(
                &inner.runtime.output_tail.join("\n"),
            )
            .unwrap_or_else(|| "即梦登录失败，请重试".into());
        }
        inner.runtime.message = inner.runtime.error.clone();
    }

    fn set_phase_message(&self, phase: &str, message: &str) {
        let mut inner = self.inner.lock().expect("dreamina lock");
        inner.runtime.phase = phase.into();
        inner.runtime.message = message.into();
    }

    fn set_failure(&self, message: &str) {
        let mut inner = self.inner.lock().expect("dreamina lock");
        inner.runtime.active = false;
        inner.runtime.phase = "failed".into();
        let normalized = normalize_runtime_message(message);
        inner.runtime.error = normalized.clone();
        inner.runtime.message = normalized;
        inner.runtime.completed_at = now_ms();
        if let Some(mut child) = inner.active_login.take() {
            let _ = child.kill();
        }
    }
}

fn default_runtime() -> DreaminaLoginRuntime {
    DreaminaLoginRuntime {
        login_page_url: LOGIN_PAGE_URL.into(),
        ..Default::default()
    }
}

fn runtime_snapshot(runtime: &DreaminaLoginRuntime) -> DreaminaLoginRuntime {
    let qr_available = !runtime.qr_path.is_empty() && Path::new(&runtime.qr_path).is_file();
    DreaminaLoginRuntime {
        active: runtime.active,
        phase: runtime.phase.clone(),
        message: runtime.message.clone(),
        error: runtime.error.clone(),
        started_at: runtime.started_at,
        completed_at: runtime.completed_at,
        exit_code: runtime.exit_code,
        qr_available,
        qr_version: runtime.qr_version,
        qr_updated_at: runtime.qr_updated_at,
        verification_url: runtime.verification_url.clone(),
        user_code: runtime.user_code.clone(),
        login_mode: runtime.login_mode.clone(),
        login_page_url: runtime.login_page_url.clone(),
        authorize_url: runtime.authorize_url.clone(),
        callback_url: runtime.callback_url.clone(),
        manual_login_available: runtime.manual_login_available,
        output_tail: runtime.output_tail.clone(),
        qr_path: String::new(),
    }
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn canvasflow_data_dir() -> Result<PathBuf, String> {
    #[cfg(windows)]
    {
        let base = std::env::var("APPDATA")
            .map(PathBuf::from)
            .map_err(|_| "无法读取 APPDATA".to_string())?;
        let dir = base.join("canvasflow");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        return Ok(dir);
    }
    #[cfg(not(windows))]
    {
        let home = std::env::var("HOME")
            .map(PathBuf::from)
            .map_err(|_| "无法读取 HOME".to_string())?;
        let dir = home.join(".config").join("canvasflow");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        Ok(dir)
    }
}

fn dreamina_user_dir() -> Result<PathBuf, String> {
    let dir = canvasflow_data_dir()?.join("dreamina");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn managed_command_path() -> PathBuf {
    canvasflow_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("tools")
        .join("dreamina")
        .join(if cfg!(windows) {
            "dreamina.exe"
        } else {
            "dreamina"
        })
}

fn resolve_command_path() -> Option<String> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    candidates.push(managed_command_path());
    if let Some(home) = dirs_home() {
        candidates.push(home.join("bin").join(if cfg!(windows) { "dreamina.exe" } else { "dreamina" }));
    }
    for name in ["dreamina", "dreamina.exe"] {
        if let Some(p) = find_in_path(name) {
            candidates.push(p);
        }
    }

    for candidate in candidates {
        if candidate.is_file() {
            return Some(candidate.to_string_lossy().into_owned());
        }
    }
    None
}

fn find_in_path(name: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path_var) {
        let candidate = dir.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn dirs_home() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var("USERPROFILE").ok().map(PathBuf::from)
    }
    #[cfg(not(windows))]
    {
        std::env::var("HOME").ok().map(PathBuf::from)
    }
}

pub(crate) struct DreaminaCommandResult {
    pub ok: bool,
    pub output: String,
}

/// 解析并确保即梦 CLI 可执行文件存在（必要时下载）。
pub fn ensure_command_path(http: &reqwest::Client) -> Result<String, String> {
    if let Some(path) = resolve_command_path() {
        let probe = run_command(&path, &["version"], 15)?;
        if probe.ok {
            return Ok(path);
        }
    }
    block_on_async(ensure_managed_cli_async(http))
}

/// 执行即梦 CLI 子命令。
pub fn run_dreamina_command(
    path: &str,
    args: &[&str],
    timeout_sec: u64,
) -> Result<DreaminaCommandResult, String> {
    let r = run_command(path, args, timeout_sec)?;
    Ok(DreaminaCommandResult {
        ok: r.ok,
        output: r.output,
    })
}

struct CommandResult {
    ok: bool,
    output: String,
}

fn run_command(path: &str, args: &[&str], timeout_sec: u64) -> Result<CommandResult, String> {
    let mut cmd = Command::new(path);
    cmd.args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Ok(cwd) = dreamina_user_dir() {
        cmd.current_dir(cwd);
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let started = Instant::now();
    loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            let mut output = String::new();
            if let Some(mut stdout) = child.stdout.take() {
                use std::io::Read;
                let _ = stdout.read_to_string(&mut output);
            }
            if let Some(mut stderr) = child.stderr.take() {
                use std::io::Read;
                let mut err = String::new();
                let _ = stderr.read_to_string(&mut err);
                output.push_str(&err);
            }
            return Ok(CommandResult {
                ok: status.success(),
                output,
            });
        }
        if started.elapsed() > Duration::from_secs(timeout_sec.max(5)) {
            let _ = child.kill();
            return Ok(CommandResult {
                ok: false,
                output: "即梦组件执行超时".into(),
            });
        }
        thread::sleep(Duration::from_millis(80));
    }
}

fn block_on_async<F: std::future::Future>(future: F) -> F::Output {
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("dreamina tokio runtime")
        .block_on(future)
}

async fn ensure_managed_cli_async(http: &reqwest::Client) -> Result<String, String> {
    #[cfg(not(windows))]
    {
        return Err("当前版本仅支持在 Windows 自动下载即梦 CLI，请手动安装 dreamina 命令".into());
    }

    let target = managed_command_path();
    if target.is_file() {
        let probe = run_command(&target.to_string_lossy(), &["version"], 15)?;
        if probe.ok {
            return Ok(target.to_string_lossy().into_owned());
        }
    }

    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let bytes = http
        .get(WINDOWS_BINARY_URL)
        .send()
        .await
        .map_err(|e| format!("下载即梦组件失败：{e}"))?
        .error_for_status()
        .map_err(|e| format!("下载即梦组件失败：{e}"))?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    std::fs::write(&target, &bytes).map_err(|e| format!("写入即梦组件失败：{e}"))?;
    Ok(target.to_string_lossy().into_owned())
}

fn parse_user_credit_result(result: &CommandResult) -> (bool, Option<Value>, String) {
    if result.ok {
        let credit = serde_json::from_str::<Value>(result.output.trim()).ok();
        let logged_in = credit.as_ref().map(|v| v.is_object()).unwrap_or(false);
        let message = if logged_in {
            "即梦已登录".into()
        } else {
            "即梦状态暂不可用".into()
        };
        return (logged_in, credit, message);
    }

    let output = result.output.trim();
    if output.is_empty() || output.contains("未检测到有效登录态") {
        return (false, None, "未登录，点击登录即可使用".into());
    }
    (
        false,
        None,
        extract_error_from_tail(output).unwrap_or_else(|| "读取即梦状态失败".into()),
    )
}

fn normalize_login_mode(mode: &str) -> Result<String, String> {
    let m = mode.trim().to_lowercase();
    match m.as_str() {
        "web" | "headless" | "" => Ok(if m.is_empty() || m == "headless" {
            "headless".into()
        } else {
            "web".into()
        }),
        _ => Err("当前仅支持网页登录或扫码登录".into()),
    }
}

fn normalize_runtime_message(message: &str) -> String {
    let text = message.trim();
    if text.is_empty() {
        return "即梦登录失败，请重试".into();
    }
    let lower = text.to_lowercase();
    if lower.contains("bind:") || lower.contains("only one usage of each socket address") {
        return "检测到上次未完成的登录流程，已自动重置，请重新点击登录".into();
    }
    if text.contains("读取二维码响应失败") || lower.contains("empty response body") {
        return "即梦二维码获取失败，请重新点击登录".into();
    }
    if text.contains("等待登录超时") {
        return "扫码登录已超时，请重新点击登录".into();
    }
    text.to_string()
}

fn extract_error_from_tail(text: &str) -> Option<String> {
    for line in text.lines().rev() {
        let s = line.trim();
        if s.is_empty() || s.contains(QR_READY_MARKER) {
            continue;
        }
        return Some(s.to_string());
    }
    None
}

fn append_output_tail(runtime: &mut DreaminaLoginRuntime, line: &str) {
    runtime.output_tail.push(line.to_string());
    if runtime.output_tail.len() > OUTPUT_TAIL_LIMIT {
        let extra = runtime.output_tail.len() - OUTPUT_TAIL_LIMIT;
        runtime.output_tail.drain(0..extra);
    }
}

fn mark_login_success(runtime: &mut DreaminaLoginRuntime, reused: bool) {
    runtime.phase = if reused { "reused" } else { "success" }.into();
    runtime.message = if reused {
        "当前即梦登录态仍然有效"
    } else {
        "即梦已登录成功"
    }
    .into();
    runtime.error.clear();
}

fn normalize_url_candidate(raw: &str) -> String {
    let mut value = raw.trim().to_string();
    value = value.trim_start_matches(['<', '（', '(', '【', '[', '"', '\'']).to_string();
    value = value.trim_end_matches(['>', '）', ')', '】', ']', '"', '\'']).to_string();
    if value.starts_with("http://") || value.starts_with("https://") {
        value
    } else {
        String::new()
    }
}

fn sync_manual_login_links(runtime: &mut DreaminaLoginRuntime) {
    runtime.login_page_url = LOGIN_PAGE_URL.into();
    let mut urls: Vec<String> = Vec::new();
    for line in &runtime.output_tail {
        for m in line.split_whitespace() {
            let u = normalize_url_candidate(m);
            if !u.is_empty() && !urls.contains(&u) {
                urls.push(u);
            }
        }
    }
    let callback = urls
        .iter()
        .find(|u| u.contains("/dreamina/cli/v1/dreamina_cli_login"))
        .cloned()
        .unwrap_or_default();
    let authorize = if !runtime.verification_url.is_empty() {
        runtime.verification_url.clone()
    } else {
        urls.iter()
            .find(|u| u.contains("/passport/web_login") || u.contains("/passport/web/web_login"))
            .or(urls.iter().find(|u| **u != LOGIN_PAGE_URL))
            .cloned()
            .unwrap_or_default()
    };
    if !authorize.is_empty() {
        runtime.authorize_url = authorize;
    }
    runtime.callback_url = callback;
    runtime.manual_login_available = !runtime.authorize_url.is_empty()
        || !runtime.callback_url.is_empty()
        || !runtime.login_page_url.is_empty();
}

#[cfg(windows)]
fn cleanup_stale_login_processes() -> Result<(), String> {
    let output = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_Process -Filter \"Name = 'dreamina.exe'\" | \
             Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress",
        ])
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Ok(());
    }
    let raw = String::from_utf8_lossy(&output.stdout);
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(());
    }
    let value: Value = match serde_json::from_str(trimmed) {
        Ok(v) => v,
        Err(_) => return Ok(()),
    };
    let items: Vec<&Value> = match &value {
        Value::Array(arr) => arr.iter().collect(),
        Value::Object(_) => vec![&value],
        _ => return Ok(()),
    };
    for item in items {
        let cmd = item
            .get("CommandLine")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let normalized = cmd.replace('"', " ").to_lowercase();
        if !normalized.contains("--headless") {
            continue;
        }
        if !normalized.contains(" login ") && !normalized.contains(" relogin ") {
            continue;
        }
        if let Some(pid) = item.get("ProcessId").and_then(|v| v.as_u64()) {
            let _ = Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/T", "/F"])
                .output();
        }
    }
    thread::sleep(Duration::from_millis(400));
    Ok(())
}

#[cfg(not(windows))]
fn cleanup_stale_login_processes() -> Result<(), String> {
    Ok(())
}
