/* ------------------------------------------------------------------ */
/* PROVEDOR DE DEMONSTRAÇÃO DA MAR.IA                                 */
/* Reconhece algumas perguntas predefinidas e responde com base no    */
/* contexto operacional fictício. NÃO é uma inteligência artificial.  */
/* Para usar a IA real, implemente outro MarIAProvider (ver index.ts).*/
/* ------------------------------------------------------------------ */
import { formatDateOnly, formatNumber, normalizeText } from "@/lib/utils";
import type { MarIAProvider, MarIARequest, OperationalContext, OperationalContextRequest } from "./types";
import { MarIAError } from "./types";

const DEMO_FOOTER = "\n\n_Resposta de demonstração, calculada a partir dos dados fictícios da plataforma._";

const UNSUPPORTED_MESSAGE =
  "Esta pergunta não é suportada pelo **modo de demonstração**. A conexão com a IA real ainda não foi configurada, " +
  "por isso só consigo responder a perguntas operacionais pré-definidas sobre solicitações, prazos, estoque e separação.\n\n" +
  "Experimente: *Quais demandas estão atrasadas?*, *Quais materiais estão insuficientes?* ou digite **/ajuda** para ver as capacidades.";

const CAPABILITIES_MESSAGE = `Eu sou a **Mar.IA**, assistente da Plataforma Maré. Neste modo de demonstração, posso:

- Analisar **demandas atrasadas** e prazos próximos
- Listar **materiais insuficientes** e a diferença entre necessário e disponível
- Mostrar a **situação de uma solicitação** (informe o código, ex.: SOL-2026-001)
- Indicar o **andamento da separação** e os materiais a separar
- Sugerir **prioridades** e apontar **riscos de atraso**
- Explicar **conceitos de PCP** em linguagem simples

**Dica de teste:** digite \`/erro\` para simular uma falha de comunicação ou \`/limite\` para simular o limite de requisições.

Perguntas gerais e livres dependerão da integração com o modelo de linguagem, que será configurada posteriormente.`;

/* ------------------------------ Auxiliares -------------------------- */

const daysLabel = (n: number) => `${formatNumber(n)} ${n === 1 ? "dia" : "dias"}`;
const confirmed = (text: string) => `**Dado confirmado:** ${text}`;
const derived = (text: string) => `**Cálculo derivado:** ${text}`;
const recommendation = (text: string) => `**Recomendação:** ${text}`;
const finish = (parts: string[]) => parts.join("\n\n") + DEMO_FOOTER;

