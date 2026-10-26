/* ------------------------------------------------------------------ */
/* Armazenamento local versionado (etapa anterior ao Supabase).       */
/* - Persiste em localStorage APENAS como cache local temporário,     */
/*   com versão e restauração ao estado inicial.                      */
/* - A fonte oficial será o Supabase: os serviços mantêm as mesmas    */
/*   assinaturas e delegarão aos repositórios (services/supabase).    */
/* - Chave e versão permitem migração sem perda: ao recarregar, o     */
/*   estado do usuário é recuperado; "Restaurar" volta aos seeds.     */
/* ------------------------------------------------------------------ */
import type {
  AppNotification,
  ChatConversation,
  HistoryEntry,
  Material,
  ProductionRequest,
  StockMovement,
  UserProfile,
} from "@/types";
import {
  DEMO_CONVERSATIONS,
  DEMO_HISTORY,
  DEMO_MATERIALS,
  DEMO_MOVEMENTS,
  DEMO_NOTIFICATIONS,
  DEMO_REQUESTS,
  DEMO_USER,
  DEMO_USERS,
} from "./demoData";

export interface DemoState {
  materials: Material[];
  movements: StockMovement[];
  requests: ProductionRequest[];
  history: HistoryEntry[];
  notifications: AppNotification[];
  conversations: ChatConversation[];
  user: UserProfile;
  users: UserProfile[];
  /** Chaves de idempotência já processadas (anti clique-duplo). */
  processedKeys: string[];
}

const STORAGE_KEY = "mare:state:v2";
const STATE_VERSION = 2;

function createInitialState(): DemoState {
  return structuredClone({
    materials: DEMO_MATERIALS,
    movements: DEMO_MOVEMENTS,
    requests: DEMO_REQUESTS,
    history: DEMO_HISTORY,
    notifications: DEMO_NOTIFICATIONS,
    conversations: DEMO_CONVERSATIONS,
    user: DEMO_USER,
    users: DEMO_USERS,
    processedKeys: [],
  });
}

function loadPersistedState(): DemoState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version: number; state: DemoState };
    if (parsed.version !== STATE_VERSION || !parsed.state) return null;
    // Mescla defensiva: garante campos novos mesmo com cache antigo.
    const fresh = createInitialState();
    return { ...fresh, ...parsed.state, users: DEMO_USERS };
  } catch {
    return null;
  }
}

let state: DemoState = loadPersistedState() ?? createInitialState();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STATE_VERSION, state }));
  } catch {
    // Cache cheio ou indisponível: a sessão continua em memória.
  }
}

/** Snapshot atual (tratar como somente leitura). */
export function getDemoState(): DemoState {
  return state;
}

/** Atualiza o estado de forma imutável, persiste o cache e notifica as telas. */
export function setDemoState(updater: (current: DemoState) => DemoState): void {
  state = updater(state);
  persist();
  emit();
}

/** Substitui o estado inteiro (usado pelo Desfazer e pela restauração). */
export function replaceDemoState(next: DemoState): void {
  state = next;
  persist();
  emit();
}

export function subscribeDemo(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Restaura os dados de demonstração originais e limpa o cache local. */
export function resetDemoState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* sem cache */
  }
  state = createInitialState();
  emit();
}

/**
 * Registra uma chave de idempotência. Retorna false se a operação
 * já foi processada (clique duplo, retry de rede) — o chamador deve
 * então ignorar a repetição sem erro.
 */
export function consumeIdempotencyKey(key: string): boolean {
  if (!key) return true;
  if (state.processedKeys.includes(key)) return false;
  state = { ...state, processedKeys: [...state.processedKeys.slice(-500), key] };
  persist();
  return true;
}

/** Simula a latência de uma chamada de rede (permite testar estados de carregamento). */
export function simulateLatency(ms = 220): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Chave de idempotência para uma nova operação (gerar ao abrir o diálogo). */
export function createOperationKey(): string {
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Gera o próximo código de solicitação (ex.: SOL-2026-015). */
export function nextRequestCode(requests: ProductionRequest[]): string {
  const year = new Date().getFullYear();
  const max = requests.reduce((acc, request) => {
    const match = /-(\d+)$/.exec(request.code);
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 0);
  return `SOL-${year}-${String(max + 1).padStart(3, "0")}`;
}

/** Gera o próximo código de material (ex.: MAT-2017). */
export function nextMaterialCode(materials: Material[]): string {
  const max = materials.reduce((acc, material) => {
    const match = /-(\d+)$/.exec(material.code);
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 2000);
  return `MAT-${max + 1}`;
}
