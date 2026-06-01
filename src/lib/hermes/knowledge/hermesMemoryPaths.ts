import { invoke, isTauri } from "@tauri-apps/api/core";

export type HermesMemoryPaths = {
  mode: "project" | "custom";
  memoryRoot: string | null;
  userDir: string;
  indexDb: string;
  projectSlug: string | null;
};

export type HermesMemoryMigrationResult = {
  migratedFiles: number;
  skippedFiles: number;
  conflictFiles: number;
  fromDir: string;
  toDir: string;
};

export function normalizeHermesMemoryRoot(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function hermesMemoryRootsEqual(
  a?: string | null,
  b?: string | null,
): boolean {
  return normalizeHermesMemoryRoot(a) === normalizeHermesMemoryRoot(b);
}

export async function migrateHermesUserMemory(
  projectPath: string,
  fromMemoryRoot: string | null,
  toMemoryRoot: string | null,
): Promise<HermesMemoryMigrationResult> {
  if (!isTauri()) {
    return {
      migratedFiles: 0,
      skippedFiles: 0,
      conflictFiles: 0,
      fromDir: "",
      toDir: "",
    };
  }
  return invoke<HermesMemoryMigrationResult>("hermes_knowledge_migrate_user_memory", {
    projectPath: projectPath.trim(),
    fromMemoryRoot: normalizeHermesMemoryRoot(fromMemoryRoot),
    toMemoryRoot: normalizeHermesMemoryRoot(toMemoryRoot),
  });
}

export function formatHermesMemoryMigrationNotice(
  result: HermesMemoryMigrationResult,
): string | null {
  const { migratedFiles, skippedFiles, conflictFiles } = result;
  if (migratedFiles === 0 && skippedFiles === 0 && conflictFiles === 0) {
    return null;
  }
  const parts: string[] = [];
  if (migratedFiles > 0) parts.push(`已迁移 ${migratedFiles} 条经验`);
  if (skippedFiles > 0) parts.push(`${skippedFiles} 条目标处已存在（已清理旧副本）`);
  if (conflictFiles > 0) {
    parts.push(
      `${conflictFiles} 条因目标较新未覆盖，仍保留在旧目录，请手动核对`,
    );
  }
  return parts.join("；");
}

export async function fetchHermesMemoryPaths(
  projectPath?: string | null,
): Promise<HermesMemoryPaths | null> {
  if (!isTauri()) return null;
  return invoke<HermesMemoryPaths>("hermes_knowledge_memory_paths", {
    projectPath: projectPath?.trim() || null,
  });
}
