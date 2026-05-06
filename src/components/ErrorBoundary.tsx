import { type ErrorInfo, type ReactNode, Component } from "react";
import { appLogger } from "@/lib/appLogger";

type Props = { children: ReactNode; fallback?: ReactNode };

type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    appLogger.error("React render error", error, info.componentStack);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          style={{
            padding: 24,
            maxWidth: 560,
            margin: "48px auto",
            borderRadius: 12,
            border: "1px solid rgba(239, 68, 68, 0.45)",
            background: "rgba(15, 23, 42, 0.95)",
            color: "#e2e8f0",
            fontFamily: "system-ui, sans-serif",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <h1 style={{ margin: "0 0 12px", fontSize: 18 }}>界面渲染出错</h1>
          <p style={{ margin: "0 0 8px", color: "#94a3b8" }}>
            已记录错误信息。请刷新页面重试；若持续出现，请附带控制台截图反馈。
          </p>
          <pre
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 8,
              background: "rgba(0,0,0,0.35)",
              overflow: "auto",
              fontSize: 12,
              color: "#fca5a5",
            }}
          >
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
