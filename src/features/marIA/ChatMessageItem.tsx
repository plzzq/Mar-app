import { useState } from "react";
import { AlertCircle, Copy, Check, RotateCcw, ThumbsDown, ThumbsUp, Volume2, VolumeX } from "lucide-react";
import { MarIAMark } from "@/components/common/MareLogo";
import { Badge, Button } from "@/components/ui";
import { useToast } from "@/contexts/ToastContext";
import { useSpeechSynthesis } from "@/hooks/useSpeech";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types";
import { MarkdownContent } from "./MarkdownContent";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const ERROR_TITLES: Record<string, string> = {
  rate_limit: "Limite de requisições atingido",
  not_configured: "IA real não configurada",
  network: "Falha de conexão",
  unavailable: "Serviço indisponível",
};

export interface ChatMessageItemProps {
  message: ChatMessage;
  onRetry: (id: string) => void;
  onFeedback?: (id: string, value: "up" | "down" | null) => void;
}

export function ChatMessageItem({ message, onRetry, onFeedback }: ChatMessageItemProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-md rounded-br-sm bg-navy-800 px-3.5 py-2.5 text-sm text-white shadow-sm md:max-w-[75%]">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          <time dateTime={message.createdAt} className="mt-1 block text-right text-[10px] text-sky-200">
            {formatTime(message.createdAt)}
          </time>
        </div>
      </div>
    );
  }

  return <AssistantMessage message={message} onRetry={onRetry} onFeedback={onFeedback} />;
}

function AssistantMessage({ message, onRetry, onFeedback }: ChatMessageItemProps) {
  const toast = useToast();
  const speech = useSpeechSynthesis();
  const [copied, setCopied] = useState(false);
  const isError = message.status === "error";
  const isStreaming = message.status === "streaming";
  const speaking = speech.speakingId === message.id;
  const finished = message.status === "done" || message.status === "stopped";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast({ title: "Resposta copiada", variant: "success" });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Não foi possível copiar", description: "Selecione o texto e copie manualmente.", variant: "error" });
    }
  };

  const feedbackButton = (value: "up" | "down", label: string) => {
    const active = message.feedback === value;
    const Icon = value === "up" ? ThumbsUp : ThumbsDown;
    return (
      <button
        type="button"
        aria-pressed={active}
        aria-label={`${label}${active ? " (selecionado)" : ""}`}
        onClick={() => onFeedback?.(message.id, active ? null : value)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
          active ? "bg-navy-50 text-navy-800 ring-1 ring-inset ring-navy-200" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {value === "up" ? "Útil" : "Revisar"}
      </button>
    );
  };

  return (
    <div className="flex gap-2.5">
      <MarIAMark className="mt-0.5 h-7 w-7 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-navy-800">Mar.IA</span>
          {message.mode === "demo" && <Badge tone="info">Demonstração</Badge>}
          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
        </div>

        <div
          className={cn(
            "mt-1.5 rounded-md border bg-white px-3.5 py-3 shadow-sm",
            isError ? "border-rose-300" : "border-slate-200",
          )}
        >
          {isError ? (
            <div className="space-y-3">
              <div className="flex gap-2 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-rose-900">{ERROR_TITLES[message.errorCode ?? ""] ?? "Não foi possível responder"}</p>
                  <p className="mt-0.5 text-slate-700">{message.errorMessage ?? "Tente novamente em instantes."}</p>
                  {message.content && <p className="mt-2 text-xs text-slate-500">Parte da resposta já gerada foi preservada abaixo.</p>}
                </div>
              </div>
              {message.content && <MarkdownContent content={message.content} />}
              <Button variant="outline" size="sm" onClick={() => onRetry(message.id)}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Tentar novamente
              </Button>
            </div>
          ) : isStreaming && !message.content ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="flex gap-1" aria-hidden="true">
                <span className="h-2 w-2 animate-bounce rounded-full bg-navy-500 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-navy-500 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-navy-500" />
              </span>
              <span role="status">Mar.IA está processando…</span>
            </div>
          ) : (
            <>
              <MarkdownContent content={message.content} />
              {isStreaming && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-navy-700 align-middle" aria-hidden="true" />}
              {message.status === "stopped" && <p className="mt-2 text-xs italic text-slate-500">Geração interrompida pelo usuário.</p>}
            </>
          )}
        </div>

        {finished && message.content && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
            {speech.supported && (
              <button
                type="button"
                onClick={() => (speaking ? speech.stop() : speech.speak(message.content, message.id))}
                aria-pressed={speaking}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {speaking ? <VolumeX className="h-3.5 w-3.5" aria-hidden="true" /> : <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />}
                {speaking ? "Parar leitura" : "Ouvir"}
              </button>
            )}
            {onFeedback && (
              <>
                {feedbackButton("up", "Avaliar resposta como útil")}
                {feedbackButton("down", "Marcar resposta para revisão")}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
