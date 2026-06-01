import { createPortal } from "react-dom";
import type { ReactNode } from "react";

type Props = {
  target: HTMLElement | null;
  children: ReactNode;
};

/** 将子树 Portal 到画布节点预览区 overlay 挂载点 */
export function PortalToElement({ target, children }: Props) {
  if (!target) return null;
  return createPortal(children, target);
}
