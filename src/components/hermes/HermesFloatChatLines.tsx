import {
  buildSpiritFloatIntroHint,
  resolveSpiritShortMark,
} from "@/lib/hermes/agent/hermesSpiritIdentity";
import { useHermesSpiritIdentityStore } from "@/store/hermesSpiritIdentityStore";
import { useShallow } from "zustand/react/shallow";
import type { HermesChatMediaPreview } from "@/lib/hermes/hermesChatMediaPreview";
import { HermesChatMediaPreview as HermesChatMediaPreviewBlock } from "@/components/hermes/HermesChatMediaPreview";

export type HermesDisplayLine = {
  id: string;
  role: "user" | "hermes";
  text: string;
  preview?: HermesChatMediaPreview;
};

type Props = {
  lines: HermesDisplayLine[];
  streaming: boolean;
  /** 浮窗：无头像、Agent 纯文本、用户胶囊气泡 */
  variant?: "float" | "sidebar";
};

export function HermesFloatChatLines({
  lines,
  streaming,
  variant = "float",
}: Props) {
  const isLite = variant === "float";
  const hasMessages = lines.length > 0 || streaming;
  const spiritIdentity = useHermesSpiritIdentityStore(
    useShallow((s) => ({
      spiritName: s.spiritName,
      userHonorific: s.userHonorific,
      introShown: s.introShown,
    })),
  );
  const introHint = buildSpiritFloatIntroHint(spiritIdentity);
  const avatarMark = resolveSpiritShortMark(spiritIdentity);

  return (
    <>
      {!hasMessages && isLite ? (
        <p className="hermesFloatIntro hermesFloatIntro--hint">{introHint}</p>
      ) : null}
      {!hasMessages && !isLite ? (
        <p className="hermesFloatIntro">{introHint}</p>
      ) : null}
      {lines.map((line) => {
        const isUser = line.role === "user";
        const text = line.text || (!isUser && streaming ? "…" : "");
        if (!text && isUser && !line.preview) return null;

        const rowClass = [
          "hermesWxRow",
          isUser ? "hermesWxRow--user" : "hermesWxRow--agent",
          isLite ? "hermesWxRow--lite" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const bubbleClass = [
          "hermesWxBubble",
          isUser ? "hermesWxBubble--user" : "",
          isLite && !isUser ? "hermesWxBubble--plain" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div key={line.id} className={rowClass}>
            {!isLite && !isUser ? (
              <span className="hermesWxAvatar hermesWxAvatar--agent" aria-hidden>
                {avatarMark}
              </span>
            ) : null}
            <div className="hermesWxBubbleWrap">
              {text ? <div className={bubbleClass}>{text}</div> : null}
              {!isUser && line.preview ? (
                <HermesChatMediaPreviewBlock preview={line.preview} />
              ) : null}
            </div>
            {!isLite && isUser ? (
              <span className="hermesWxAvatar hermesWxAvatar--user" aria-hidden>
                我
              </span>
            ) : null}
          </div>
        );
      })}
      {streaming && lines[lines.length - 1]?.role !== "hermes" ? (
        <div className={`hermesWxRow hermesWxRow--agent${isLite ? " hermesWxRow--lite" : ""}`}>
          {!isLite ? (
            <span className="hermesWxAvatar hermesWxAvatar--agent" aria-hidden>
              H
            </span>
          ) : null}
          <div className="hermesWxBubbleWrap">
            <div
              className={`hermesWxBubble hermesWxBubble--typing${isLite ? " hermesWxBubble--plain" : ""}`}
            >
              …
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
