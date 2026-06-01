import type { HermesFormattedUserTip } from "@/lib/hermes/knowledge/hermesUserKnowledge";

type Props = {
  tip: HermesFormattedUserTip;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function HermesUserTipCard({ tip, saving, onConfirm, onCancel }: Props) {
  return (
    <div className="hermesTipCard" role="region" aria-label="Hermes 记忆确认">
      <p className="hermesTipCardTitle">Hermes 已整理 · 确认后写入本工程记忆</p>
      <p className="hermesTipCardMeta">
        {tip.title}
        <span className="hermesTipCardMetaSep">·</span>
        {tip.category}
        <span className="hermesTipCardMetaSep">·</span>
        <code className="hermesTipCardId">{tip.docId}</code>
      </p>
      <pre className="hermesTipCardPreview">{tip.markdown}</pre>
      <div className="hermesTipCardActions">
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={saving}
          onClick={onConfirm}
        >
          {saving ? "记住中…" : "让 Hermes 记住"}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={saving}
          onClick={onCancel}
        >
          取消
        </button>
      </div>
    </div>
  );
}
