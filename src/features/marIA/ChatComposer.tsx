import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Mic, MicOff, Send, Square } from "lucide-react";
import { Button } from "@/components/ui";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { useSpeechRecognition } from "@/hooks/useSpeech";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 4000;

interface ChatComposerProps {
  generating: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

/**
 * Campo de mensagem acessível:
 * - Enter envia (opcional configurável) ou quebra linha;
 * - Shift+Enter sempre quebra linha; Ctrl+Enter sempre envia;
 * - botão de envio permanece focável (aria-disabled) para não perder o foco;
 * - texto preservado, proteção contra envio duplicado, contador e dica de atalhos.
 */
export function ChatComposer({ generating, onSend, onStop }: ChatComposerProps) {
  const { prefs } = useAccessibility();
  const [value, setValue] = useState("");
  const [attempted, setAttempted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendOnEnter = prefs.enterSends;

  const voice = useSpeechRecognition((text) => {
    setValue((current) => (current ? `${current} ${text}` : text).slice(0, MAX_LENGTH));
  });

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && !generating;

  const submit = () => {
    if (!canSend) {
      setAttempted(true);
      textareaRef.current?.focus();
      return;
    }
    setAttempted(false);
    onSend(value);
    setValue("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter envia sempre, em qualquer configuração.
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      if (sendOnEnter) {
        event.preventDefault();
        submit();
      }
      // Com "Enter envia" desativado, Enter quebra linha normalmente.
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const emptyError = attempted && value.trim().length === 0;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div
        className={cn(
          "flex items-end gap-1.5 rounded-md border bg-white p-1.5 transition focus-within:border-navy-700 focus-within:ring-1 focus-within:ring-navy-700",
          voice.listening ? "border-rose-500" : "border-slate-300",
          emptyError && "border-rose-600",
        )}
      >
        <label htmlFor="mar-ia-input" className="sr-only">
          Mensagem para a Mar.IA
        </label>
        <textarea
          id="mar-ia-input"
          ref={textareaRef}
          rows={1}
          value={value}
          maxLength={MAX_LENGTH}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte sobre demandas, prazos, estoque ou PCP…"
          aria-describedby="mar-ia-hint"
          aria-invalid={emptyError ? true : undefined}
          aria-keyshortcuts="Control+Enter"
          aria-busy={generating || undefined}
          className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none lg:text-sm"
        />
        {voice.supported && (
          <button
            type="button"
            onClick={() => (voice.listening ? voice.stop() : voice.start())}
            aria-pressed={voice.listening}
            aria-label={voice.listening ? "Parar ditado por voz" : "Ditar mensagem por voz"}
            title={voice.listening ? "Parar ditado" : "Ditar por voz"}
            data-compact
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition",
              voice.listening ? "bg-rose-600 text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {voice.listening ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
        {generating ? (
          <Button variant="outline" onClick={onStop} aria-label="Interromper geração da resposta" data-compact className="h-10 shrink-0 px-3">
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            <span className="hidden sm:inline">Interromper</span>
          </Button>
        ) : (
          <Button
            type="submit"
            aria-disabled={!canSend}
            aria-label="Enviar mensagem"
            title={canSend ? "Enviar mensagem (Enter)" : "Digite uma mensagem para enviar"}
            data-compact
            className="h-10 w-10 shrink-0 px-0"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      <div id="mar-ia-hint" className="mt-1.5 flex flex-wrap items-center justify-between gap-2 px-0.5 text-xs text-slate-500">
        <span className="min-h-4">
          {emptyError ? (
            <span role="alert" className="font-medium text-rose-700">
              Digite uma mensagem para enviar.
            </span>
          ) : sendOnEnter ? (
            <>
              <kbd className="rounded border border-slate-300 bg-white px-1">Enter</kbd> envia ·{" "}
              <kbd className="rounded border border-slate-300 bg-white px-1">Shift</kbd>+<kbd className="rounded border border-slate-300 bg-white px-1">Enter</kbd> quebra
              linha
            </>
          ) : (
            <>
              <kbd className="rounded border border-slate-300 bg-white px-1">Enter</kbd> quebra linha ·{" "}
              <kbd className="rounded border border-slate-300 bg-white px-1">Ctrl</kbd>+<kbd className="rounded border border-slate-300 bg-white px-1">Enter</kbd> envia
            </>
          )}
        </span>
        <span className="tabular-nums">
          {voice.error ? <span className="font-medium text-rose-700">{voice.error}</span> : voice.listening ? "Ouvindo…" : `${value.length}/${MAX_LENGTH}`}
        </span>
      </div>
    </form>
  );
}
