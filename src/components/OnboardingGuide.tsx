import { useEffect } from "react";
import { useCanvasUiStore } from "@/store/canvasUiStore";

const ONBOARDING_KEY = "canvasflow.onboarding.v1";

/**
 * 首次安装引导对话框
 * 告知用户需要自行配置模型 API Key 后方可正常使用
 */
export function OnboardingGuide() {
  const guideOpen = useCanvasUiStore((s) => s.onboardingGuideOpen);
  const closeOnboardingGuide = useCanvasUiStore((s) => s.closeOnboardingGuide);

  useEffect(() => {
    if (!guideOpen) return;
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismiss();
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [guideOpen]);

  if (!guideOpen) return null;

  function dismiss() {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      /* ignore */
    }
    closeOnboardingGuide();
  }

  function goToSettings() {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      /* ignore */
    }
    closeOnboardingGuide();
    // 延迟一帧确保对话框关闭后再打开设置
    requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent("r3-open-settings", {
          detail: { category: "models" as const, focusSectionId: null },
        }),
      );
    });
  }

  return (
    <div className="onboardingGuideRoot">
      <div className="onboardingGuideOverlay" onClick={dismiss} />
      <div className="onboardingGuidePanel" role="dialog" aria-modal="true" aria-labelledby="onboarding-guide-title">
        <div className="onboardingGuideIcon" aria-hidden="true">
          <span className="onboardingGuideRing" />
          <span className="onboardingGuideCore" />
        </div>

        <h2 id="onboarding-guide-title" className="onboardingGuideTitle">
          欢迎使用 CanvasFlow AI Studio
        </h2>

        <p className="onboardingGuideDesc">
          CanvasFlow 是一个节点化 AI 创作工作台，集成了多家模型服务商的
          图文音视频生成能力。开始创作前，请先在设置中配置您所使用的模型 API。
        </p>

        <ul className="onboardingGuideModels">
          <li>
            <span className="onboardingGuideModelDot onboardingGuideModelDot--chat" />
            <span>文本 / 对话模型</span>
            <span className="onboardingGuideModelHint">DeepSeek、OpenAI、豆包、GLM 等</span>
          </li>
          <li>
            <span className="onboardingGuideModelDot onboardingGuideModelDot--image" />
            <span>图像生成模型</span>
            <span className="onboardingGuideModelHint">即梦、RunningHUB 等</span>
          </li>
          <li>
            <span className="onboardingGuideModelDot onboardingGuideModelDot--video" />
            <span>视频生成模型</span>
            <span className="onboardingGuideModelHint">Seedance、即梦等</span>
          </li>
          <li>
            <span className="onboardingGuideModelDot onboardingGuideModelDot--audio" />
            <span>音频生成模型</span>
            <span className="onboardingGuideModelHint">豆包 TTS 等</span>
          </li>
        </ul>

        <p className="onboardingGuideNote">
          所有 API Key 仅保存在您的设备本地，不会上传至任何云端服务。
        </p>

        <div className="onboardingGuideActions">
          <button type="button" className="onboardingGuideBtn onboardingGuideBtn--secondary" onClick={dismiss}>
            稍后配置
          </button>
          <button type="button" className="onboardingGuideBtn onboardingGuideBtn--primary" onClick={goToSettings}>
            前往配置
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 判断是否需要展示首次引导（仅首屏调用一次）
 */
export function shouldShowOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) !== "1";
  } catch {
    return true;
  }
}
