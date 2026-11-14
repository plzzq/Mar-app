/* ------------------------------------------------------------------ */
/* Estado da conversa com a Mar.IA: envio, streaming, interrupção,      */
/* nova conversa, reabertura de histórico, "tentar novamente" e        */
/* avaliação de respostas. Usa a fachada marIAService: trocar o        */
/* provedor não altera esta tela.                                     */
/* ------------------------------------------------------------------ */
import { useCallback, useRef, useState } from "react";
import { createConversation, getConversation, saveConversation } from "@/services/conversationService";
import { marIAService, MarIAError } from "@/services/marIA";
import { getErrorMessage } from "@/lib/errors";
import type { ChatConversation, ChatMessage } from "@/types";

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useChat() {
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const conversationRef = useRef<ChatConversation | null>(null);
  const generatingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const replace = useCallback((next: ChatConversation | null) => {
    conversationRef.current = next;
    setConversation(next);
  }, []);

  const patchMessage = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      const base = conversationRef.current;
      if (!base) return;
      replace({ ...base, messages: base.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
    },
    [replace],
  );

  const persist = useCallback(() => {
    const current = conversationRef.current;
    if (current) void saveConversation(current);
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || generatingRef.current) return;

      generatingRef.current = true;
      setIsGenerating(true);
      setNotice(null);

      try {
        if (!conversationRef.current) {
          replace(await createConversation(text));
        }
        const base = conversationRef.current;
        if (!base) return;

        const history = base.messages.filter((m) => m.status !== "error");
        const now = new Date().toISOString();
        const userMessage: ChatMessage = { id: newId("user"), role: "user", content: text, createdAt: now, status: "done" };
        const assistantId = newId("assistant");
        const assistantMessage: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: now,
          status: "streaming",
          mode: marIAService.mode,
        };
        replace({ ...base, messages: [...base.messages, userMessage, assistantMessage] });
        // Persiste a pergunta imediatamente: em caso de falha, o texto não se perde.
        persist();

        const controller = new AbortController();
        abortRef.current = controller;
        let accumulated = "";

        try {
          const response = await marIAService.ask(
            { conversationId: base.id, message: text, history, signal: controller.signal },
            (chunk) => {
              accumulated += chunk;
              patchMessage(assistantId, { content: accumulated });
            },
          );
          patchMessage(assistantId, { content: response.content, status: "done", mode: response.mode });
        } catch (err) {
          if (err instanceof MarIAError && err.code === "aborted") {
            patchMessage(assistantId, { content: accumulated, status: "stopped" });
          } else {
            const e = err instanceof MarIAError ? err : new MarIAError("unknown", getErrorMessage(err));
            // Mantém o conteúdo já gerado (se houver) e marca erro recuperável.
            patchMessage(assistantId, { content: accumulated, status: "error", errorCode: e.code, errorMessage: e.message });
          }
        } finally {
          abortRef.current = null;
          persist();
        }
      } catch (err) {
        setNotice(getErrorMessage(err));
      } finally {
        generatingRef.current = false;
        setIsGenerating(false);
      }
    },
    [patchMessage, persist, replace],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** Remove a resposta com erro e reenvia a pergunta correspondente. */
  const retry = useCallback(
    (assistantId: string) => {
      const base = conversationRef.current;
      if (!base || generatingRef.current) return;
      const index = base.messages.findIndex((m) => m.id === assistantId);
      const previous = base.messages[index - 1];
      if (index < 1 || !previous || previous.role !== "user") return;
      replace({ ...base, messages: base.messages.filter((_, i) => i !== index && i !== index - 1) });
      void send(previous.content);
    },
    [replace, send],
  );

  /** Registra (ou remove) a avaliação de uma resposta da IA. */
  const setFeedback = useCallback(
    (messageId: string, value: "up" | "down" | null) => {
      const base = conversationRef.current;
      if (!base) return;
      patchMessage(messageId, { feedback: value ?? undefined });
      persist();
    },
    [patchMessage, persist],
  );

  const newConversation = useCallback(() => {
    abortRef.current?.abort();
    replace(null);
    setNotice(null);
  }, [replace]);

  const openConversation = useCallback(
    async (id: string) => {
      abortRef.current?.abort();
      setLoadingConversation(true);
      setNotice(null);
      try {
        replace(await getConversation(id));
      } catch (err) {
        setNotice(getErrorMessage(err));
      } finally {
        setLoadingConversation(false);
      }
    },
    [replace],
  );

  return {
    conversation,
    messages: conversation?.messages ?? [],
    isGenerating,
    loadingConversation,
    notice,
    send,
    stop,
    retry,
    setFeedback,
    newConversation,
    openConversation,
  };
}