function table(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function dueText(r: OperationalContextRequest): string {
  if (r.status === "Cancelada") return "cancelada (reservas liberadas)";
  if (r.status === "Concluída") return "concluída";
  if (r.daysToDue < 0) return `vencida há ${daysLabel(-r.daysToDue)}`;
  if (r.daysToDue === 0) return "vence hoje";
  return `vence em ${daysLabel(r.daysToDue)}`;
}

function shortageText(r: OperationalContextRequest): string {
  const short = r.pendingItems.filter((i) => i.difference > 0);
  if (short.length === 0) return "sem falta de material";
  return short.map((i) => `${i.materialCode} (faltam ${formatNumber(i.difference)} ${i.unit})`).join("; ");
}

function reasonsFor(r: OperationalContextRequest): string[] {
  const reasons: string[] = [];
  if (r.deadlineState === "atrasada") reasons.push("prazo vencido");
  else if (r.deadlineState === "hoje") reasons.push("vence hoje");
  else if (r.deadlineState === "proxima") reasons.push("prazo em até 2 dias");
  const shortages = r.pendingItems.filter((i) => i.difference > 0).length;
  if (shortages > 0) reasons.push(`${shortages} material(is) insuficiente(s)`);
  if (r.priority === "Alta") reasons.push("prioridade alta");
  return reasons;
}

const isActive = (r: OperationalContextRequest) => r.status !== "Concluída" && r.status !== "Cancelada";
const PRIORITY_WEIGHT: Record<string, number> = { Alta: 3, Média: 2, Baixa: 1 };
const LEVEL_WEIGHT: Record<string, number> = { critico: 4, alto: 3, medio: 2, baixo: 1 };
const LEVEL_LABEL: Record<string, string> = { critico: "Crítico", alto: "Alto", medio: "Médio", baixo: "Baixo" };

/* ------------------------------ Respostas --------------------------- */

function answerOverdue(ctx: OperationalContext): string {
  const overdue = ctx.requests
    .filter((r) => r.deadlineState === "atrasada")
    .sort((a, b) => a.daysToDue - b.daysToDue);
  if (overdue.length === 0) {
    return finish([confirmed("nenhuma solicitação em aberto está com prazo vencido.")]);
  }
  const open = ctx.requests.filter(isActive).length;
  const withShortage = overdue.filter((r) => r.pendingItems.some((i) => i.difference > 0));
  return finish([
    confirmed(`${overdue.length} solicitação(ões) estão com prazo vencido e ainda não foram concluídas.`),
    table(
      ["Código", "Setor", "Responsável", "Prazo", "Status", "Situação"],
      overdue.map((r) => [`**${r.code}**`, r.sector, r.responsible, formatDateOnly(r.dueDate), r.status, dueText(r)]),
    ),
    derived(`${overdue.length} de ${open} solicitações em aberto estão atrasadas.`),
    recommendation(
      withShortage.length > 0
        ? `comece por ${withShortage.map((r) => `**${r.code}**`).join(", ")}, que também possuem materiais insuficientes.`
        : "alinhe com os responsáveis os motivos do atraso e defina novas datas, se necessário.",
    ),
  ]);
}

function answerRisk(ctx: OperationalContext): string {
  const risks = ctx.requests
    .filter((r) => isActive(r))
    .filter(
      (r) =>
        r.deadlineState === "atrasada" ||
        r.deadlineState === "hoje" ||
        r.deadlineState === "proxima" ||
        (r.pendingItems.some((i) => i.difference > 0) && r.daysToDue <= 7),
    )
    .map((r) => ({
      r,
      level: r.deadlineState === "atrasada" || (r.deadlineState === "hoje" && shortageText(r) !== "sem falta de material") ? "Alto" : "Médio",
    }))
    .sort((a, b) => (a.level === b.level ? a.r.daysToDue - b.r.daysToDue : a.level === "Alto" ? -1 : 1));

  if (risks.length === 0) {
    return finish([confirmed("nenhuma solicitação em aberto apresenta risco de atraso identificado nos dados.")]);
  }
  return finish([
    confirmed(`${risks.length} solicitação(ões) apresentam risco de atraso com base em prazo e disponibilidade de materiais.`),
    table(
      ["Código", "Risco", "Motivos", "Prazo"],
      risks.map(({ r, level }) => [`**${r.code}**`, level, reasonsFor(r).join("; ") || "acompanhar", dueText(r)]),
    ),
    recommendation("resolva primeiro as faltas de material das solicitações de risco alto e confirme a reposição com o PCP."),
  ]);
}

function answerAttention(ctx: OperationalContext): string {
  const list = ctx.requests
    .filter((r) => isActive(r) && (r.attentionLevel === "critico" || r.attentionLevel === "alto"))
    .sort((a, b) => LEVEL_WEIGHT[b.attentionLevel] - LEVEL_WEIGHT[a.attentionLevel] || a.daysToDue - b.daysToDue);

  if (list.length === 0) {
    return finish([
      confirmed("nenhuma solicitação está classificada com nível de atenção crítico ou alto."),
      recommendation("mantenha o acompanhamento das solicitações em análise e das prioridades altas."),
    ]);
  }
  return finish([
    confirmed(`${list.length} solicitação(ões) precisam de atenção imediata.`),
    table(
      ["Código", "Nível", "Motivos", "Status", "Prazo"],
      list.map((r) => [`**${r.code}**`, LEVEL_LABEL[r.attentionLevel], reasonsFor(r).join("; ") || "—", r.status, dueText(r)]),
    ),
    derived("o nível combina situação do prazo, prioridade e faltas de material."),
    recommendation(`inicie pela **${list[0].code}** e confirme a disponibilidade dos materiais antes de iniciar a separação.`),
  ]);
}

function answerStock(ctx: OperationalContext): string {
  const critical = ctx.materials.filter((m) => m.status === "Insuficiente" || m.status === "Indisponível");
  const low = ctx.materials.filter((m) => m.status === "Baixo");

  if (critical.length === 0) {
    return finish([
      confirmed("nenhum material está insuficiente ou indisponível no momento."),
      low.length > 0
        ? derived(`${low.length} material(is) estão com saldo projetado igual ou abaixo do estoque mínimo: ${low.map((m) => m.code).join(", ")}.`)
        : derived("todos os materiais estão com saldo projetado acima do estoque mínimo."),
    ]);
  }

  const affected = (code: string) =>
    ctx.requests
      .filter((r) => isActive(r) && r.pendingItems.some((i) => i.materialCode === code))
      .map((r) => r.code)
      .join(", ") || "—";

  return finish([
    confirmed(`${critical.length} material(is) estão insuficientes ou indisponíveis.`),
    table(
      ["Material", "Disponível", "Comprometido", "Faltam", "Situação", "Solicitações"],
      critical.map((m) => [
        `**${m.code}** ${m.name}`,
        `${formatNumber(m.available)} ${m.unit}`,
        `${formatNumber(m.reserved + m.openDemand)} ${m.unit}`,
        `${formatNumber(m.shortfall)} ${m.unit}`,
        m.status,
        affected(m.code),
      ]),
    ),
    derived("comprometido = quantidade pendente em separação + demanda em aberto. Faltam = comprometido − disponível."),
    recommendation(
      `priorize a reposição de ${critical.some((m) => m.status === "Indisponível") ? "itens indisponíveis" : "itens insuficientes"} e informe a insuficiência na separação para registrar o impacto nas solicitações.`,
    ),
  ]);
}

function answerAwaiting(ctx: OperationalContext): string {
  const list = ctx.requests.filter((r) => r.status === "Aguardando materiais");
  if (list.length === 0) {
    return finish([confirmed("nenhuma solicitação está aguardando materiais no momento.")]);
  }
  return finish([
    confirmed(`${list.length} solicitação(ões) estão aguardando materiais.`),
    table(
      ["Código", "Responsável", "Prazo", "Materiais em falta"],
      list.map((r) => [`**${r.code}**`, r.responsible, dueText(r), shortageText(r)]),
    ),
    recommendation("acompanhe a reposição com o almoxarifado e atualize o status assim que os materiais forem liberados."),
  ]);
}

function answerReady(ctx: OperationalContext): string {
  const list = ctx.requests.filter((r) => r.status === "Pronta para disponibilização");
  if (list.length === 0) {
    return finish([confirmed("nenhuma solicitação está pronta para disponibilização no momento.")]);
  }
  return finish([
    confirmed(`${list.length} solicitação(ões) estão prontas para disponibilização à produção.`),
    table(
      ["Código", "Setor", "Responsável", "Prazo"],
      list.map((r) => [`**${r.code}**`, r.sector, r.responsible, dueText(r)]),
    ),
    recommendation("confirme a retirada pela produção e conclua a solicitação para encerrar o ciclo."),
  ]);
}

function answerItemsToSeparate(ctx: OperationalContext): string {
  const stages = ["Em análise", "Aguardando materiais", "Em separação"];
  const rows = ctx.requests
    .filter((r) => stages.includes(r.status))
    .sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || a.dueDate.localeCompare(b.dueDate))
    .flatMap((r) =>
      r.pendingItems.map((i) => [
        `**${r.code}**`,
        `${i.materialCode} ${i.materialName}`,
        `${formatNumber(i.pending)} ${i.unit}`,
        `${formatNumber(i.available)} ${i.unit}`,
        i.difference > 0 ? `Faltam ${formatNumber(i.difference)} ${i.unit}` : "Disponível",
      ]),
    );

  if (rows.length === 0) {
    return finish([confirmed("não há itens pendentes de separação nas solicitações ativas.")]);
  }
  return finish([
    confirmed(`${rows.length} item(ns) ainda precisam ser separados.`),
    table(["Solicitação", "Material", "Pendente", "Disponível", "Situação"], rows),
    recommendation("separe primeiro os itens disponíveis das solicitações de maior prioridade e registre as faltas."),
  ]);
}

