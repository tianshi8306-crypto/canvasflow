import {
  createContext,
  useContext,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { useStore } from "@xyflow/react";

type NodeChromeContextValue = {
  mountRef: RefObject<HTMLDivElement | null>;
  invZoom: number;
};

const NodeChromeContext = createContext<NodeChromeContextValue | null>(null);

/** 节点统一根：预览 + 顶/底栏 Portal 同 stacking context（随 RF 节点 transform） */
export function NodeChromeProvider({ children }: { children: ReactNode }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const zoom = useStore((s) => s.transform[2]) || 1;
  const invZoom = 1 / Math.max(zoom, 0.01);

  return (
    <div
      ref={mountRef}
      className="nodeChrome-unifiedRoot"
      style={{ "--node-chrome-inv-zoom": invZoom } as CSSProperties}
    >
      <NodeChromeContext.Provider value={{ mountRef, invZoom }}>{children}</NodeChromeContext.Provider>
    </div>
  );
}

export function useNodeChromeMount(): NodeChromeContextValue | null {
  return useContext(NodeChromeContext);
}
