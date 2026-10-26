import {
  CalendarX,
  ClipboardList,
  Factory,
  Info,
  ListChecks,
  PackageX,
  TrendingDown,
  Undo2,
  Truck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { MarIAMark } from "@/components/common/MareLogo";

interface Suggestion {
  title: string;
  prompt: string;
  icon: LucideIcon;
}

export const SUGGESTION_GROUPS: { title: string; items: Suggestion[] }[] = [
  {
    title: "Solicitações e produção",
    items: [
      { title: "Solicitações atrasadas", prompt: "Quais solicitações estão atrasadas?", icon: CalendarX },
      { title: "Demandas prioritárias", prompt: "Quais demandas precisam de prioridade?", icon: ListChecks },
      { title: "Canceladas recentemente", prompt: "Quais solicitações foram canceladas recentemente?", icon: Undo2 },
      { title: "Em produção agora", prompt: "Quais produtos para cães estão em produção?", icon: Factory },
      { title: "Gargalos de produção", prompt: "Quais são os principais gargalos de produção?", icon: Zap },
      { title: "Resumo do que está pendente", prompt: "Resuma as solicitações pendentes.", icon: ClipboardList },
    ],
  },
  {
    title: "Estoque e materiais",
    items: [
      { title: "Abaixo do estoque mínimo", prompt: "Quais materiais estão abaixo do estoque mínimo?", icon: TrendingDown },
      { title: "Indisponíveis para produzir", prompt: "Quais materiais estão indisponíveis para iniciar a produção?", icon: PackageX },
      { title: "Situação do estoque", prompt: "Qual é a situação atual do estoque?", icon: Truck },
      { title: "Materiais a repor", prompt: "Quais materiais precisam ser repostos?", icon: Truck },
      { title: "Movimentações recentes", prompt: "Quais movimentações ocorreram no estoque?", icon: ClipboardList },
      { title: "Risco de atraso", prompt: "Existe risco de atraso em alguma demanda?", icon: Zap },
    ],
  },
];

const CAPABILITIES = [
  "Situação de demandas, prazos, cancelamentos e riscos de atraso",
  "Materiais abaixo do mínimo, insuficientes ou indisponíveis",
  "Andamento da separação e itens a separar",
  "Resumos, comparações e conceitos de PCP",
];

export function WelcomeScreen({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-start gap-3">
        <MarIAMark className="h-10 w-10 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-navy-900">Mar.IA — assistente da Plataforma Maré</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Consulte a situação das solicitações, dos prazos e do estoque da fábrica de produtos para cães e organize as prioridades do almoxarifado.
          </p>
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-2 border-y border-slate-200 py-4 sm:grid-cols-2">
        {CAPABILITIES.map((item) => (
          <p key={item} className="flex gap-2 text-sm text-slate-700">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-navy-600" aria-hidden="true" />
            {item}
          </p>
        ))}
      </div>

      <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        <strong className="font-semibold">Modo de demonstração.</strong> As respostas são calculadas a partir dos dados fictícios desta versão. Perguntas gerais e
        ações administrativas dependerão da conexão com o modelo de linguagem e do backend, ainda não configurados.
      </p>

      <div className="space-y-4">
        {SUGGESTION_GROUPS.map((group) => (
          <section key={group.title} aria-labelledby={`suggestions-${group.title.replace(/\s+/g, "-")}`}>
            <h3
              id={`suggestions-${group.title.replace(/\s+/g, "-")}`}
              className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              {group.title}
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {group.items.map((suggestion) => {
                const Icon = suggestion.icon;
                return (
                  <li key={suggestion.title}>
                    <button
                      type="button"
                      onClick={() => onPick(suggestion.prompt)}
                      className="flex w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-navy-300 hover:bg-navy-50/40"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-navy-50 text-navy-700">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900">{suggestion.title}</span>
                        <span className="block truncate text-xs text-slate-500">“{suggestion.prompt}”</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <p className="flex items-start gap-2 text-xs text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Comandos de teste: <code className="rounded bg-slate-100 px-1">/ajuda</code>, <code className="rounded bg-slate-100 px-1">/erro</code> e{" "}
        <code className="rounded bg-slate-100 px-1">/limite</code>. Navegue pelas mensagens com as setas ↑ ↓ após focar a conversa.
      </p>
    </div>
  );
}