function answerPriorities(ctx: OperationalContext): string {
  const list = ctx.requests
    .filter(isActive)
    .sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || a.daysToDue - b.daysToDue)
    .slice(0, 8);
  return finish([
    confirmed("ordem sugerida com base em prioridade, prazo e situação de materiais."),
    table(
      ["#", "Código", "Prioridade", "Prazo", "Status", "Materiais"],
      list.map((r, i) => [String(i + 1), `**${r.code}**`, r.priority, dueText(r), r.status, shortageText(r)]),
    ),
    recommendation("resolva primeiro as faltas de material das solicitações de prioridade alta; elas bloqueiam o início da separação."),
  ]);
}

function answerDueOrder(ctx: OperationalContext): string {
  const list = ctx.requests
    .filter(isActive)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);
  return finish([
    confirmed("as solicitações em aberto com os prazos mais próximos são:"),
    table(
      ["Código", "Prazo", "Situação do prazo", "Status"],
      list.map((r) => [`**${r.code}**`, formatDateOnly(r.dueDate), dueText(r), r.status]),
    ),
  ]);
}

function answerSeparationProgress(ctx: OperationalContext): string {
  const active = ctx.requests.filter(isActive);
  const requested = active.reduce((sum, r) => sum + r.requestedTotal, 0);
  const separated = active.reduce((sum, r) => sum + r.separatedTotal, 0);
  const percent = requested === 0 ? 0 : Math.round((separated / requested) * 100);
  const statuses = ["Pendente", "Em análise", "Aguardando materiais", "Em separação", "Pronta para disponibilização"] as const;

  return finish([
    confirmed(`${formatNumber(separated)} de ${formatNumber(requested)} unidades solicitadas já foram separadas.`),
    derived(`andamento geral da separação das solicitações ativas: ${percent}%.`),
    table(
      ["Status", "Solicitações"],
      statuses.map((s) => [s, String(active.filter((r) => r.status === s).length)]),
    ),
    recommendation(
      ctx.summary.insufficientRequests > 0
        ? `${ctx.summary.insufficientRequests} solicitação(ões) possuem falta de material; trate-as antes de avançar a separação.`
        : "nenhuma falta de material identificada; siga a fila de separação por prioridade e prazo.",
    ),
  ]);
}

