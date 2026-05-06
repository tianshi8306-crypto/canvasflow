type Props = {
  templateName: string;
  scene: string;
  tips: string[];
};

export function ScriptWorkbenchTemplateGuideCard({ templateName, scene, tips }: Props) {
  return (
    <div className="scriptTemplateGuideCard">
      <div className="scriptTemplateGuideTitle">模板说明：{templateName}</div>
      <div className="scriptTemplateGuideScene">适用场景：{scene}</div>
      {tips.map((line) => (
        <div key={line} className="scriptTemplateGuideTip">
          - {line}
        </div>
      ))}
    </div>
  );
}
