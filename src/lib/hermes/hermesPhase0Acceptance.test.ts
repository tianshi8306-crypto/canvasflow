import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  shouldAutoExecutePlans,
  setHermesAgentSettingsCacheForTest,
  defaultHermesAgentSettings,
} from "@/lib/hermes/agent/hermesAgentSettings";
import {
  canSubmitHermesMessage,
  isHermesConsultChannel,
} from "@/lib/hermes/agent/hermesParallelChannel";
import { enqueuePlanningProductionMessage } from "@/lib/hermes/agent/hermesPlanningMessageQueue";
import {
  estimateHermesFloatChatHeightPx,
  hermesFloatChatHeightRatio,
  HERMES_FLOAT_LAYOUT,
} from "@/lib/hermes/hermesFloatLayout";
import {
  getHermesReplyLimits,
  inferHermesReplyStyle,
  shouldStripHermesBoilerplate,
} from "@/lib/hermes/hermesReplyStyle";
import { resolveHermesMessageMode } from "@/lib/hermes/hermesMessageIntent";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

describe("Phase 0 · 浮窗轻壳布局", () => {
  it("竖版浮窗尺寸为 300×533（9:16 近似）", () => {
    expect(HERMES_FLOAT_LAYOUT.width).toBe(300);
    expect(HERMES_FLOAT_LAYOUT.height).toBe(533);
  });

  it("无 Job inline peek 时聊天区 ≥60% 浮窗高度", () => {
    expect(hermesFloatChatHeightRatio()).toBeGreaterThanOrEqual(0.6);
    expect(estimateHermesFloatChatHeightPx()).toBeGreaterThanOrEqual(
      Math.round(HERMES_FLOAT_LAYOUT.height * 0.6),
    );
  });

  it("浮窗任务 ambient：顶栏 chip + 抽屉，不在聊天栏 inline JobCenter", () => {
    const floatPanel = readFileSync(
      join(repoRoot, "src/components/hermes/HermesFloatPanel.tsx"),
      "utf8",
    );
    const flowCanvas = readFileSync(
      join(repoRoot, "src/components/FlowCanvas.tsx"),
      "utf8",
    );
    const sidebar = readFileSync(
      join(repoRoot, "src/components/hermes/HermesSidebar.tsx"),
      "utf8",
    );
    expect(floatPanel).toContain("HermesJobAmbientChip");
    expect(flowCanvas).toMatch(/hermesMode === "idle" \? <HermesOrb/);
    expect(sidebar).not.toMatch(/HermesJobCenter[\s\S]*compact=\{isFloat\}/);
    expect(sidebar).toContain('!isFloat ? <HermesJobCenter');
  });

  it("浮窗 composer 用 ContextStrip 短句，非 inline SituationCard", () => {
    const sidebar = readFileSync(
      join(repoRoot, "src/components/hermes/HermesSidebar.tsx"),
      "utf8",
    );
    expect(sidebar).toContain("HermesContextStrip");
    expect(sidebar).toMatch(/isFloat && projectPath \? <HermesContextStrip/);
    expect(sidebar).toContain("!isFloat && projectPath && situationCardGaps.length > 0");
    expect(sidebar).toContain("handleComposerAttachPick");
    expect(sidebar).toContain("IconComposerPlus");
    expect(sidebar).toContain("handleComposerPaste");
    expect(sidebar).toContain("enqueuePlanningProductionMessage");
    expect(sidebar).toContain("refreshPlanningQueue");
  });

  it("浮窗顶栏无标题文字，仅点阵与窗口按钮", () => {
    const src = readFileSync(
      join(repoRoot, "src/components/hermes/HermesFloatPanel.tsx"),
      "utf8",
    );
    expect(src).not.toContain("hermesFloatHeaderName");
    expect(src).toContain("IconSpiritDots");
  });

  it("浮窗工具区默认折叠在 details 内", () => {
    const src = readFileSync(
      join(repoRoot, "src/components/hermes/HermesSidebar.tsx"),
      "utf8",
    );
    expect(src).toContain('<details className="hermesFloatExtras">');
    expect(src).not.toMatch(/hermesFloatExtras[^>]*\sopen=/);
  });
});

describe("Phase 0 · 自动回复篇幅", () => {
  it("execute 画布指令 → concise + 去套话", () => {
    const msg = "不是咨询，在画布上添加一个文本节点";
    expect(resolveHermesMessageMode(msg)).toBe("execute");
    const style = inferHermesReplyStyle({
      userMessage: msg,
      messageMode: "execute",
      planStepCount: 1,
    });
    expect(style).toBe("concise");
    expect(shouldStripHermesBoilerplate(style)).toBe(true);
    expect(getHermesReplyLimits(style).planReplyMax).toBeLessThanOrEqual(72);
  });

  it("深度咨询 → detailed", () => {
    expect(
      inferHermesReplyStyle({
        userMessage: "请解释一下蒙太奇和跳切在悬疑片里有什么区别？",
        messageMode: "consult",
      }),
    ).toBe("detailed");
  });

  it("设置面板无 agentHermesReplyStyle，有自动推断说明", () => {
    const settings = readFileSync(
      join(repoRoot, "src/lib/settingsPanelTypes.ts"),
      "utf8",
    );
    const agentUi = readFileSync(
      join(repoRoot, "src/components/settings/SettingsAgentSection.tsx"),
      "utf8",
    );
    expect(settings).not.toContain("agentHermesReplyStyle");
    expect(agentUi).toContain("回复长短由 H 根据你的指令自动判断");
  });

  it("streamHermesChat 将 replyStyle 传给 Rust", () => {
    const brain = readFileSync(
      join(repoRoot, "src/lib/hermes/hermesBrain.ts"),
      "utf8",
    );
    expect(brain).toContain("replyStyle");
    expect(brain).toContain('invoke<string>("hermes_chat_stream"');
  });
});

describe("Phase 0 · Golden GS-1 / GS-2", () => {
  it("GS-1: 制片执行中 consult 仍可发送", () => {
    expect(isHermesConsultChannel("consult")).toBe(true);
    expect(
      canSubmitHermesMessage({
        messageMode: "consult",
        streaming: true,
        planning: false,
      }),
    ).toBe(true);
    expect(
      canSubmitHermesMessage({
        messageMode: "execute",
        streaming: true,
        planning: false,
      }),
    ).toBe(true);
  });

  it("GS-1: planning 期间 execute 可入队（非 silent reject）", () => {
    expect(
      canSubmitHermesMessage({
        messageMode: "execute",
        streaming: false,
        planning: true,
      }),
    ).toBe(true);
    expect(
      enqueuePlanningProductionMessage("/proj", "帮出分镜图").ok,
    ).toBe(true);
  });

  it("GS-2: 关闭 agentAutoExecute 时不应自动跑计划", () => {
    setHermesAgentSettingsCacheForTest({
      ...defaultHermesAgentSettings(),
      agentAutoExecute: false,
    });
    expect(shouldAutoExecutePlans()).toBe(false);
  });

  it("composer 输入不因 streaming 禁用（仅 tipBusy）", () => {
    const src = readFileSync(
      join(repoRoot, "src/components/hermes/HermesSidebar.tsx"),
      "utf8",
    );
    expect(src).toMatch(/disabled=\{tipBusy\}/);
    expect(src).not.toMatch(/disabled=\{streaming \|\| tipBusy\}/);
  });
});
