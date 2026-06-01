/** 画布浮窗 / 灵体对外显示名（内部工程代号仍为 Hermes） */
export const HERMES_SPIRIT_DEFAULT_NAME = "灵体";

/** @deprecated 优先用 resolveSpiritShortMark / spiritIdentityStore */
export const HERMES_AGENT_SHORT_NAME = "H";

/** 灵体默认可视色（与 global.css `--cf-cyan-*` 一致） */
export const HERMES_SPIRIT_CYAN = {
  glow: "var(--cf-cyan-glow)",
  faceHi: "var(--cf-cyan-pale)",
  faceMid: "var(--cf-cyan-light)",
  faceDeep: "var(--cf-cyan-deep)",
  shadow: "rgba(14, 165, 233, 0.5)",
} as const;
