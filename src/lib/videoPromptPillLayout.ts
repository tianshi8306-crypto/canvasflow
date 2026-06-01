export type VideoPromptPillDensity = "full" | "medium" | "compact" | "icon";

const PILL_PAD_X = 5;
const THUMB_FULL = 14;
const THUMB_COMPACT = 9;
const BADGE_W = 12;
const INNER_GAP = 3;

export function compactVideoPromptPillLabel(label: string): string {
  const image = /^图片(\d+)$/.exec(label);
  if (image) return `图${image[1]}`;
  const video = /^视频(\d+)$/.exec(label);
  if (video) return `视${video[1]}`;
  const audio = /^声音(\d+)$/.exec(label);
  if (audio) return `声${audio[1]}`;
  if (label.length <= 4) return label;
  return `${label.slice(0, 3)}…`;
}

export function measureTextWidthPx(text: string, font: string): number {
  if (!text) return 0;
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = font;
      return ctx.measureText(text).width;
    }
  }
  const sizeMatch = /(\d+(?:\.\d+)?)px/.exec(font);
  const fontSize = sizeMatch ? Number(sizeMatch[1]) : 13;
  let w = 0;
  for (const ch of text) {
    w += ch.codePointAt(0)! > 255 ? fontSize : fontSize * 0.58;
  }
  return w;
}

function pillLabelFont(mirrorFont: string): string {
  const parts = mirrorFont.trim().split(/\s+/);
  const family = parts.length >= 3 ? parts.slice(2).join(" ") : "sans-serif";
  return `500 11px ${family}`;
}

function estimatePillWidth(
  thumb: number,
  label: string,
  mirrorFont: string,
  withBadge: boolean,
  withThumb: boolean,
): number {
  let w = PILL_PAD_X;
  if (withThumb) w += thumb + INNER_GAP;
  w += measureTextWidthPx(label, pillLabelFont(mirrorFont));
  if (withBadge) w += INNER_GAP + BADGE_W;
  return w;
}

export type VideoPromptPillLayout = {
  density: VideoPromptPillDensity;
  displayLabel: string;
  showBadge: boolean;
};

const PANEL_SLOT_TOKEN = /^@(?:图片|视频|声音)\d+$/;

function fits(width: number, tokenW: number): boolean {
  return width <= tokenW + 0.5;
}

/** 在 token 占位宽度内选择 pill 展示密度与标签，避免裁切只剩蓝勾 */
export function resolveVideoPromptPillLayout(
  token: string,
  label: string,
  mirrorFont: string,
  opts?: { hasBadge?: boolean; hasThumb?: boolean },
): VideoPromptPillLayout {
  const hasBadge = opts?.hasBadge ?? true;
  const hasThumb = opts?.hasThumb ?? true;
  const tokenW = measureTextWidthPx(token, mirrorFont);
  if (tokenW <= 0) {
    return { density: "icon", displayLabel: label, showBadge: false };
  }

  const fullW = estimatePillWidth(THUMB_FULL, label, mirrorFont, hasBadge, hasThumb);
  if (fits(fullW, tokenW)) {
    return { density: "full", displayLabel: label, showBadge: hasBadge };
  }

  const mediumW = estimatePillWidth(THUMB_FULL, label, mirrorFont, false, hasThumb);
  if (fits(mediumW, tokenW)) {
    return { density: "medium", displayLabel: label, showBadge: false };
  }

  const compactFullW = estimatePillWidth(THUMB_COMPACT, label, mirrorFont, false, hasThumb);
  if (fits(compactFullW, tokenW)) {
    return { density: "compact", displayLabel: label, showBadge: false };
  }

  const shortLabel = compactVideoPromptPillLabel(label);
  const compactShortW = estimatePillWidth(THUMB_COMPACT, shortLabel, mirrorFont, false, hasThumb);
  if (fits(compactShortW, tokenW)) {
    return { density: "compact", displayLabel: shortLabel, showBadge: false };
  }

  return { density: "icon", displayLabel: label, showBadge: false };
}

/** @deprecated 使用 resolveVideoPromptPillLayout */
export function pickVideoPromptPillDensity(
  token: string,
  label: string,
  mirrorFont: string,
  opts?: { hasBadge?: boolean; hasThumb?: boolean },
): VideoPromptPillDensity {
  return resolveVideoPromptPillLayout(token, label, mirrorFont, opts).density;
}

export function isPanelSlotVideoRefToken(token: string): boolean {
  return PANEL_SLOT_TOKEN.test(token.trim());
}

export function pillScaleToFit(slotWidth: number, pillWidth: number): number {
  if (slotWidth <= 0 || pillWidth <= 0) return 1;
  if (pillWidth <= slotWidth + 0.5) return 1;
  return Math.max(0.72, slotWidth / pillWidth);
}
