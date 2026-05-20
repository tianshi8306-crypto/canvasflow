import { PanelPinIcon } from "@/components/nodes/nodePanelIcons";
import { RF_NODE_INPUT_CLASS } from "@/lib/canvasInteraction";

type Props = {
  onUnpin: () => void;
};

/** 钉住底栏时：模型对话面板顶栏 */
export function TextNodeComposerDockHead({ onUnpin }: Props) {
  return (
    <div className={`textNodeComposerDockHead ${RF_NODE_INPUT_CLASS}`}>
      <span className="textNodeComposerDockTitle">模型对话</span>
      <button
        type="button"
        className="textNodeComposerDockUnpin"
        title="取消钉住"
        aria-label="取消钉住模型对话面板"
        onClick={onUnpin}
      >
        <PanelPinIcon />
      </button>
    </div>
  );
}
