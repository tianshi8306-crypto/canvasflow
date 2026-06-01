import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HermesBrowserSpeechSession,
  HermesWhisperRecorderSession,
  hermesVoiceUnsupportedHint,
  resolveHermesVoiceBackend,
  type HermesVoiceBackend,
  type HermesVoiceInputStatus,
} from "@/lib/hermes/hermesVoiceInput";

type Options = {
  disabled?: boolean;
  lang?: string;
  onAppendText: (text: string) => void;
  onInterimText?: (text: string) => void;
  onError?: (message: string) => void;
};

export function useHermesVoiceInput(opts: Options) {
  const {
    disabled = false,
    lang = "zh-CN",
    onAppendText,
    onInterimText,
    onError,
  } = opts;

  const backend = useMemo(() => resolveHermesVoiceBackend(), []);
  const supported = backend !== "none";
  const unsupportedHint = useMemo(() => hermesVoiceUnsupportedHint(), []);

  const [status, setStatus] = useState<HermesVoiceInputStatus>("idle");
  const browserRef = useRef<HermesBrowserSpeechSession | null>(null);
  const whisperRef = useRef<HermesWhisperRecorderSession | null>(null);

  const stopListening = useCallback(() => {
    browserRef.current?.stop();
    browserRef.current = null;
    whisperRef.current?.stop();
    whisperRef.current = null;
    onInterimText?.("");
    setStatus("idle");
  }, [onInterimText]);

  useEffect(() => () => {
    browserRef.current?.stop();
    whisperRef.current?.stop();
  }, []);

  const toggle = useCallback(async () => {
    if (disabled || !supported) return;

    if (status === "listening") {
      if (backend === "whisper" && whisperRef.current) {
        setStatus("transcribing");
        onInterimText?.("");
        try {
          const text = await whisperRef.current.finishAndTranscribe(
            lang.startsWith("zh") ? "zh" : undefined,
          );
          whisperRef.current = null;
          if (text) onAppendText(text);
          else onError?.("未识别到内容");
        } catch (e) {
          onError?.(e instanceof Error ? e.message : "语音识别失败");
        } finally {
          setStatus("idle");
        }
        return;
      }
      stopListening();
      return;
    }

    if (backend === "browser") {
      onInterimText?.("");
      const session = new HermesBrowserSpeechSession(
        {
          onFinal: (text) => {
            if (text.trim()) onAppendText(text.trim());
          },
          onInterim: (text) => onInterimText?.(text),
          onError: (msg) => {
            onError?.(msg);
            stopListening();
          },
          onEnd: () => {
            if (browserRef.current === session) {
              browserRef.current = null;
              setStatus("idle");
              onInterimText?.("");
            }
          },
        },
        lang,
      );
      browserRef.current = session;
      const ok = session.start();
      if (ok) setStatus("listening");
      else browserRef.current = null;
      return;
    }

    if (backend === "whisper") {
      onInterimText?.("");
      const session = new HermesWhisperRecorderSession();
      whisperRef.current = session;
      const ok = await session.start((msg) => {
        onError?.(msg);
        whisperRef.current = null;
        setStatus("idle");
      });
      if (ok) setStatus("listening");
      else whisperRef.current = null;
    }
  }, [
    backend,
    disabled,
    lang,
    onAppendText,
    onError,
    onInterimText,
    status,
    stopListening,
    supported,
  ]);

  const title =
    status === "transcribing"
      ? "识别中…"
      : status === "listening"
        ? backend === "whisper"
          ? "录音中，点击停止并识别"
          : "正在听，点击停止"
        : supported
          ? unsupportedHint
            ? `语音输入（${unsupportedHint}）`
            : "语音输入"
          : hermesVoiceUnsupportedHint();

  return {
    backend: backend as HermesVoiceBackend,
    supported,
    status,
    isListening: status === "listening",
    isBusy: status === "transcribing",
    toggle,
    title,
  };
}