function answerPendingSummary(ctx: OperationalContext): string {
  const pendingStatuses = ["Pendente", "Em análise", "Aguardando materiais"] as const;
  const pending = ctx.requests.filter((r) => (pendingStatuses as readonly string[]).includes(r.status));
  const soonest = [...pending].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3);
  return finish([
    confirmed(`${pending.length} solicitação(ões) estão pendentes de atendimento.`),
    table(
      ["Status", "Quantidade"],
      pendingStatuses.map((s) => [s, String(pending.filter((r) => r.status === s).length)]),
    ),
    derived("as três com prazo mais próximo são " + soonest.map((r) => `**${r.code}** (${dueText(r)})`).join(", ") + "."),
  ]);
}

function answerGeneralSummary(ctx: OperationalContext): string {
  const s = ctx.summary;
  return finish([
    confirmed("indicadores calculados a partir dos dados de demonstração:"),
    [
      `- **Total de solicitações:** ${s.totalRequests}`,
      `- **Em aberto:** ${s.openRequests}`,
      `- **Em separação:** ${s.inSeparation}`,
      `- **Prontas para disponibilização:** ${s.readyForDelivery}`,
      `- **Concluídas:** ${s.completed}`,
      `- **Com prazo vencido:** ${s.overdueRequests}`,
      `- **Com prazo próximo (até 2 dias):** ${s.nearDeadlineRequests}`,
      `- **Com falta de material:** ${s.insufficientRequests}`,
      `- **Materiais insuficientes ou indisponíveis:** ${s.insufficientMaterials + s.unavailableMaterials}`,
    ].join("\n"),
    recommendation("comece pelas solicitações atrasadas e pelos materiais insuficientes, que concentram o maior risco operacional."),
  ]);
}

