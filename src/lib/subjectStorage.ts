import type { Subject, SubjectDraft, SubjectCategory } from "@/types/subject";

const SUBJECTS_STORAGE_KEY = "imageNode.subjects.v1";
const SUBJECTS_MAX = 100;

export function loadSubjects(): Subject[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(SUBJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is Subject => Boolean(x && typeof x === "object"))
      .map((x) => ({
        id: typeof x.id === "string" && x.id.trim() ? x.id : crypto.randomUUID(),
        name: typeof x.name === "string" && x.name.trim() ? x.name.trim() : "未命名主体",
        description: typeof x.description === "string" ? x.description : "",
        category:
          x.category === "character" || x.category === "product" || x.category === "pet" || x.category === "person"
            ? x.category
            : "character",
        imagePaths: Array.isArray(x.imagePaths) ? x.imagePaths.filter((p): p is string => typeof p === "string") : [],
        voicePath: typeof x.voicePath === "string" ? x.voicePath : undefined,
        voiceText: typeof x.voiceText === "string" ? x.voiceText : undefined,
        createdAt: typeof x.createdAt === "number" ? x.createdAt : Date.now(),
      }))
      .slice(0, SUBJECTS_MAX);
  } catch {
    return [];
  }
}

export function saveSubjects(items: Subject[]) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const normalized = items.slice(0, SUBJECTS_MAX);
    window.localStorage.setItem(SUBJECTS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* ignore */
  }
}

export function addSubject(draft: SubjectDraft): Subject {
  const items = loadSubjects();
  const newItem: Subject = {
    id: crypto.randomUUID(),
    ...draft,
    createdAt: Date.now(),
  };
  items.unshift(newItem);
  saveSubjects(items);
  return newItem;
}

export function updateSubject(id: string, patch: Partial<SubjectDraft>): Subject | null {
  const items = loadSubjects();
  const idx = items.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...patch };
  saveSubjects(items);
  return items[idx];
}

export function deleteSubject(id: string): void {
  const items = loadSubjects();
  saveSubjects(items.filter((x) => x.id !== id));
}

export function getSubjectById(id: string): Subject | null {
  return loadSubjects().find((x) => x.id === id) ?? null;
}

export function getSubjectsByCategory(category: SubjectCategory): Subject[] {
  return loadSubjects().filter((x) => x.category === category);
}
