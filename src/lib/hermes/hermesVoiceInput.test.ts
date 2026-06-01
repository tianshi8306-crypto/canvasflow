import { describe, expect, it, vi } from "vitest";
import {
  HermesBrowserSpeechSession,
  mapSpeechRecognitionError,
  resolveHermesVoiceBackend,
} from "@/lib/hermes/hermesVoiceInput";

describe("hermesVoiceInput", () => {
  it("resolveHermesVoiceBackend prefers browser when SpeechRecognition exists", () => {
    const prev = globalThis.window;
    vi.stubGlobal("window", {
      SpeechRecognition: class {},
    });
    expect(resolveHermesVoiceBackend()).toBe("browser");
    vi.stubGlobal("window", prev);
  });

  it("mapSpeechRecognitionError maps permission errors", () => {
    expect(mapSpeechRecognitionError("not-allowed")).toContain("麦克风");
  });

  it("BrowserSpeechSession forwards final transcripts", () => {
    const instances: SpeechRecognitionLike[] = [];
    class MockRec implements SpeechRecognitionLike {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((ev: SpeechRecognitionEventLike) => void) | null = null;
      onerror: ((ev: { error?: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        instances.push(this);
      }
      stop() {
        this.onend?.();
      }
      abort() {}
    }
    vi.stubGlobal("window", { SpeechRecognition: MockRec });

    const finals: string[] = [];
    const session = new HermesBrowserSpeechSession({
      onFinal: (t) => finals.push(t),
      onError: () => {},
    });
    expect(session.start()).toBe(true);
    const started = instances[0]!;
    started.onresult?.({
      resultIndex: 0,
      results: {
        length: 1,
        0: { isFinal: true, 0: { transcript: " 帮我把脚本生成分镜 " } },
      },
    });
    expect(finals).toEqual(["帮我把脚本生成分镜"]);
    session.stop();
    vi.unstubAllGlobals();
  });
});

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [alt: number]: { transcript: string };
    };
  };
};
