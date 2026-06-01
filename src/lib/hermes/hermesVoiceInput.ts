import { invoke, isTauri } from "@tauri-apps/api/core";

export type HermesVoiceBackend = "browser" | "whisper" | "none";

export type HermesVoiceInputStatus = "idle" | "listening" | "transcribing";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string; message?: string }) => void) | null;
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

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export function resolveHermesVoiceBackend(): HermesVoiceBackend {
  if (getBrowserSpeechRecognitionCtor()) return "browser";
  if (isTauri()) return "whisper";
  return "none";
}

export function hermesVoiceUnsupportedHint(): string {
  const backend = resolveHermesVoiceBackend();
  if (backend === "browser") return "";
  if (backend === "whisper") {
    return "将使用麦克风录音 + OpenAI Whisper 识别（需配置 API Key）";
  }
  return "当前环境不支持语音输入";
}

function getBrowserSpeechRecognitionCtor():
  | (new () => SpeechRecognitionLike)
  | undefined {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

export function mapSpeechRecognitionError(error?: string): string {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "麦克风权限被拒绝，请在系统设置中允许访问麦克风";
    case "no-speech":
      return "未检测到语音，请再试一次";
    case "network":
      return "语音识别需要网络连接";
    case "aborted":
      return "已取消语音输入";
    default:
      return error ? `语音识别失败：${error}` : "语音识别失败";
  }
}

export type BrowserSpeechCallbacks = {
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
  onError: (message: string) => void;
  onEnd?: () => void;
};

/** 浏览器 Web Speech API 会话（Chromium / WebView2） */
export class HermesBrowserSpeechSession {
  private rec: SpeechRecognitionLike | null = null;
  private active = false;

  constructor(
    private readonly callbacks: BrowserSpeechCallbacks,
    private readonly lang = "zh-CN",
  ) {}

  get isActive(): boolean {
    return this.active;
  }

  start(): boolean {
    const Ctor = getBrowserSpeechRecognitionCtor();
    if (!Ctor) {
      this.callbacks.onError("当前浏览器不支持语音识别");
      return false;
    }
    this.stop();
    const rec = new Ctor();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i]?.[0]?.transcript?.trim() ?? "";
        if (!piece) continue;
        if (ev.results[i]?.isFinal) {
          this.callbacks.onFinal(piece);
        } else {
          interim = piece;
        }
      }
      this.callbacks.onInterim?.(interim);
    };
    rec.onerror = (ev) => {
      if (ev.error === "aborted") return;
      this.callbacks.onError(mapSpeechRecognitionError(ev.error));
    };
    rec.onend = () => {
      this.active = false;
      this.callbacks.onEnd?.();
    };
    this.rec = rec;
    try {
      rec.start();
      this.active = true;
      return true;
    } catch {
      this.callbacks.onError("无法启动语音识别");
      this.active = false;
      return false;
    }
  }

  stop(): void {
    if (!this.rec) return;
    try {
      this.rec.onend = null;
      this.rec.stop();
    } catch {
      try {
        this.rec.abort();
      } catch {
        /* ignore */
      }
    }
    this.rec = null;
    this.active = false;
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("读取录音失败"));
    reader.readAsDataURL(blob);
  });
}

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

function extensionForMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  return "webm";
}

/** MediaRecorder + Tauri Whisper（OpenAI 兼容 /audio/transcriptions） */
export class HermesWhisperRecorderSession {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private mime = "audio/webm";
  private active = false;

  get isActive(): boolean {
    return this.active;
  }

  async start(onError: (msg: string) => void): Promise<boolean> {
    if (!isTauri()) {
      onError("Whisper 识别需在桌面 App 中使用");
      return false;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      onError("当前环境无法访问麦克风");
      return false;
    }
    this.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickRecorderMime();
      if (!mime) {
        stream.getTracks().forEach((t) => t.stop());
        onError("当前环境不支持录音");
        return false;
      }
      this.mime = mime;
      this.stream = stream;
      this.chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) this.chunks.push(ev.data);
      };
      recorder.start(250);
      this.recorder = recorder;
      this.active = true;
      return true;
    } catch {
      onError("无法访问麦克风，请检查权限");
      return false;
    }
  }

  stop(): void {
    if (this.recorder && this.recorder.state !== "inactive") {
      try {
        this.recorder.stop();
      } catch {
        /* ignore */
      }
    }
    this.recorder = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.active = false;
  }

  async finishAndTranscribe(language = "zh"): Promise<string> {
    if (!this.recorder && this.chunks.length === 0) {
      throw new Error("未录制到音频");
    }
    const recorder = this.recorder;
    const blob = await new Promise<Blob>((resolve, reject) => {
      if (!recorder) {
        resolve(new Blob(this.chunks, { type: this.mime }));
        return;
      }
      recorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: this.mime }));
      };
      recorder.onerror = () => reject(new Error("录音失败"));
      if (recorder.state !== "inactive") {
        recorder.stop();
      } else {
        resolve(new Blob(this.chunks, { type: this.mime }));
      }
    });
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    this.active = false;
    this.chunks = [];

    if (blob.size < 800) {
      throw new Error("录音太短，请多说几句");
    }

    const ext = extensionForMime(this.mime);
    const b64 = await blobToBase64(blob);
    const text = await invoke<string>("transcribe_speech_audio", {
      audioBase64: b64,
      fileName: `speech.${ext}`,
      language,
    });
    return text.trim();
  }
}
