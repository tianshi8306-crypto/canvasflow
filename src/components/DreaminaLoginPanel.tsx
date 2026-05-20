/**
 * 即梦登录面板：扫码 / 网页授权 / 状态轮询
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkDreaminaAuthState,
  fetchDreaminaQrBase64,
  fetchDreaminaLoginRuntime,
  isDreaminaLoginSucceeded,
  isDreaminaLoginTerminal,
  openDreaminaAuthorizeUrl,
  startDreaminaQrLogin,
  startDreaminaWebLogin,
  type DreaminaAuthState,
  type DreaminaLoginRuntime,
} from "@/lib/dreaminaAuth";

type Props = {
  auth: DreaminaAuthState | null;
  onAuthChange: (state: DreaminaAuthState) => void;
};

const POLL_MS = 1500;

export function DreaminaLoginPanel({ auth, onAuthChange }: Props) {
  const [runtime, setRuntime] = useState<DreaminaLoginRuntime | null>(auth?.runtime ?? null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastQrVersion = useRef(0);

  const refreshAuth = useCallback(
    async (refreshStatus = false) => {
      const state = await checkDreaminaAuthState(refreshStatus);
      onAuthChange(state);
      setRuntime(state.runtime);
      return state;
    },
    [onAuthChange],
  );

  const loadQrIfNeeded = useCallback(
    async (rt: DreaminaLoginRuntime) => {
      if (!rt.qrAvailable || rt.qrVersion <= 0) {
        setQrDataUrl(null);
        return;
      }
      if (rt.qrVersion === lastQrVersion.current && qrDataUrl) return;
      const b64 = await fetchDreaminaQrBase64();
      if (b64) {
        lastQrVersion.current = rt.qrVersion;
        setQrDataUrl(`data:image/png;base64,${b64}`);
      }
    },
    [qrDataUrl],
  );

  useEffect(() => {
    if (!runtime?.active && !busy) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const rt = await fetchDreaminaLoginRuntime();
        if (cancelled) return;
        setRuntime(rt);
        await loadQrIfNeeded(rt);

        if (!rt.active && isDreaminaLoginTerminal(rt)) {
          const state = await refreshAuth(true);
          if (cancelled) return;
          if (isDreaminaLoginSucceeded(rt)) {
            setError(null);
          } else if (rt.error) {
            setError(rt.error);
          } else if (!state.isLoggedIn) {
            setError(state.message || "登录未完成");
          }
          setBusy(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "轮询登录状态失败");
        }
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [runtime?.active, busy, loadQrIfNeeded, refreshAuth]);

  const handleQrLogin = useCallback(async () => {
    setBusy(true);
    setError(null);
    setQrDataUrl(null);
    lastQrVersion.current = 0;
    try {
      const rt = await startDreaminaQrLogin(false);
      setRuntime(rt);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "启动扫码登录失败");
      setBusy(false);
    }
  }, []);

  const handleWebLogin = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const rt = await startDreaminaWebLogin(false);
      setRuntime(rt);
      if (rt.manualLoginAvailable || rt.loginMode === "web") {
        await openDreaminaAuthorizeUrl();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "启动网页登录失败");
      setBusy(false);
    }
  }, []);

  const handleOpenBrowser = useCallback(async () => {
    try {
      await openDreaminaAuthorizeUrl();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "打开浏览器失败");
    }
  }, []);

  const showQr = Boolean(runtime?.qrAvailable && qrDataUrl);
  const loginMessage =
    runtime?.message || auth?.message || "点击「扫码登录」或「网页登录」授权即梦账号";

  return (
    <div className="settings-dreamina-section">
      <div className="settingsField">
        <label className="settingsFieldLabel">登录状态</label>
        <div className="dreamina-settings-status">
          <span className="dreamina-settings-status-text">{auth?.statusText ?? "检测中..."}</span>
          {auth?.isLoggedIn ? (
            <span className="dreamina-settings-credit">{auth.creditText}</span>
          ) : null}
        </div>
      </div>

      {(busy || runtime?.active) && (
        <div className="dreamina-login-progress">
          <p className="dreamina-login-message">{loginMessage}</p>
          {runtime?.userCode ? (
            <p className="dreamina-login-usercode">验证码：{runtime.userCode}</p>
          ) : null}
          {showQr ? (
            <div className="dreamina-qr-wrap">
              <img src={qrDataUrl!} alt="即梦登录二维码" className="dreamina-qr-image" />
              <p className="dreamina-qr-hint">请使用抖音 App 扫码并确认授权</p>
            </div>
          ) : null}
          {runtime?.manualLoginAvailable && runtime.loginMode === "web" ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void handleOpenBrowser()}>
              在浏览器中打开授权页
            </button>
          ) : null}
        </div>
      )}

      {error ? <p className="settings-test-error">{error}</p> : null}

      <div className="settings-dreamina-actions">
        <button
          type="button"
          className="btn btn--secondary"
          disabled={busy || runtime?.active}
          onClick={() => void handleWebLogin()}
        >
          网页登录
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy || runtime?.active}
          onClick={() => void handleQrLogin()}
        >
          扫码登录
        </button>
      </div>

      {!auth?.installed && !auth?.isLoggedIn ? (
        <p className="settings-desc settings-desc-tight">
          首次登录将自动下载即梦 CLI 组件（仅 Windows），完成后请重试登录。
        </p>
      ) : null}
    </div>
  );
}