function answerSituation(ctx: OperationalContext, code: string): string {
  const r = ctx.requests.find((item) => item.code === code);
  if (!r) {
    return finish([confirmed(`não encontrei a solicitação **${code}** nos dados de demonstração.`)]);
  }
  const progress = r.requestedTotal === 0 ? 0 : Math.round((r.separatedTotal / r.requestedTotal) * 100);
  const nextStep: Record<string, string> = {
    Pendente: "encaminhar a solicitação para análise do PCP.",
    "Em análise": "verificar a disponibilidade e iniciar a separação, se não houver faltas de material.",
    "Aguardando materiais": "acompanhar a reposição e atualizar a solicitação quando os materiais forem liberados.",
    "Em separação": "concluir a separação dos itens pendentes e marcar a solicitação como pronta.",
    "Pronta para disponibilização": "confirmar a retirada pela produção e concluir a solicitação.",
    Concluída: "nenhuma ação pendente.",
  };
  return finish([
    confirmed(`situação da solicitação **${r.code}**:`),
    [
      `- **Descrição:** ${r.description}`,
      `- **Setor / responsável:** ${r.sector} · ${r.responsible}`,
      `- **Prioridade:** ${r.priority}`,
      `- **Status:** ${r.status}`,
      `- **Prazo:** ${formatDateOnly(r.dueDate)} (${dueText(r)})`,
      `- **Separação:** ${formatNumber(r.separatedTotal)} de ${formatNumber(r.requestedTotal)} unidades`,
      `- **Materiais em falta:** ${shortageText(r)}`,
    ].join("\n"),
    derived(`progresso da separação de ${progress}%. Motivos de atenção: ${reasonsFor(r).join("; ") || "nenhum"}.`),
    recommendation(nextStep[r.status] ?? "acompanhar a solicitação."),
  ]);
}

const GLOSSARY: Record<string, string> = {
  mrp: "**MRP (Material Requirements Planning):** cálculo das necessidades de materiais a partir do plano de produção e da lista de materiais, indicando quando e quanto comprar ou produzir.",
  leadtime: "**Lead time:** tempo total entre o pedido e a disponibilidade do material ou produto. Quanto maior, mais cedo a demanda precisa ser registrada.",
  seguranca: "**Estoque de segurança:** quantidade mantida para absorver variações de demanda ou de fornecimento. Na plataforma, corresponde ao **estoque mínimo**.",
  lote: "**Lote econômico (EOQ):** quantidade de compra ou produção que minimiza o custo total de pedidos e de manutenção de estoque.",
  kanban: "**Kanban:** sinalização visual que aciona a reposição quando uma posição de estoque atinge o nível mínimo.",
  capacidade: "**Capacidade:** volume máximo que um recurso (máquina, célula ou equipe) pode produzir em um período. É a base do sequenciamento.",
  sequenciamento: "**Sequenciamento:** definição da ordem de execução das tarefas nos recursos, considerando prazos, prioridades e disponibilidade de materiais.",
};

function answerGlossary(q: string): string {
  const matches: string[] = [];
  if (q.includes("mrp")) matches.push(GLOSSARY.mrp);
  if (q.includes("lead time") || q.includes("leadtime")) matches.push(GLOSSARY.leadtime);
  if (q.includes("seguranca")) matches.push(GLOSSARY.seguranca);
  if (q.includes("lote economico") || q.includes("eoq")) matches.push(GLOSSARY.lote);
  if (q.includes("kanban")) matches.push(GLOSSARY.kanban);
  if (q.includes("capacidade")) matches.push(GLOSSARY.capacidade);
  if (q.includes("sequenciamento")) matches.push(GLOSSARY.sequenciamento);

  const overview =
    "**PCP (Planejamento e Controle da Produção):** organiza demanda, capacidade, materiais e prazos para que a produção aconteça no tempo certo.";
  const parts = matches.length > 0
    ? [`Explicação de demonstração (conteúdo pré-definido):`, ...matches]
    : [
        `Explicação de demonstração (conteúdo pré-definido):`,
        overview,
        "Principais conceitos: " + [GLOSSARY.mrp, GLOSSARY.leadtime, GLOSSARY.seguranca, GLOSSARY.capacidade].join(" "),
        "Para explicações mais detalhadas sobre outros temas, a integração com o modelo de linguagem será necessária.",
      ];
  return parts.join("\n\n") + DEMO_FOOTER;
}

/* --- Sugestões operacionais adicionais (dados do contexto) ---------- */

function answerCancelled(ctx: OperationalContext): string {
  const cancelled = ctx.requests.filter((r) => r.status === "Cancelada");
  if (cancelled.length === 0) {
    return finish([confirmed("nenhuma solicitação está cancelada nos dados atuais.")]);
  }
  return finish([
    confirmed(`${cancelled.length} solicitação(ões) cancelada(s), preservadas para consulta no histórico.`),
    table(
      ["Código", "Setor", "Responsável", "Prazo", "Status"],
      cancelled.map((r) => [`**${r.code}**`, r.sector, r.responsible, formatDateOnly(r.dueDate), r.status]),
    ),
    derived("canceladas não contam para prazos em aberto nem reservam estoque."),
    recommendation("confira o motivo no histórico da solicitação antes de recriar a demanda com os dados corretos."),
  ]);
}

