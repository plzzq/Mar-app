/* ------------------------------------------------------------------ */
/* Repositórios Supabase — mesmas assinaturas dos serviços locais.    */
/* Quando isSupabaseConfigured(), os serviços delegam para cá; caso   */
/* contrário, usam o armazenamento local. Operações críticas de       */
/* estoque usam a função transacional register_stock_movement         */
/* (ver supabase/schema.sql), que valida saldo e impede duplicação    */
/* pela chave de idempotência (constraint UNIQUE).                    */
/* ------------------------------------------------------------------ */
import type { Material, MaterialInput, MovementInput, StockMovement } from "@/types";
import { getSupabase } from "./client";

type MaterialRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  available: number;
  unit: string;
  location: string;
  minimum_stock: number;
  supplier: string | null;
  cost: number | null;
  active: boolean;
};

type MovementRow = {
  id: string;
  material_id: string;
  type: StockMovement["type"];
  quantity: number;
  balance_after: number;
  reason: string;
  actor: string;
  created_at: string;
  related_request_code: string | null;
  reversal_of: string | null;
  idempotency_key: string;
};

function toMaterial(row: MaterialRow): Material {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    category: row.category,
    available: row.available,
    unit: row.unit,
    location: row.location,
    minimumStock: row.minimum_stock,
    supplier: row.supplier ?? undefined,
    cost: row.cost ?? undefined,
    active: row.active,
  };
}

function toMovement(row: MovementRow): StockMovement {
  return {
    id: row.id,
    materialId: row.material_id,
    type: row.type,
    quantity: row.quantity,
    balanceAfter: row.balance_after,
    reason: row.reason,
    actor: row.actor,
    timestamp: row.created_at,
    relatedRequestCode: row.related_request_code ?? undefined,
    reversalOf: row.reversal_of ?? undefined,
    idempotencyKey: row.idempotency_key,
  };
}

function supabaseErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Registro duplicado: esta operação já foi processada.";
  if (error.code === "42501") return "Sem permissão para esta operação (RLS). Fale com um administrador.";
  if (error.message.includes("insufficient")) return "Saldo insuficiente para esta saída.";
  return "Falha de comunicação com o banco de dados. Tente novamente.";
}

export async function supabaseListMaterials(): Promise<Material[]> {
  const { data, error } = await getSupabase().from("materials").select("*").order("name");
  if (error) throw new Error(supabaseErrorMessage(error));
  return (data as MaterialRow[]).map(toMaterial);
}

export async function supabaseCreateMaterial(input: MaterialInput, actor: string): Promise<Material> {
  const { data, error } = await getSupabase()
    .from("materials")
    .insert({
      code: input.code.toUpperCase(),
      name: input.name,
      description: input.description,
      category: input.category,
      available: 0,
      unit: input.unit,
      location: input.location,
      minimum_stock: input.minimumStock,
      supplier: input.supplier || null,
      cost: input.cost ?? null,
      active: input.active,
      created_by: actor,
    })
    .select()
    .single();
  if (error) throw new Error(supabaseErrorMessage(error));
  const material = toMaterial(data as MaterialRow);
  if (input.available > 0) {
    await supabaseRegisterMovement(
      { materialId: material.id, type: "entrada", quantity: input.available, reason: "Estoque inicial do cadastro", idempotencyKey: `cadastro-${material.id}` },
      actor,
    );
    material.available = input.available;
  }
  return material;
}

/** Movimentação transacional via RPC (valida saldo + idempotência no banco). */
export async function supabaseRegisterMovement(input: MovementInput, actor: string): Promise<{ movement: StockMovement; duplicate: boolean }> {
  const { data, error } = await getSupabase().rpc("register_stock_movement", {
    p_material_id: input.materialId,
    p_type: input.type,
    p_quantity: input.quantity,
    p_reason: input.reason,
    p_actor: actor,
    p_related_request_code: input.relatedRequestCode ?? null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(supabaseErrorMessage(error));
  const row = (Array.isArray(data) ? data[0] : data) as MovementRow & { is_duplicate?: boolean };
  return { movement: toMovement(row), duplicate: Boolean(row.is_duplicate) };
}

export async function supabaseListMovements(materialId?: string): Promise<StockMovement[]> {
  let query = getSupabase().from("stock_movements").select("*").order("created_at", { ascending: false }).limit(200);
  if (materialId) query = query.eq("material_id", materialId);
  const { data, error } = await query;
  if (error) throw new Error(supabaseErrorMessage(error));
  return (data as MovementRow[]).map(toMovement);
}

export async function supabaseListHistory(limit = 300) {
  const { data, error } = await getSupabase().from("history").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(supabaseErrorMessage(error));
  return (data ?? []).map((h: Record<string, unknown>) => ({
    id: h.id,
    timestamp: h.created_at,
    kind: h.kind,
    requestCode: h.request_code ?? undefined,
    materialCode: h.material_code ?? undefined,
    actor: h.actor,
    action: h.action,
    from: h.from_status ?? undefined,
    to: h.to_status ?? undefined,
    details: h.details ?? undefined,
  }));
}
