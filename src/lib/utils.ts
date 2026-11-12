export { cn } from "@/utils/cn";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

/** Converte "AAAA-MM-DD" para Date local (evita deslocamento de fuso). */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Converte uma Date para "AAAA-MM-DD" no fuso local. */
export function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDateOnly(value: string): string {
  return dateFormatter.format(parseDateOnly(value));
}

export function formatShortDate(value: string): string {
  return shortDateFormatter.format(parseDateOnly(value));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits });
}

export function formatPercent(value: number): string {
  return `${formatNumber(Math.round(value))}%`;
}

/** Diferença em dias entre hoje (início do dia) e a data informada. Negativo = passado. */
export function diffInDays(dateOnly: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parseDateOnly(dateOnly).getTime() - today.getTime()) / 86_400_000);
}

/** Data (AAAA-MM-DD) deslocada em relação a hoje. */
export function dateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateOnly(date);
}

/** Instante ISO deslocado em relação a hoje, em uma hora fixa. */
export function isoOffset(days: number, hour = 9): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Remove marcações simples de Markdown para leitura em voz alta. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`#>|]/g, " ")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const escape = (value: string | number) => {
    const text = String(value ?? "");
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const content = "\uFEFF" + rows.map((row) => row.map(escape).join(";")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