function answerLowStock(ctx: OperationalContext): string {
  const low = ctx.materials.filter(
    (m) => m.projected <= m.minimumStock || m.status === "Baixo" || m.status === "Insuficiente" || m.status === "Indisponível",
  );
  if (low.length === 0) {
    return finish([confirmed("nenhum material está igual ou abaixo do estoque mínimo.")]);
  }
  return finish([
    confirmed(`${low.length} material(is) estão abaixo do mínimo, insuficientes ou indisponíveis.`),
    table(
      ["Material", "Disponível", "Mínimo", "Projetado", "Situação"],
      low.map((m) => [
        `**${m.code}** ${m.name}`,
        `${formatNumber(m.available)} ${m.unit}`,
        `${formatNumber(m.minimumStock)} ${m.unit}`,
        `${formatNumber(m.projected)} ${m.unit}`,
        m.status,
      ]),
    ),
    derived("projetado = disponível − reservado − demanda em aberto."),
    recommendation("programe a reposição dos itens com saldo projetado negativo antes de liberar novas separações."),
  ]);
}

function answerInProduction(ctx: OperationalContext): string {
  const active = ctx.requests.filter(
    (r) =>
      isActive(r) &&
      ["Em separação", "Aguardando materiais", "Em análise", "Pronta para disponibilização"].includes(r.status),
  );
  if (active.length === 0) {
    return finish([confirmed("nenhuma demanda está em produção nesta etapa.")]);
  }
  return finish([
    confirmed(`${active.length} demanda(s) em andamento na fábrica.`),
    table(
      ["Demanda", "Produto/etapa", "Status", "Prazo", "Separação"],
      active.map((r) => [`**${r.code}**`, r.description, r.status, dueText(r), `${r.progressPercent}%`]),
    ),
    derived("“Separação” é a proporção de unidades já separadas em relação ao total solicitado."),
    recommendation("priorize as demandas com prazo vencido e sem separação iniciada."),
  ]);
}

function answerBottlenecks(ctx: OperationalContext): string {
  const shortMaterials = ctx.materials.filter((m) => m.shortfall > 0 || m.status === "Indisponível");
  const waiting = ctx.requests.filter((r) => r.status === "Aguardando materiais");
  const overdue = ctx.requests.filter((r) => r.deadlineState === "atrasada");
  const partial = ctx.requests.filter((r) => r.status === "Em separação" && r.progressPercent < 100);
  if (shortMaterials.length === 0 && waiting.length === 0 && overdue.length === 0 && partial.length === 0) {
    return finish([confirmed("não identifico gargalos críticos nos dados atuais.")]);
  }
  return finish([
    confirmed("gargalos identificados a partir de dados confirmados:"),
    [
      shortMaterials.length > 0
        ? `- **Materiais:** ${shortMaterials.map((m) => `${m.code} (${m.status.toLowerCase()})`).join(", ")}`
        : undefined,
      waiting.length > 0 ? `- **Aguardando materiais:** ${waiting.map((r) => r.code).join(", ")}` : undefined,
      overdue.length > 0 ? `- **Atrasadas:** ${overdue.map((r) => r.code).join(", ")}` : undefined,
      partial.length > 0
        ? `- **Separação incompleta:** ${partial.map((r) => `${r.code} (${r.progressPercent}%)`).join(", ")}`
        : undefined,
    ]
      .filter(Boolean)
      .join("\n"),
    derived(
      `prioridade recomendada: ${shortMaterials.length} material(is) bloqueando produção, ${waiting.length} solicitação(ões) aguardando estoque.`,
    ),
    recommendation("trate primeiro as faltas de material: elas impedem o início da separação e propagam o atraso."),
  ]);
}

function answerMovements(): string {
  return finish([
    confirmed("as movimentações de estoque ainda não fazem parte do contexto da Mar.IA nesta fase."),
    "Entradas, saídas, ajustes e estornos ficam registrados no módulo **Estoque › Movimentações**, com data, responsável, motivo e saldo após a operação.",
    recommendation("consulte a aba “Movimentações” no módulo de Estoque para ver o histórico completo desta versão."),
  ]);
}

