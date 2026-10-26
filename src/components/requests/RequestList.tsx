/* Lista de solicitações: tabela no desktop e cartões no celular (sem rolagem horizontal). */
import { Link } from "react-router-dom";
import { DeadlineBadge, PriorityBadge, RequestStatusBadge } from "@/components/common/DomainBadges";
import type { RequestAnalysis } from "@/lib/businessRules";
import { formatDateOnly } from "@/lib/utils";

export function MiniProgress({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-label="Progresso da separação"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"
      >
        <div className="h-full rounded-full bg-navy-700 transition-[width] duration-500" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums text-slate-700">{value}%</span>
    </div>
  );
}

export function RequestTable({ items }: { items: RequestAnalysis[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm lg:block">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Solicitações de materiais</caption>
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">Código</th>
            <th scope="col" className="px-4 py-3 font-semibold">Descrição</th>
            <th scope="col" className="px-4 py-3 font-semibold">Setor · Responsável</th>
            <th scope="col" className="px-4 py-3 font-semibold">Prioridade</th>
            <th scope="col" className="px-4 py-3 font-semibold">Status</th>
            <th scope="col" className="px-4 py-3 font-semibold">Prazo</th>
            <th scope="col" className="px-4 py-3 font-semibold">Separação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((a) => (
            <tr key={a.request.id} className="align-top hover:bg-slate-50/70">
              <td className="whitespace-nowrap px-4 py-3">
                <Link to={`/solicitacoes/${a.request.id}`} className="font-semibold text-navy-800 hover:underline">
                  {a.request.code}
                </Link>
              </td>
              <td className="max-w-xs px-4 py-3 text-slate-800">{a.request.description}</td>
              <td className="px-4 py-3 text-slate-600">
                <span className="block">{a.request.sector}</span>
                <span className="block text-xs text-slate-500">{a.request.responsible}</span>
              </td>
              <td className="px-4 py-3">
                <PriorityBadge priority={a.request.priority} />
              </td>
              <td className="px-4 py-3">
                <RequestStatusBadge status={a.request.status} />
              </td>
              <td className="px-4 py-3">
                <DeadlineBadge state={a.deadline.state} days={a.deadline.days} />
                <span className="mt-1 block text-xs text-slate-500">{formatDateOnly(a.request.dueDate)}</span>
              </td>
              <td className="px-4 py-3">
                <MiniProgress value={a.progress} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RequestCards({ items }: { items: RequestAnalysis[] }) {
  return (
    <ul className="space-y-3 lg:hidden">
      {items.map((a) => (
        <li key={a.request.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link to={`/solicitacoes/${a.request.id}`} className="font-semibold text-navy-800 hover:underline">
                {a.request.code}
              </Link>
              <p className="mt-0.5 text-sm text-slate-800">{a.request.description}</p>
            </div>
            <PriorityBadge priority={a.request.priority} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <RequestStatusBadge status={a.request.status} />
            <DeadlineBadge state={a.deadline.state} days={a.deadline.days} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-500">
            <div>
              <dt>Responsável</dt>
              <dd className="font-medium text-slate-800">{a.request.responsible}</dd>
            </div>
            <div>
              <dt>Setor</dt>
              <dd className="font-medium text-slate-800">{a.request.sector}</dd>
            </div>
            <div>
              <dt>Prazo</dt>
              <dd className="font-medium text-slate-800">{formatDateOnly(a.request.dueDate)}</dd>
            </div>
            <div>
              <dt>Pendente</dt>
              <dd className="font-medium text-slate-800">{a.pending} unid.</dd>
            </div>
          </dl>
          <div className="mt-3">
            <MiniProgress value={a.progress} />
          </div>
        </li>
      ))}
    </ul>
  );
}
