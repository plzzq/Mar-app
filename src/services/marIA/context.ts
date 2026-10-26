/* Monta o contexto operacional a partir dos dados disponíveis na aplicação. */
import { analyzeAll, buildMaterialMetricsMap, OPEN_STATUSES } from "@/lib/businessRules";
import type { Material, ProductionRequest } from "@/types";
import type { OperationalContext, OperationalContextRequest, OperationalContextMaterial } from "./types";

interface ContextSource {
  requests: ProductionRequest[];
  materials: Material[];
}

export function buildOperationalContext(source: ContextSource, now = new Date()): OperationalContext {
  const analyses = analyzeAll(source.requests, source.materials);
  const metrics = buildMaterialMetricsMap(source.materials, source.requests);

  const requests: OperationalContextRequest[] = analyses.map((a) => ({
    code: a.request.code,
    description: a.request.description,
    sector: a.request.sector,
    responsible: a.request.responsible,
    priority: a.request.priority,
    status: a.request.status,
    createdAt: a.request.createdAt,
    dueDate: a.request.dueDate,
    concludedAt: a.request.concludedAt,
    deadlineState: a.deadline.state,
    daysToDue: a.deadline.days,
    progressPercent: a.progress,
    attentionLevel: a.attention,
    requestedTotal: a.requested,
    separatedTotal: a.separated,
    pendingItems: a.items
      .filter((i) => i.pending > 0)
      .map((i) => ({
        materialCode: i.material?.code ?? i.item.materialId,
        materialName: i.material?.name ?? "Material não identificado",
        unit: i.material?.unit ?? "un",
        pending: i.pending,
        available: i.available,
        difference: i.difference,
      })),
  }));

  const materials: OperationalContextMaterial[] = source.materials.map((m) => {
    const mm = metrics[m.id];
    return {
      code: m.code,
      name: m.name,
      unit: m.unit,
      location: m.location,
      minimumStock: m.minimumStock,
      available: m.available,
      reserved: mm.reserved,
      openDemand: mm.openDemand,
      freeBalance: mm.freeBalance,
      projected: mm.projected,
      shortfall: mm.shortfall,
      status: mm.status,
    };
  });

  const count = (predicate: (a: (typeof analyses)[number]) => boolean) => analyses.filter(predicate).length;
  const countMaterials = (status: OperationalContextMaterial["status"]) =>
    materials.filter((m) => m.status === status).length;

  return {
    generatedAt: now.toISOString(),
    source: "dados de demonstração da Plataforma Maré",
    requests,
    materials,
    summary: {
      totalRequests: analyses.length,
      openRequests: count((a) => OPEN_STATUSES.includes(a.request.status)),
      inSeparation: count((a) => a.request.status === "Em separação"),
      readyForDelivery: count((a) => a.request.status === "Pronta para disponibilização"),
      completed: count((a) => a.request.status === "Concluída"),
      overdueRequests: count((a) => a.deadline.state === "atrasada"),
      nearDeadlineRequests: count((a) => a.deadline.state === "hoje" || a.deadline.state === "proxima"),
      insufficientRequests: count((a) => a.request.status !== "Concluída" && a.request.status !== "Cancelada" && a.shortages.length > 0),
      insufficientMaterials: countMaterials("Insuficiente"),
      unavailableMaterials: countMaterials("Indisponível"),
      lowStockMaterials: countMaterials("Baixo"),
    },
  };
}
