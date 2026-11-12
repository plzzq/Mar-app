/* Histórico de conversas da Mar.IA (armazenado apenas em memória na demonstração). */
import type { ChatConversation } from "@/types";
import { NotFoundError } from "@/lib/errors";
import { createId, getDemoState, setDemoState, simulateLatency } from "./demo/demoDb";

function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 44 ? `${clean.slice(0, 44)}…` : clean || "Nova conversa";
}

export async function listConversations(): Promise<ChatConversation[]> {
  await simulateLatency(120);
  return [...getDemoState().conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getConversation(id: string): Promise<ChatConversation> {
  await simulateLatency(120);
  const conversation = getDemoState().conversations.find((c) => c.id === id);
  if (!conversation) throw new NotFoundError("Conversa não encontrada.");
  return conversation;
}

export async function createConversation(firstMessage: string): Promise<ChatConversation> {
  await simulateLatency(60);
  const now = new Date().toISOString();
  const conversation: ChatConversation = {
    id: createId("conv"),
    title: deriveTitle(firstMessage),
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  setDemoState((s) => ({ ...s, conversations: [conversation, ...s.conversations] }));
  return conversation;
}

/** Grava a conversa completa (inclui inserção ou atualização). */
export async function saveConversation(conversation: ChatConversation): Promise<void> {
  const updated = { ...conversation, updatedAt: new Date().toISOString() };
  setDemoState((s) => ({
    ...s,
    conversations: s.conversations.some((c) => c.id === conversation.id)
      ? s.conversations.map((c) => (c.id === conversation.id ? updated : c))
      : [updated, ...s.conversations],
  }));
}

/** Renomeia uma conversa (persiste no armazenamento da sessão). */
export async function renameConversation(id: string, title: string): Promise<void> {
  const clean = title.trim();
  if (!clean) throw new Error("Informe um nome para a conversa.");
  await simulateLatency(60);
  setDemoState((s) => ({
    ...s,
    conversations: s.conversations.map((c) => (c.id === id ? { ...c, title: clean.slice(0, 80), updatedAt: new Date().toISOString() } : c)),
  }));
}

export async function deleteConversation(id: string): Promise<void> {
  await simulateLatency(80);
  setDemoState((s) => ({ ...s, conversations: s.conversations.filter((c) => c.id !== id) }));
}
