import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { History, Plus, X } from "lucide-react";
import { MarIAMark } from "@/components/common/MareLogo";
import { AccessibilityPanel } from "@/components/accessibility/AccessibilityPanel";
import { Badge, Button, LoadingState } from "@/components/ui";
import { useAnnounce } from "@/contexts/AnnouncerContext";
import { useToast } from "@/contexts/ToastContext";
import { ChatComposer } from "@/features/marIA/ChatComposer";
import { ChatMessageItem } from "@/features/marIA/ChatMessageItem";
import { ConversationList } from "@/features/marIA/ConversationList";
import { useChat } from "@/features/marIA/useChat";
import { WelcomeScreen } from "@/features/marIA/WelcomeScreen";
import { useQuery } from "@/hooks/useQuery";
import { handleListKeys } from "@/lib/keyboard";
import { stripMarkdown } from "@/lib/utils";
import { deleteConversation, listConversations } from "@/services/conversationService";
import { marIAService } from "@/services/marIA";

export function MarIAPage() {
  const announce = useAnnounce();
  const toast = useToast();
  const chat = useChat();
  const conversations = useQuery(listConversations);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [a11yOpen, setA11yOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const announcedRef = useRef<string | null>(null);
  const isDemo = marIAService.mode === "demo";

  const { messages, isGenerating, notice, send, stop, retry, setFeedback, newConversation, openConversation, conversation } = chat;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: isGenerating ? "auto" : "smooth" });
  }, [messages, isGenerating]);

  // Anúncio não intrusivo: apenas quando a resposta termina (nunca durante o streaming).
  useEffect(() => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    const finished = last.status === "done" || last.status === "stopped" || last.status === "error";
    if (!finished) return;
    const key = `${last.id}:${last.status}`;
    if (announcedRef.current === key) return;
    announcedRef.current = key;
    if (last.status === "error") {
      announce(`Erro ao obter a resposta da Mar.IA: ${last.errorMessage ?? "falha desconhecida"}.`, { assertive: true });
    } else {
      const firstLine = stripMarkdown(last.content).split(/[.!?\n]/)[0]?.slice(0, 180);
      announce(
        last.status === "stopped"
          ? "Resposta da Mar.IA interrompida."
          : `Nova resposta da Mar.IA disponível.${firstLine ? ` ${firstLine}.` : ""}`,
      );
    }
  }, [messages, announce]);

  useEffect(() => {
    if (!historyOpen) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setHistoryOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [historyOpen]);

  const handleSelect = useCallback(
    async (id: string) => {
      setHistoryOpen(false);
      await openConversation(id);
      announce("Conversa aberta.");
    },
    [openConversation, announce],
  );

  const handleSend = useCallback(
    (text: string) => {
      void send(text);
      announce("Mensagem enviada. Mar.IA está processando…");
    },
    [send, announce],
  );

  const handleFeedback = useCallback(
    (messageId: string, value: "up" | "down" | null) => {
      setFeedback(messageId, value);
      announce(value ? "Avaliação registrada. Obrigado pelo feedback." : "Avaliação removida.");
    },
    [setFeedback, announce],
  );

  const handleDelete = async (id: string) => {
    try {
      await deleteConversation(id);
      if (conversation?.id === id) newConversation();
      toast({ title: "Conversa excluída", variant: "success" });
      announce("Conversa excluída.");
    } catch (error) {
      toast({ title: "Não foi possível excluir", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  };

  /** Navegação por setas/Home/End entre as mensagens da conversa. */
  const handleLogKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-message-item]"));
    const index = items.findIndex((item) => item.contains(document.activeElement));
    if (index < 0) return;
    handleListKeys(event, {
      count: items.length,
      index,
      orientation: "vertical",
      onChange: (next) => items[next]?.focus(),
    });
  };

  const historyList = (
    <ConversationList
      conversations={conversations.data ?? []}
      activeId={conversation?.id ?? null}
      loading={chat.loadingConversation}
      onSelect={handleSelect}
      onNew={() => {
        newConversation();
        setHistoryOpen(false);
        announce("Nova conversa iniciada.");
      }}
      onDelete={handleDelete}
    />
  );

  return (
    <div className="flex min-h-[calc(100dvh-var(--topbar-h)-2.5rem)] flex-col gap-3">
      <a
        href="#conversa"
        className="sr-only focus:not-sr-only focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-navy-900 focus:shadow-lg"
      >
        Pular para a conversa
      </a>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MarIAMark className="h-9 w-9 lg:h-10 lg:w-10" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-navy-900 lg:text-xl">Mar.IA</h1>
              {isDemo ? <Badge tone="warning">Demonstração</Badge> : <Badge tone="success">Conectada</Badge>}
            </div>
            <p className="text-sm text-slate-600">Assistente operacional para PCP, almoxarifado e logística.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)} className="lg:hidden">
            <History className="h-4 w-4" aria-hidden="true" />
            Histórico
          </Button>
          <Button variant="outline" size="sm" onClick={() => setA11yOpen(true)}>
            Acessibilidade
          </Button>
        </div>
      </div>

      {isDemo && (
        <></>
      )}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside aria-label="Histórico de conversas" className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white lg:flex lg:min-h-0 lg:flex-col">
          {historyList}
        </aside>

        <section
          id="conversa"
          aria-label="Conversa com a Mar.IA"
          tabIndex={-1}
          className="flex min-h-[440px] min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50 lg:min-h-0"
        >
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{conversation?.title ?? "Nova conversa"}</p>
              <p className="text-xs text-slate-500" role="status">
                {isGenerating ? "Mar.IA está gerando a resposta…" : "Pronta para responder"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                newConversation();
                announce("Nova conversa iniciada.");
              }}
              disabled={messages.length === 0 && !isGenerating}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Nova conversa</span>
            </Button>
          </header>

          <div
            ref={scrollRef}
            role="log"
            aria-live="off"
            aria-busy={isGenerating}
            aria-label="Mensagens da conversa"
            className="flex-1 overflow-y-auto px-3 py-4 md:px-4"
          >
            {chat.loadingConversation ? (
              <LoadingState label="Abrindo conversa…" rows={2} />
            ) : messages.length === 0 ? (
              <WelcomeScreen onPick={(prompt) => handleSend(prompt)} />
            ) : (
              <ul
                className="mx-auto max-w-4xl space-y-6"
                aria-label="Mensagens da conversa. Use as setas ↑ e ↓ para navegar entre elas."
                onKeyDown={handleLogKeyDown}
              >
                {messages.map((m, index) => (
                  <li
                    key={m.id}
                    data-message-item
                    tabIndex={index === messages.length - 1 ? 0 : -1}
                    className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-navy-700"
                  >
                    <ChatMessageItem message={m} onRetry={retry} onFeedback={handleFeedback} />
                  </li>
                ))}
              </ul>
            )}
            {notice && (
              <p role="alert" className="mx-auto mt-4 max-w-4xl rounded-md bg-rose-50 p-3 text-sm text-rose-800">
                {notice}
              </p>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2.5">
            <div className="mx-auto max-w-4xl">
              <ChatComposer generating={isGenerating} onSend={handleSend} onStop={stop} />
            </div>
          </div>
        </section>
      </div>

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Histórico de conversas">
          <button type="button" aria-label="Fechar histórico" className="absolute inset-0 bg-slate-900/50" onClick={() => setHistoryOpen(false)} />
          <div className="animate-fade-up relative ml-auto flex h-full w-[min(88vw,340px)] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="font-semibold text-navy-900">Histórico</p>
              <button type="button" onClick={() => setHistoryOpen(false)} className="rounded-md p-2 hover:bg-slate-100" aria-label="Fechar histórico" autoFocus>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {historyList}
          </div>
        </div>
      )}

      <AccessibilityPanel open={a11yOpen} onClose={() => setA11yOpen(false)} />
    </div>
  );
}