/* ------------------------------ Roteamento -------------------------- */

/** Retorna a resposta demonstrativa ou null quando a pergunta não é suportada. */
export function answerDemoQuestion(question: string, ctx: OperationalContext): string | null {
  const raw = question.trim();
  const q = normalizeText(raw);

  if (/(^|\s)\/erro\b/.test(q)) {
    throw new MarIAError("unavailable", "Falha simulada: o serviço de IA não respondeu. Tente novamente.");
  }
  if (/(^|\s)\/limite\b/.test(q)) {
    throw new MarIAError(
      "rate_limit",
      "Limite de requisições atingido (simulação). Aguarde alguns segundos antes de tentar novamente.",
      20,
    );
  }
  if (/^\/ajuda\b/.test(q) || /o que voce faz|capacidades|quem e voce/.test(q)) return CAPABILITIES_MESSAGE;

  const codeMatch = /sol-\d{4}-\d{3}/i.exec(raw);
  if (codeMatch) return answerSituation(ctx, codeMatch[0].toUpperCase());

  if (q.includes("cancelad")) return answerCancelled(ctx);
  if (q.includes("movimentac")) return answerMovements();
  if (q.includes("minimo") || q.includes("repost") || q.includes("reposicao")) return answerLowStock(ctx);
  if (q.includes("em producao") || (q.includes("produt") && q.includes("producao"))) return answerInProduction(ctx);
  if (q.includes("gargalo")) return answerBottlenecks(ctx);
  if (q.includes("estoque") && (q.includes("situacao") || q.includes("como esta"))) return answerGeneralSummary(ctx);
  if (q.includes("risco")) return answerRisk(ctx);
  if (q.includes("atrasad")) return answerOverdue(ctx);
  if (q.includes("atencao") || q.includes("urgente")) return answerAttention(ctx);
  if (q.includes("insuficien") || (q.includes("estoque") && /falt|baixo|indisponivel|acabando/.test(q))) {
    return answerStock(ctx);
  }
  if (q.includes("aguardando") && q.includes("material")) return answerAwaiting(ctx);
  if (q.includes("pront") && /disponibiliz|retirad/.test(q)) return answerReady(ctx);
  if (q.includes("separ") && (q.includes("precis") || q.includes("a separar"))) return answerItemsToSeparate(ctx);
  if (q.includes("prioridade")) return answerPriorities(ctx);
  if (/vencem|vence|proximos prazos|prazo/.test(q)) return answerDueOrder(ctx);
  if (q.includes("andamento") || (q.includes("separ") && (q.includes("geral") || q.includes("situacao")))) {
    return answerSeparationProgress(ctx);
  }
  if (q.includes("pendente") && q.includes("resum")) return answerPendingSummary(ctx);
  if (q.includes("resum") || q.includes("situacao geral") || q.includes("como esta")) return answerGeneralSummary(ctx);
  if (/\bpcp\b|mrp|lead time|kanban|seguranca|lote economico|eoq|capacidade|sequenciamento|conceito|o que e/.test(q)) {
    return answerGlossary(q);
  }
  if (q.includes("situacao") && q.includes("solicitacao")) {
    return "Informe o código da solicitação (por exemplo, **SOL-2026-001**) para eu consultar a situação dela.";
  }
  return null;
}

/* ------------------------------ Streaming --------------------------- */

function abortedError(): MarIAError {
  return new MarIAError("aborted", "Geração interrompida pelo usuário.");
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortedError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortedError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function streamText(text: string, onChunk?: (chunk: string) => void, signal?: AbortSignal): Promise<void> {
  const tokens = text.split(/(\s+)/).filter(Boolean);
  for (let i = 0; i < tokens.length; i += 2) {
    if (signal?.aborted) throw abortedError();
    onChunk?.(tokens.slice(i, i + 2).join(""));
    await sleep(16, signal);
  }
}

export function createDemoProvider(): MarIAProvider {
  return {
    mode: "demo",
    name: "Modo de demonstração",
    async respond(request: MarIARequest, onChunk?: (chunk: string) => void) {
      await sleep(600, request.signal);
      const content = answerDemoQuestion(request.message, request.context) ?? UNSUPPORTED_MESSAGE;
      await streamText(content, onChunk, request.signal);
      return { content, mode: "demo" as const };
    },
  };
}
