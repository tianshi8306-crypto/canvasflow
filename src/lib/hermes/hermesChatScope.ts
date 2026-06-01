/** Hermes 对话历史分桶：工程路径 + 画布 Tab，避免多 Tab / 临时画布串台 */

export function hermesChatStorageScope(
  projectPath: string | null,
  tabId: string | null,
): string {
  const path = projectPath?.trim() || "__draft__";
  const tab = tabId?.trim() || "__default_tab__";
  return `${path}::${tab}`;
}

/** iter-43 之前仅按工程路径存；用于一次性迁移 */
export function hermesChatLegacyStorageScope(projectPath: string | null): string {
  return projectPath?.trim() || "__no_project__";
}
