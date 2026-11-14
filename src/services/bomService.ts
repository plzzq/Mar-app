/* ------------------------------------------------------------------ */
/* Serviço de Bill of Materials: templates de composição de produtos.  */
/* Segue o mesmo padrão do stockService.ts.                            */
/* ------------------------------------------------------------------ */
import type { BomTemplate, BomTemplateInput } from "@/types";
import { BusinessRuleError, NotFoundError } from "@/lib/errors";
import { bomTemplateInputSchema } from "@/lib/schemas";
import { createHistoryEntry } from "./activityService";
import {
  createId,
  getDemoState,
  nextBomCode,
  setDemoState,
  simulateLatency,
} from "./demo/demoDb";

export interface BomItemView {
  materialId: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  unit: string;
  available: number;
  itemCost: number;
  /** true se o material tem custo cadastrado */
  hasCost: boolean;
  available1: boolean;
  /** Quantas unidades do produto este item permite produzir com o saldo atual */
  maxUnits: number;
}

export interface BomTemplateView extends BomTemplate {
  estimatedCost: number;
  /** true se todos os materiais têm custo cadastrado */
  hasMissingCost: boolean;
  fullyAvailable: boolean;
  /** Máximo de unidades produzíveis agora com o estoque atual */
  maxProducible: number;
  itemViews: BomItemView[];
}

function buildView(template: BomTemplate): BomTemplateView {
  const state = getDemoState();
  const byId = Object.fromEntries(state.materials.map((m) => [m.id, m]));

  const itemViews: BomItemView[] = template.items.map((item) => {
    const mat = byId[item.materialId];
    const hasCost = mat != null && mat.cost != null && mat.cost > 0;
    const itemCost = hasCost ? (mat!.cost! * item.quantity) : 0;
    const maxUnits = mat && item.quantity > 0 ? Math.floor(mat.available / item.quantity) : 0;
    return {
      materialId: item.materialId,
      materialCode: mat?.code ?? item.materialId,
      materialName: mat?.name ?? "Material não encontrado",
      quantity: item.quantity,
      unit: mat?.unit ?? "",
      available: mat?.available ?? 0,
      itemCost,
      hasCost,
      available1: mat ? mat.available >= item.quantity : false,
      maxUnits,
    };
  });

  const estimatedCost = itemViews.reduce((sum, iv) => sum + iv.itemCost, 0);
  const fullyAvailable = itemViews.every((iv) => iv.available1);
  const hasMissingCost = itemViews.some((iv) => !iv.hasCost);
  const maxProducible = itemViews.length > 0
    ? Math.min(...itemViews.map((iv) => iv.maxUnits))
    : 0;

  return { ...template, itemViews, estimatedCost, hasMissingCost, fullyAvailable, maxProducible };
}

function parseBomInput(input: BomTemplateInput): BomTemplateInput {
  const result = bomTemplateInputSchema.safeParse(input);
  if (!result.success) {
    throw new BusinessRuleError(result.error.issues[0]?.message ?? "Dados do BOM inválidos.");
  }
  return result.data as BomTemplateInput;
}

function assertUniqueCode(code: string, exceptId?: string): void {
  const state = getDemoState();
  const clash = state.bomTemplates.find(
    (t) => t.code.toLowerCase() === code.toLowerCase() && t.id !== exceptId,
  );
  if (clash) {
    throw new BusinessRuleError(`O código ${code} já está em uso por "${clash.name}".`);
  }
}

/* ------------------------------ Consultas --------------------------- */

export async function listBomTemplates(): Promise<BomTemplateView[]> {
  await simulateLatency();
  return getDemoState().bomTemplates.map(buildView);
}

export async function getBomTemplate(id: string): Promise<BomTemplateView> {
  await simulateLatency();
  const template = getDemoState().bomTemplates.find(
    (t) => t.id === id || t.code.toLowerCase() === id.toLowerCase(),
  );
  if (!template) throw new NotFoundError("Template BOM não encontrado.");
  return buildView(template);
}

/* ------------------------------ Cadastro ---------------------------- */

export async function createBomTemplate(input: BomTemplateInput): Promise<BomTemplate> {
  await simulateLatency();
  const data = parseBomInput(input);
  assertUniqueCode(data.code);
  const state = getDemoState();

  const template: BomTemplate = {
    id: createId("bom"),
    code: data.code.toUpperCase(),
    name: data.name,
    description: data.description ?? "",
    productCategory: data.productCategory,
    items: data.items.map((i) => ({ materialId: i.materialId, quantity: i.quantity })),
    active: data.active,
    createdBy: state.user.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  setDemoState((s) => ({
    ...s,
    bomTemplates: [template, ...s.bomTemplates],
    history: [
      createHistoryEntry({
        kind: "cadastro",
        actor: s.user.name,
        action: "Template BOM cadastrado",
        details: `${template.code} · ${template.name} (${template.productCategory})`,
      }),
      ...s.history,
    ],
  }));

  return template;
}

export async function updateBomTemplate(id: string, input: BomTemplateInput): Promise<BomTemplate> {
  await simulateLatency();
  const data = parseBomInput(input);
  const state = getDemoState();
  const current = state.bomTemplates.find((t) => t.id === id);
  if (!current) throw new NotFoundError("Template BOM não encontrado.");
  assertUniqueCode(data.code, id);

  const updated: BomTemplate = {
    ...current,
    code: data.code.toUpperCase(),
    name: data.name,
    description: data.description ?? "",
    productCategory: data.productCategory,
    items: data.items.map((i) => ({ materialId: i.materialId, quantity: i.quantity })),
    active: data.active,
    updatedAt: new Date().toISOString(),
  };

  setDemoState((s) => ({
    ...s,
    bomTemplates: s.bomTemplates.map((t) => (t.id === id ? updated : t)),
    history: [
      createHistoryEntry({
        kind: "cadastro",
        actor: s.user.name,
        action: "Template BOM atualizado",
        details: `${updated.code} · ${updated.name}`,
      }),
      ...s.history,
    ],
  }));

  return updated;
}

export async function setBomTemplateActive(id: string, active: boolean): Promise<BomTemplate> {
  await simulateLatency();
  const state = getDemoState();
  const current = state.bomTemplates.find((t) => t.id === id);
  if (!current) throw new NotFoundError("Template BOM não encontrado.");
  if (current.active === active) return current;

  const updated = { ...current, active, updatedAt: new Date().toISOString() };
  setDemoState((s) => ({
    ...s,
    bomTemplates: s.bomTemplates.map((t) => (t.id === id ? updated : t)),
    history: [
      createHistoryEntry({
        kind: "cadastro",
        actor: s.user.name,
        action: active ? "Template BOM reativado" : "Template BOM desativado",
        details: `${updated.code} · ${updated.name}`,
      }),
      ...s.history,
    ],
  }));

  return updated;
}

export async function suggestBomCode(): Promise<string> {
  await simulateLatency(60);
  return nextBomCode(getDemoState().bomTemplates);
}
