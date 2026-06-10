import type { ScriptBeat } from "@/lib/types";

export type BatchLogReplay =
  | {
      kind: "fill";
      field: "cameraMove";
      value: string;
    }
  | {
      kind: "clear";
      field: "cameraMove";
    }
  | {
      kind: "sortShotNumber";
    }
  | {
      kind: "renumberSelected";
    }
  | {
      kind: "padSelected";
    };

export type BatchLogEntry = {
  id: string;
  line: string;
  replay?: BatchLogReplay;
};

export type BatchPresetsStored = { cameraMove: string[] };

export type ScriptTemplateItem = {
  id: string;
  name: string;
  styleTag?: "shortDrama" | "film" | "anime" | "ad" | "general";
  createdAt: number;
  beats: ScriptBeat[];
};

export type ScriptTemplateExchangeV1 = {
  version: 1;
  exportedAt: number;
  templates: ScriptTemplateItem[];
};
