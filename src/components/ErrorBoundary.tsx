import { type ErrorInfo, type ReactNode, Component } from "react";
import { appLogger } from "@/lib/appLogger";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  /** 点击重试按钮时触发（通常重新挂载子组件） */
  onRecover?: () => void;
  /** 错误区域名称，用于日志标记 */
  name?: string;
};

type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    appLogger.error(
      `[ErrorBoundary${this.props.name ? ` / ${this.props.name}` : ""}] React render error`,
      error,
      info.componentStack,
    );
  }

  private handleDismiss = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRecover?.();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          style={{
            padding: 20,
            maxWidth: 480,
            margin: "24px auto",
            borderRadius: 10,
            border: "1px solid rgba(239, 68, 68, 0.35)",
            background: "rgba(15, 23, 42, 0.92)",
            color: "#e2e8f0",
            fontFamily: "system-ui, sans-serif",
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>
            {this.props.name ? `${this.props.name} 异常` : "渲染出错"}
          </h2>
          <p style={{ margin: "0 0 10px", color: "#94a3b8", fontSize: 12 }}>
            已记录错误信息。可尝试重新加载此区域。
          </p>
          <pre
            style={{
              margin: "0 0 12px",
              padding: 10,
              borderRadius: 6,
              background: "rgba(0,0,0,0.3)",
              overflow: "auto",
              fontSize: 11,
              color: "#fca5a5",
              maxHeight: 120,
            }}
          >
            {this.state.error.message}
          </pre>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={this.handleDismiss}
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                border: "1px solid rgba(239, 68, 68, 0.4)",
                background: "rgba(239, 68, 68, 0.15)",
                color: "#fca5a5",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              重试
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                border: "1px solid rgba(148, 163, 184, 0.3)",
                background: "transparent",
                color: "#94a3b8",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
