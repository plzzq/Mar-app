/* ------------------------------------------------------------------ */
/* Verificação funcional automatizada (fluxos completos, não só UI).  */
/* Executa sobre um snapshot isolado e restaura tudo ao final —       */
/* nenhum dado do usuário é alterado. Resultados exibidos em          */
/* Configurações > Testes.                                            */
/* ------------------------------------------------------------------ */
import { buildDashboardMetrics } from "@/lib/metrics";
import { buildOperationalContext } from "./marIA/context";
import { getDemoState, replaceDemoState } from "./demo/demoDb";
import { can } from "./permissions";
import {
  cancelRequest,
  createRequest,
  listRequests,
} from "./requestsService";
import {
  createMaterial,
  listMaterials,
  listMovements,
  registerMovement,
  reverseMovement,
  updateMaterial,
} from "./stockService";
import { clearUndoStack, undoLastAction } from "./undoService";
import { createOperationKey } from "./demo/demoDb";

export interface SelfTestResult {
  name: string;
  pass: boolean;
  details: string;
}

async function step(name: string, fn: () => Promise<string>): Promise<SelfTestResult> {
  try {
    return { name, pass: true, details: await fn() };
  } catch (error) {
    return { name, pass: false, details: error instanceof Error ? error.message : String(error) };
  }
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

export async function runSelfTests(): Promise<SelfTestResult[]> {
  const snapshot = structuredClone(getDemoState());
  clearUndoStack();
  const results: SelfTestResult[] = [];
  const actor = getDemoState().user.name;

  try {
    const initialCount = (await listMaterials()).length;

    results.push(
      await step("1. Cadastrar item de estoque e confirmar persistência", async () => {
        const created = await createMaterial({
          name: "Fita de teste automatizado",
          code: "MAT-TSTE",
          description: "Item criado pela verificação automatizada.",
          category: "Materiais auxiliares",
          unit: "m",
          available: 10,
          minimumStock: 2,
          location: "Z-99-99",
          active: true,
        });
        const found = (await listMaterials()).find((m) => m.id === created.id);
        assert(found?.available === 10, "Item não encontrado após o cadastro.");
        assert((await listMaterials()).length === initialCount + 1, "Contagem de itens inconsistente.");
        return `${created.code} cadastrado com saldo 10 m.`;
      }),
    );

    results.push(
      await step("2. Registrar entrada e verificar saldo + histórico", async () => {
        const { movement, duplicate } = await registerMovement({
          materialId: (await listMaterials()).find((m) => m.code === "MAT-TSTE")!.id,
          type: "entrada",
          quantity: 5,
          reason: "Teste automatizado de entrada",
          idempotencyKey: createOperationKey(),
        });
        assert(!duplicate, "Entrada legítima marcada como duplicada.");
        assert(movement.balanceAfter === 15, `Saldo esperado 15, obtido ${movement.balanceAfter}.`);
        return "Saldo 10 → 15 m, movimentação registrada.";
      }),
    );

    results.push(
      await step("3. Registrar saída e verificar histórico", async () => {
        const mat = (await listMaterials()).find((m) => m.code === "MAT-TSTE")!;
        const { movement } = await registerMovement({
          materialId: mat.id,
          type: "saida",
          quantity: 4,
          reason: "Teste automatizado de saída",
          idempotencyKey: createOperationKey(),
        });
        assert(movement.balanceAfter === 11, `Saldo esperado 11, obtido ${movement.balanceAfter}.`);
        const history = await listMovements(mat.id);
        assert(history.length >= 3, "Movimentações não preservadas no histórico.");
        return "Saldo 15 → 11 m, histórico com 3+ registros.";
      }),
    );

    results.push(
      await step("4. Bloquear saída acima do saldo", async () => {
        const mat = (await listMaterials()).find((m) => m.code === "MAT-TSTE")!;
        try {
          await registerMovement({
            materialId: mat.id,
            type: "saida",
            quantity: 9999,
            reason: "Tentativa inválida",
            idempotencyKey: createOperationKey(),
          });
        } catch {
          const after = (await listMaterials()).find((m) => m.id === mat.id)!;
          assert(after.available === 11, "Saldo alterado por operação inválida.");
          return "Saída recusada e saldo intacto (11 m).";
        }
        throw new Error("Saída acima do saldo foi aceita.");
      }),
    );

    results.push(
      await step("5. Editar produto sem alterar saldo pelo cadastro", async () => {
        const mat = (await listMaterials()).find((m) => m.code === "MAT-TSTE")!;
        const updated = await updateMaterial(mat.id, {
          name: "Fita de teste automatizado (rev.)",
          code: mat.code,
          description: mat.description,
          category: mat.category,
          unit: mat.unit,
          available: 9999,
          minimumStock: 5,
          location: mat.location,
          active: true,
        });
        assert(updated.name.includes("(rev.)"), "Nome não atualizado.");
        assert(updated.available === 11, "Edição cadastral alterou o saldo (deveria ser só por movimentação).");
        return "Nome e mínimo atualizados; saldo preservado em 11 m.";
      }),
    );

    results.push(
      await step("6. Criar e cancelar solicitação (motivo obrigatório)", async () => {
        const mat = (await listMaterials()).find((m) => m.code === "MAT-TSTE")!;
        const created = await createRequest(
          {
            description: "Solicitação de teste automatizado para cancelamento",
            sector: "Acabamento",
            responsible: "Teste Automatizado",
            priority: "Baixa",
            dueDate: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
            items: [{ materialId: mat.id, requested: 2 }],
          },
          createOperationKey(),
        );
        try {
          await cancelRequest(created.id, "curto");
          throw new Error("Cancelamento com motivo curto foi aceito.");
        } catch (error) {
          assert(!(error instanceof Error && error.message.includes("aceito")), "Falha inesperada.");
        }
        const cancelled = await cancelRequest(created.id, "Cancelamento de teste automatizado: demanda reagendada.");
        assert(cancelled.status === "Cancelada", "Status não mudou para Cancelada.");
        assert(!!cancelled.cancelReason, "Motivo não preservado.");
        return `${cancelled.code} cancelada com motivo registrado.`;
      }),
    );

    results.push(
      await step("7. Reservas liberadas após o cancelamento", async () => {
        const mats = await listMaterials();
        const tste = mats.find((m) => m.code === "MAT-TSTE")!;
        assert(tste.reserved === 0 && tste.openDemand === 0, `Reservas não liberadas: reservado=${tste.reserved}, aberta=${tste.openDemand}.`);
        return "Demanda da solicitação cancelada excluída do cálculo.";
      }),
    );

    results.push(
      await step("8. Desfazer restaura o estado anterior", async () => {
        const before = (await listRequests()).length;
        await createRequest(
          {
            description: "Solicitação temporária para teste de desfazer",
            sector: "Acabamento",
            responsible: "Teste Automatizado",
            priority: "Baixa",
            dueDate: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
            items: [{ materialId: (await listMaterials()).find((m) => m.code === "MAT-TSTE")!.id, requested: 1 }],
          },
          createOperationKey(),
        );
        const label = undoLastAction(actor);
        assert(label, "Nada para desfazer.");
        assert((await listRequests()).length === before, "Desfazer não restaurou a lista.");
        return `Operação desfeita: ${label}.`;
      }),
    );

    results.push(
      await step("9. Permissão negada para perfil sem acesso", async () => {
        assert(!can("stock.move", "leitura"), "Perfil leitura não deveria movimentar estoque.");
        assert(!can("request.cancel", "producao"), "Produção não deveria cancelar.");
        assert(can("request.cancel", "pcp"), "PCP deveria poder cancelar.");
        assert(can("stock.move", "almoxarifado"), "Almoxarifado deveria movimentar.");
        return "Matriz de permissões íntegra (leitura bloqueada, PCP/Almoxarifado liberados).";
      }),
    );

    results.push(
      await step("10. Clique duplo não duplica movimentação", async () => {
        const mat = (await listMaterials()).find((m) => m.code === "MAT-TSTE")!;
        const key = createOperationKey();
        const first = await registerMovement({ materialId: mat.id, type: "entrada", quantity: 2, reason: "Teste de idempotência", idempotencyKey: key });
        const second = await registerMovement({ materialId: mat.id, type: "entrada", quantity: 2, reason: "Teste de idempotência", idempotencyKey: key });
        assert(!first.duplicate && second.duplicate, "Segunda chamada deveria ser ignorada.");
        assert(second.movement.id === first.movement.id, "Deveria retornar a mesma movimentação.");
        return "Repetição com mesma chave retornou o registro original.";
      }),
    );

    results.push(
      await step("11. Estorno compensa sem apagar o original", async () => {
        const mat = (await listMaterials()).find((m) => m.code === "MAT-TSTE")!;
        const target = (await listMovements(mat.id)).find((m) => m.type === "entrada" && m.quantity === 2)!;
        const before = (await listMaterials()).find((m) => m.id === mat.id)!.available;
        const reversal = await reverseMovement(target.id, "Teste automatizado de estorno", createOperationKey());
        assert(reversal.type === "estorno" && reversal.reversalOf === target.id, "Estorno mal formado.");
        const after = (await listMaterials()).find((m) => m.id === mat.id)!.available;
        assert(after === before - 2, `Saldo esperado ${before - 2}, obtido ${after}.`);
        try {
          await reverseMovement(target.id, "Segundo estorno", createOperationKey());
          throw new Error("Estorno duplo foi aceito.");
        } catch (error) {
          assert(!(error instanceof Error && error.message.includes("aceito")), "Falha inesperada.");
        }
        return `Saldo ${before} → ${after}; original preservado; 2º estorno bloqueado.`;
      }),
    );

    results.push(
      await step("12. Cache local persiste (base para recarregar a página)", async () => {
        const raw = localStorage.getItem("mare:state:v2");
        assert(raw, "Cache local ausente.");
        const parsed = JSON.parse(raw as string) as { version: number };
        assert(parsed.version === 2, "Versão do cache incompatível.");
        return "Estado versionado gravado em mare:state:v2.";
      }),
    );

    results.push(
      await step("13. Indicadores refletem os registros", async () => {
        const state = getDemoState();
        const metrics = buildDashboardMetrics(state.requests, state.materials);
        assert(metrics.total === state.requests.length, "Total divergente.");
        assert(metrics.cancelled === state.requests.filter((r) => r.status === "Cancelada").length, "Canceladas divergentes.");
        const ctx = buildOperationalContext(state);
        assert(ctx.summary.totalRequests === state.requests.length, "Contexto Mar.IA divergente.");
        return `${metrics.total} solicitações e ${state.materials.length} materiais consistentes.`;
      }),
    );

    results.push(
      await step("14. Regras terminais: concluir/cancelar inválidos bloqueados", async () => {
        const concluded = (await listRequests()).find((r) => r.status === "Concluída")!;
        try {
          await cancelRequest(concluded.id, "Tentativa inválida de cancelamento teste.");
          throw new Error("Cancelamento de concluída foi aceito.");
        } catch (error) {
          assert(!(error instanceof Error && error.message.includes("aceito")), "Falha inesperada.");
        }
        return "Cancelamento de solicitação concluída recusado.";
      }),
    );
  } finally {
    replaceDemoState(snapshot);
    clearUndoStack();
  }

  return results;
}
