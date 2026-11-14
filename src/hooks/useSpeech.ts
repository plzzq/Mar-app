/* Web Speech API: leitura em voz alta (síntese) e ditado (reconhecimento). */
import { useCallback, useEffect, useRef, useState } from "react";
import { stripMarkdown } from "@/lib/utils";

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/** Controla a leitura em voz alta. `speakingId` identifica qual trecho está sendo lido. */
export function useSpeechSynthesis() {
  const supported = isSpeechSynthesisSupported();
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  const speak = useCallback((text: string, id: string) => {
    if (!isSpeechSynthesisSupported()) return;
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(stripMarkdown(text));
    utterance.lang = "pt-BR";
    utterance.rate = 1;
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("pt"));
    if (voice) utterance.voice = voice;

    const finish = () => setSpeakingId((current) => (current === id ? null : current));
    utterance.onend = finish;
    utterance.onerror = finish;

    setSpeakingId(id);
    synth.speak(utterance);
  }, []);

  return { supported, speakingId, speak, stop };
}

/* ----------------------- Reconhecimento de voz ---------------------- */

interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEventLike {
  results: ArrayLike<RecognitionResultLike>;
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionConstructor = new () => RecognitionLike;

function getRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Captura um trecho falado e entrega o texto reconhecido ao callback. */
export function useSpeechRecognition(onResult: (text: string) => void) {
  const supported = getRecognitionConstructor() !== null;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionConstructor();
    if (!Ctor) {
      setError("O reconhecimento de voz não é suportado neste navegador.");
      return;
    }
    recognitionRef.current?.abort();
    const recognition = new Ctor();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      if (last?.isFinal) onResultRef.current(last[0].transcript.trim());
    };
    recognition.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "Permissão para usar o microfone negada."
          : "Não foi possível capturar a voz. Tente novamente.",
      );
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;

    setError(null);
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
      setError("Não foi possível iniciar o microfone.");
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, error, start, stop };
}
