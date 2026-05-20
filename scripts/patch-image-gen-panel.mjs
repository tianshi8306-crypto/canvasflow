import fs from "fs";

const recovered =
  "d:/vibevideo/docs/recovered/ImageGenerationPanel-2026-05-19-1511-local.tsx";
const dst = "d:/vibevideo/src/components/nodes/ImageGenerationPanel.tsx";

const BAD = "motionless";

let s = fs.readFileSync(recovered, "utf8");
s = s.replaceAll(`<${BAD}`, "<div");
s = s.replaceAll(`</${BAD}>`, "</div>");

s = s.replace(
  'import { useCallback, useEffect, useMemo, useRef, useState } from "react";',
  'import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";',
);

const quickIcons = `/** 顶栏快捷钮图标容器：主图标 + 右下角「+」 */
function IgpQuickIconBadge({ children }: { children: ReactNode }) {
  return (
    <span className="igp-quick-icon-wrap" aria-hidden>
      {children}
      <svg className="igp-quick-icon-plus" viewBox="0 0 10 10">
        <path
          d="M5 2.25v5.5M2.25 5h5.5"
          stroke="currentColor"
          strokeWidth="1.15"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/** 风格：等轴测线框立方体 + 角标 + */
function IconStyle() {
  return (
    <IgpQuickIconBadge>
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M12 4.75 17.25 8 12 11.25 6.75 8 12 4.75Z"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <path
          d="M6.75 8v6.5L12 17.75 12 11.25"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d="M17.25 8v6.5L12 17.75 12 11.25"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </IgpQuickIconBadge>
  );
}

/** 标记：线框定位针 + 中心点 + 角标 + */
function IconMarker() {
  return (
    <IgpQuickIconBadge>
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M12 4.25c-2.55 0-4.6 2.05-4.6 4.55 0 3.35 4.6 9.95 4.6 9.95s4.6-6.6 4.6-9.95c0-2.5-2.05-4.55-4.6-4.55Z"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="8.75" r="1.35" fill="currentColor" />
      </svg>
    </IgpQuickIconBadge>
  );
}

`;

s = s.replace(/function IconStyle\(\) \{[\s\S]*?function IconMarker\(\) \{[\s\S]*?\}\n\n/, quickIcons);

s = s.replace(/function IconNegative\(\) \{[\s\S]*?\}\n\n/, "");
s = s.replace(/const PARAM_NEGATIVE_PROMPT = "negativePrompt";\n/, "");
s = s.replace(/  const \[negativeOpen, setNegativeOpen\] = useState\(false\);\n/, "");
s = s.replace(
  /  const negativePrompt =[\s\S]*?;\n\n  const ctx = useImageGenerationContext/,
  "  const ctx = useImageGenerationContext",
);
s = s.replace(
  /  useEffect\(\(\) => \{\n    if \(negativePrompt\.trim\(\)\) setNegativeOpen\(true\);\n  \}, \[negativePrompt\]\);\n\n/,
  "",
);
s = s.replace(/\n            negativePrompt: negativePrompt\.trim\(\) \|\| undefined,/, "");
s = s.replace(/\n    negativePrompt,/, "");

const emptyExpand = `        {layout === "empty" ? (
          <div className="igp-header-actions">
            <button
              type="button"
              className="igp-header-icon-btn igp-expand-trigger"
              title="展开面板，专注编辑提示词"
              aria-label="展开面板"
              onClick={handleExpandClick}
            >
              <PanelExpandIcon />
            </button>
          </div>
        ) : null}

`;

s = s.replace(
  /        \) : null\}\n\n        \{isDefaultLayout \? \(/,
  `        ) : null}\n\n${emptyExpand}        {isDefaultLayout ? (`,
);

s = s.replace(
  /      \{\/\* ── 任务 \/ 参考 \/ 负面开关 ── \*\/\}\n      <div className="igp-toolbar-top">[\s\S]*?      <\/div>\n\n      \{\/\* ── 提示词/,
  `      {(ctx.task || refCount > 0) ? (
        <div className="igp-toolbar-top">
          {ctx.task ? (
            <span className="igp-task-status">
              {imageTaskStatusLabel(ctx.task, refCount)}
            </span>
          ) : null}
          {refCount > 0 ? (
            <span className="igp-ref-tag">{refCount} 张参考已连接</span>
          ) : null}
        </div>
      ) : null}

      {/* ── 提示词`,
);

s = s.replace(
  /\n      \{layout === "empty" && !prompt\.trim\(\) && !ctx\.blockReason \? \([\s\S]*?\) : null\}\n/,
  "\n",
);

s = s.replace(/\n      \{negativeOpen \? \([\s\S]*?\) : null\}\n/, "\n");

// 底栏顺序：模型 → 比例/分辨率 → 张数 → 生成
s = s.replace(
  /      \{\/\* ── 底栏参数 ── \*\/\}\n      <div className="igp-bottom-bar">[\s\S]*?      <\/div>\n    <\/div>\n  \);\n\}/,
  `      {/* ── 底栏：模型 → 比例/分辨率 → 张数 → 生成 ── */}
      <div className="igp-bottom-bar">
        <ImageModelPicker
          models={models}
          value={validModelId}
          loading={modelsLoading}
          onChange={(id) => patchNodeParams({ [PARAM_IMAGE_MODEL]: id })}
        />

        <ImageAspectResolutionPicker
          aspect={outputParams.aspect}
          resolution={outputParams.resolution}
          onAspectChange={handleAspectChange}
          onResolutionChange={handleResolutionChange}
        />

        <select
          className={\`igp-count-select \${RF_NODE_INPUT_CLASS}\`}
          value={imageCount}
          title="生成张数"
          aria-label="生成张数"
          onChange={(e) =>
            patchNodeParams({ [PARAM_IMAGE_COUNT]: Number(e.target.value) })
          }
          onPointerDown={(e) => e.stopPropagation()}
        >
          {IMAGE_COUNT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={\`igp-generate-btn\${isGenerating ? " generating" : ""}\`}
          disabled={!isGenerating && !canGenerate}
          title={isGenerating ? "停止生成" : "生成图片"}
          aria-label={isGenerating ? "停止生成" : "生成图片"}
          onClick={handleGenerate}
        >
          <IgpGenerateButtonIcon generating={isGenerating} />
        </button>
      </div>
    </div>
  );
}`,
);

fs.writeFileSync(dst, s, "utf8");
console.log("ok", s.split("\n").length, "lines");
