import { useCallback, useEffect, useState } from "react";
import { HERMES_TEMPLATES_UPDATED_EVENT } from "@/lib/hermes/hermesTemplateChat";
import {
  formatTemplateCatalogForUser,
  listHermesPlanTemplates,
  type HermesPlanTemplate,
} from "@/lib/hermes/hermesPlanTemplates";

function TemplateRow(props: { template: HermesPlanTemplate }) {
  const { template } = props;
  return (
    <li className="settingsHermesTemplateRow settingsHermesTemplateRow--readonly">
      <div className="settingsHermesTemplateMain">
        <span className="settingsHermesTemplateTitle">
          {template.title}
          <span className="settingsHermesTemplateTag">
            {template.builtin ? "内置" : "自定义"}
          </span>
        </span>
        <span className="settingsFieldHint settingsHermesTemplateDesc">
          {template.description}
        </span>
        <span className="settingsFieldHint settingsHermesTemplateMeta">
          ID: <code>{template.id}</code> · {template.steps.length} 步
        </span>
      </div>
    </li>
  );
}

const CHAT_EXAMPLES = [
  "有哪些模板",
  "跑模板 分镜出关键帧",
  "保存模板为「我的流程」",
  "删除模板「我的流程」",
];

export function SettingsHermesPlanTemplates() {
  const [templates, setTemplates] = useState<HermesPlanTemplate[]>(() =>
    listHermesPlanTemplates(),
  );

  const refresh = useCallback(() => {
    setTemplates(listHermesPlanTemplates());
  }, []);

  useEffect(() => {
    const onUpdated = () => refresh();
    window.addEventListener(HERMES_TEMPLATES_UPDATED_EVENT, onUpdated);
    window.addEventListener("canvasflow-settings-saved", onUpdated);
    return () => {
      window.removeEventListener(HERMES_TEMPLATES_UPDATED_EVENT, onUpdated);
      window.removeEventListener("canvasflow-settings-saved", onUpdated);
    };
  }, [refresh]);

  const builtin = templates.filter((t) => t.builtin);
  const custom = templates.filter((t) => !t.builtin);

  return (
    <div className="settingsField settingsHermesTemplatesReadonly">
      <p className="settingsFieldHint settingsHermesTemplatesLead">
        计划模板请在画布 <strong>H</strong> 浮窗用对话管理（自动执行，无需点「执行计划」）。
        此处仅作只读查阅。
      </p>
      <div className="settingsHermesTemplatesExamples" role="note">
        <span className="settingsSubsectionTitle">对话示例</span>
        <ul className="settingsHermesTemplatesExampleList">
          {CHAT_EXAMPLES.map((line) => (
            <li key={line}>
              <code>{line}</code>
            </li>
          ))}
        </ul>
      </div>
      <details className="settingsHermesTemplatesCatalog">
        <summary className="settingsHermesTemplatesCatalogSummary">
          展开完整模板目录（与对话「有哪些模板」相同）
        </summary>
        <pre className="settingsHermesTemplatesCatalogPre">{formatTemplateCatalogForUser()}</pre>
      </details>
      <div className="settingsSubsectionTitle">内置模板</div>
      <ul className="settingsHermesTemplateList">
        {builtin.map((t) => (
          <TemplateRow key={t.id} template={t} />
        ))}
      </ul>
      {custom.length > 0 ? (
        <>
          <div className="settingsSubsectionTitle">自定义模板</div>
          <ul className="settingsHermesTemplateList">
            {custom.map((t) => (
              <TemplateRow key={t.id} template={t} />
            ))}
          </ul>
        </>
      ) : (
        <p className="settingsFieldHint">
          暂无自定义模板。执行一轮任务后，在 H 里说「保存模板为「名称」」即可创建。
        </p>
      )}
    </div>
  );
}
