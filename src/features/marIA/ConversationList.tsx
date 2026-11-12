import { useState, type KeyboardEvent } from "react";
import { Check, MessageSquarePlus, MessageSquare, Pencil, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import { handleListKeys } from "@/lib/keyboard";
import { cn, formatDateTime } from "@/lib/utils";
import { renameConversation } from "@/services/conversationService";
import type { ChatConversation } from "@/types";

interface ConversationListProps {
  conversations: ChatConversation[];
  activeId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function ConversationList({ conversations, activeId, loading, onSelect, onNew, onDelete }: ConversationListProps) {
  const toast = useToast();
  const [toDelete, setToDelete] = useState<ChatConversation | null>(null);
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const term = search.trim().toLowerCase();
  const filtered = term
    ? conversations.filter((c) => c.title.toLowerCase().includes(term) || c.messages.some((m) => m.content.toLowerCase().includes(term)))
    : conversations;

  const startRename = (conversation: ChatConversation) => {
    setRenamingId(conversation.id);
    setRenameValue(conversation.title);
  };

  const confirmRename = async (id: string) => {
    try {
      await renameConversation(id, renameValue);
      toast({ title: "Conversa renomeada", variant: "success" });
    } catch (error) {
      toast({ title: "Não foi possível renomear", description: getErrorMessage(error), variant: "error" });
    } finally {
      setRenamingId(null);
      setRenameValue("");
    }
  };

  const handleListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-conversation]"));
    const index = items.findIndex((item) => item.contains(document.activeElement));
    if (index < 0) return;
    handleListKeys(event, {
      count: items.length,
      index,
      orientation: "vertical",
      onChange: (next) => items[next]?.querySelector<HTMLElement>("button, input")?.focus(),
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 p-3">
        <Button className="w-full" onClick={onNew}>
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          Nova conversa
        </Button>
        <div>
          <label htmlFor="conversation-search" className="sr-only">
            Pesquisar no histórico de conversas
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="conversation-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar conversas…"
              className="block w-full rounded-md border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:border-navy-700 focus:outline-none focus:ring-1 focus:ring-navy-700"
            />
          </div>
        </div>
      </div>

      <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Histórico{term && <span className="ml-1 font-normal normal-case">({filtered.length} resultado(s))</span>}
      </p>

      {conversations.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">Nenhuma conversa ainda. Faça a primeira pergunta para começar.</p>
      ) : filtered.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">Nenhuma conversa corresponde a “{search}”.</p>
      ) : (
        <ul
          className="flex-1 space-y-1 overflow-y-auto px-2 pb-3"
          aria-label="Conversas anteriores"
          onKeyDown={handleListKeyDown}
        >
          {filtered.map((c) => {
            const active = c.id === activeId;
            const renaming = renamingId === c.id;
            return (
              <li key={c.id} data-conversation className="group relative">
                {renaming ? (
                  <div className="space-y-1 rounded-md px-2 py-2 ring-1 ring-inset ring-navy-300">
                    <label htmlFor={`rename-${c.id}`} className="sr-only">
                      Novo nome da conversa
                    </label>
                    <input
                      id={`rename-${c.id}`}
                      value={renameValue}
                      maxLength={80}
                      autoFocus
                      onChange={(event) => setRenameValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void confirmRename(c.id);
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          event.stopPropagation();
                          setRenamingId(null);
                        }
                      }}
                      className="block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-navy-700 focus:outline-none focus:ring-1 focus:ring-navy-700"
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => void confirmRename(c.id)}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-navy-800 px-2 py-1 text-xs font-semibold text-white hover:bg-navy-700"
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onSelect(c.id)}
                      aria-current={active ? "true" : undefined}
                      disabled={loading}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-md px-3 py-2.5 pr-16 text-left transition-colors",
                        active ? "bg-navy-50 text-navy-900 ring-1 ring-inset ring-navy-200" : "text-slate-700 hover:bg-slate-100",
                      )}
                    >
                      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{c.title}</span>
                        <span className="block text-xs text-slate-500">
                          {formatDateTime(c.updatedAt)} · {c.messages.length} mensagens
                        </span>
                      </span>
                    </button>
                    <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={() => startRename(c)}
                        aria-label={`Renomear conversa ${c.title}`}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800 focus-visible:opacity-100"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setToDelete(c)}
                        aria-label={`Excluir conversa ${c.title}`}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 focus-visible:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir conversa?"
        description={`A conversa “${toDelete?.title ?? ""}” será removida do histórico desta sessão. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        tone="danger"
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) onDelete(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
}
