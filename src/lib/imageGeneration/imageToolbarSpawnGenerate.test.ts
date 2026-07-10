import { describe, expect, it } from "vitest";
import {
  IMAGE_TOOLBAR_SPAWN_CONFIG,
  IMAGE_TOOLBAR_SPAWN_OUTPUT_ASPECT,
  IMAGE_TOOLBAR_SPAWN_OUTPUT_RESOLUTION,
  IMAGE_TOOLBAR_SPAWN_PREFERRED_MODEL,
  PERSON_3VIEW_SPAWN_PROMPT,
  pickToolbarSpawnImageModelId,
} from "@/lib/imageGeneration/imageToolbarSpawnGenerate";
import { IMAGE_PREVIEW_TOOLBAR_GROUPS } from "@/lib/imagePreviewToolbarActions";
import type { ImageModelOption } from "@/hooks/useImageModels";

function mockModel(partial: Partial<ImageModelOption> & Pick<ImageModelOption, "id">): ImageModelOption {
  return {
    label: partial.id,
    subtitle: undefined,
    estimateLabel: "30s",
    iconLetter: "D",
    sortIndex: 0,
    settingsId: null,
    model: partial.model ?? partial.id,
    priority: 0,
    enabled: true,
    supportsMultiRefFusion: true,
    maxReferenceImages: 4,
    supportsImageEdit: true,
    ...partial,
  };
}

describe("imageToolbarSpawnGenerate", () => {
  it("exposes person3view fixed prompt config", () => {
    expect(IMAGE_TOOLBAR_SPAWN_CONFIG.person3view.prompt).toBe(PERSON_3VIEW_SPAWN_PROMPT);
    expect(IMAGE_TOOLBAR_SPAWN_CONFIG.person3view.label).toBe("角色三视图");
  });

  it("uses 16:9 output aspect and 4K resolution", () => {
    expect(IMAGE_TOOLBAR_SPAWN_OUTPUT_ASPECT).toBe("16:9");
    expect(IMAGE_TOOLBAR_SPAWN_OUTPUT_RESOLUTION).toBe("4K");
    expect(IMAGE_TOOLBAR_SPAWN_PREFERRED_MODEL).toBe("dreamina/5.0");
  });

  it("prefers dreamina CLI 5.0 when enabled", () => {
    const id = pickToolbarSpawnImageModelId([
      mockModel({ id: "Doubao-Seedream-5.0-lite", model: "Doubao-Seedream-5.0-lite" }),
      mockModel({ id: "dreamina/5.0", model: "dreamina/5.0" }),
    ]);
    expect(id).toBe("dreamina/5.0");
  });

  it("falls back to first enabled model when dreamina 5.0 unavailable", () => {
    const id = pickToolbarSpawnImageModelId([
      mockModel({
        id: "Doubao-Seedream-5.0-lite",
        model: "Doubao-Seedream-5.0-lite",
        enabled: true,
      }),
      mockModel({ id: "dreamina/5.0", model: "dreamina/5.0", enabled: false }),
    ]);
    expect(id).toBe("Doubao-Seedream-5.0-lite");
  });

  it("toolbar maps 角色三视图 to spawnGenerate", () => {
    const grid = IMAGE_PREVIEW_TOOLBAR_GROUPS.find((g) => g.id === "grid");
    const action = grid?.actions.find((a) => a.id === "person3view");
    expect(action?.kind).toBe("spawnGenerate");
    expect(action?.spawnId).toBe("person3view");
    expect(action?.presetId).toBeUndefined();
  });
});
