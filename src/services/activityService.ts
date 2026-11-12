/* Histórico de rastreabilidade e centro de notificações (dados de demonstração). */
import type { AppNotification, HistoryEntry } from "@/types";
import { createId, getDemoState, setDemoState, simulateLatency } from "./demo/demoDb";

type HistoryInput = Omit<HistoryEntry, "id" | "timestamp"> & { timestamp?: string };
type NotificationInput = Omit<AppNotification, "id" | "createdAt" | "read">;

export function createHistoryEntry(input: HistoryInput): HistoryEntry {
  return { ...input, id: createId("hist"), timestamp: input.timestamp ?? new Date().toISOString() };
}

export function createNotification(input: NotificationInput): AppNotification {
  return { ...input, id: createId("not"), createdAt: new Date().toISOString(), read: false };
}

export async function listHistory(requestCode?: string): Promise<HistoryEntry[]> {
  await simulateLatency(160);
  return getDemoState()
    .history.filter((entry) => !requestCode || entry.requestCode === requestCode)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function listNotifications(): Promise<AppNotification[]> {
  await simulateLatency(160);
  return [...getDemoState().notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function setNotificationRead(id: string, read: boolean): Promise<void> {
  await simulateLatency(80);
  setDemoState((s) => ({
    ...s,
    notifications: s.notifications.map((n) => (n.id === id ? { ...n, read } : n)),
  }));
}

export async function setAllNotificationsRead(read: boolean): Promise<void> {
  await simulateLatency(80);
  setDemoState((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read })) }));
}
