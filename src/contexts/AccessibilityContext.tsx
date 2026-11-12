/* ------------------------------------------------------------------ */
/* Preferências de acessibilidade — aplicadas globalmente e persistidas*/
/* por usuário (localStorage como cache local; a integração futura    */
/* usará a tabela user_preferences do Supabase, mesma assinatura).    */
/* ------------------------------------------------------------------ */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";

export type Theme = "claro" | "escuro";
export type Contrast = "normal" | "alto";
export type LineSpacing = "apertado" | "normal" | "folgado";

export interface A11yPrefs {
  /** Escala global da interface (100% = padrão). */
  fontScale: number;
  lineSpacing: LineSpacing;
  theme: Theme;
  contrast: Contrast;
  reduceMotion: boolean;
  linkHighlight: boolean;
  largeTargets: boolean;
  readableFont: boolean;
  sound: boolean;
  /** Duração dos avisos temporários (toasts). */
  toastDuration: number;
  /** Enter envia a mensagem na Mar.IA (quando desativado: Ctrl+Enter envia). */
  enterSends: boolean;
}

export const A11Y_DEFAULTS: A11yPrefs = {
  fontScale: 100,
  lineSpacing: "normal",
  theme: "claro",
  contrast: "normal",
  reduceMotion: false,
  linkHighlight: false,
  largeTargets: false,
  readableFont: false,
  sound: false,
  toastDuration: 4500,
  enterSends: true,
};

export const FONT_SCALES = [90, 100, 112, 125, 150];

const LINE_HEIGHTS: Record<LineSpacing, string> = {
  apertado: "1.35",
  normal: "1.55",
  folgado: "1.9",
};

const STORAGE_PREFIX = "mare:a11y:v1:";

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function matchMediaSafe(query: string): boolean {
  return typeof window !== "undefined" && window.matchMedia(query).matches;
}

function loadPrefs(userId: string): A11yPrefs {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) return { ...A11Y_DEFAULTS, ...(JSON.parse(raw) as Partial<A11yPrefs>) };
  } catch {
    /* cache inválido: cai nos padrões */
  }
  // Primeiro acesso: respeita as preferências do sistema operacional.
  return {
    ...A11Y_DEFAULTS,
    reduceMotion: matchMediaSafe("(prefers-reduced-motion: reduce)"),
    contrast: matchMediaSafe("(prefers-contrast: more)") ? "alto" : "normal",
  };
}

interface AccessibilityContextValue {
  prefs: A11yPrefs;
  setPref: <K extends keyof A11yPrefs>(key: K, value: A11yPrefs[K]) => void;
  resetDefaults: () => void;
  /** Toca um aviso sonoro curto (somente se o usuário ativou avisos sonoros). */
  notifySound: (kind?: "ok" | "error" | "info") => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

let audioContext: AudioContext | null = null;

function chime(kind: "ok" | "error" | "info"): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioContext ??= new Ctor();
    const ctx = audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const config =
      kind === "error"
        ? { freq: 220, type: "sawtooth" as OscillatorType, duration: 0.22 }
        : kind === "ok"
          ? { freq: 740, type: "sine" as OscillatorType, duration: 0.16 }
          : { freq: 520, type: "sine" as OscillatorType, duration: 0.12 };
    osc.type = config.type;
    osc.frequency.value = config.freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + config.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + config.duration + 0.02);
  } catch {
    /* sem áudio disponível: falha silenciosa */
  }
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<A11yPrefs>(() => loadPrefs(user.id));

  // Recarrega as preferências quando o perfil ativo muda.
  useEffect(() => {
    setPrefs(loadPrefs(user.id));
  }, [user.id]);

  // Aplica as preferências no documento.
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = `${prefs.fontScale}%`;
    root.style.setProperty("--a11y-line", LINE_HEIGHTS[prefs.lineSpacing]);
    root.dataset.theme = prefs.theme;
    root.dataset.contrast = prefs.contrast;
    root.dataset.motion = prefs.reduceMotion ? "reduced" : "normal";
    root.dataset.links = prefs.linkHighlight ? "highlight" : "normal";
    root.dataset.targets = prefs.largeTargets ? "large" : "normal";
    root.dataset.font = prefs.readableFont ? "readable" : "default";
  }, [prefs]);

  // Persiste as preferências do usuário atual.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey(user.id), JSON.stringify(prefs));
    } catch {
      /* sem armazenamento: segue na memória */
    }
  }, [prefs, user.id]);

  // Se o sistema operacional mudar a preferência (antes de o usuário definir a sua), reage.
  useEffect(() => {
    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const contrastMq = window.matchMedia("(prefers-contrast: more)");
    const stored = localStorage.getItem(storageKey(user.id));
    const onChange = () => {
      if (stored) return; // usuário já definiu explicitamente
      setPrefs((current) => ({
        ...current,
        reduceMotion: motionMq.matches,
        contrast: contrastMq.matches ? "alto" : "normal",
      }));
    };
    motionMq.addEventListener("change", onChange);
    contrastMq.addEventListener("change", onChange);
    return () => {
      motionMq.removeEventListener("change", onChange);
      contrastMq.removeEventListener("change", onChange);
    };
  }, [user.id]);

  const setPref = useCallback(<K extends keyof A11yPrefs>(key: K, value: A11yPrefs[K]) => {
    setPrefs((current) => ({ ...current, [key]: value }));
  }, []);

  const resetDefaults = useCallback(() => {
    setPrefs({
      ...A11Y_DEFAULTS,
      reduceMotion: matchMediaSafe("(prefers-reduced-motion: reduce)"),
      contrast: matchMediaSafe("(prefers-contrast: more)") ? "alto" : "normal",
    });
  }, []);

  const notifySound = useCallback(
    (kind: "ok" | "error" | "info" = "info") => {
      if (prefs.sound) chime(kind);
    },
    [prefs.sound],
  );

  const value = useMemo(
    () => ({ prefs, setPref, resetDefaults, notifySound }),
    [prefs, setPref, resetDefaults, notifySound],
  );

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibility(): AccessibilityContextValue {
  const context = useContext(AccessibilityContext);
  if (!context) throw new Error("useAccessibility deve ser usado dentro de AccessibilityProvider.");
  return context;
}
