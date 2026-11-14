/* ------------------------------------------------------------------ */
/* Permissões por perfil. As mesmas regras DEVEM ser aplicadas no     */
/* backend (Supabase RLS — ver supabase/schema.sql); aqui elas        */
/* organizam a interface e fazem validação antecipada.                */
/* ------------------------------------------------------------------ */
import type { PermissionAction, UserRole } from "@/types";
import { BusinessRuleError } from "@/lib/errors";
import { getDemoState } from "./demo/demoDb";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administradora do sistema",
  pcp: "Planejamento e Controle da Produção",
  almoxarifado: "Almoxarifado",
  producao: "Produção",
  leitura: "Somente leitura",
};

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}

/** Matriz de permissões: quais perfis podem executar cada ação. */
const PERMISSION_MATRIX: Record<PermissionAction, UserRole[]> = {
  "material.create": ["admin", "almoxarifado"],
  "material.edit": ["admin", "almoxarifado"],
  "material.deactivate": ["admin"],
  "stock.move": ["admin", "almoxarifado"],
  "stock.reverse": ["admin", "almoxarifado"],
  "request.create": ["admin", "pcp", "producao"],
  "request.edit": ["admin", "pcp"],
  "request.cancel": ["admin", "pcp"],
  "request.status": ["admin", "pcp", "almoxarifado"],
  "separation.execute": ["admin", "almoxarifado"],
};

export function currentRole(): UserRole {
  return getDemoState().user.roleKey;
}

/** Verifica se um perfil pode executar a ação (para exibir/ocultar botões). */
export function can(action: PermissionAction, role: UserRole = currentRole()): boolean {
  return PERMISSION_MATRIX[action].includes(role);
}

/** Impõe a permissão nos serviços. Lança erro amigável (sem vazar detalhes). */
export function requirePermission(action: PermissionAction): void {
  const role = currentRole();
  if (!can(action, role)) {
    throw new BusinessRuleError(
      `Seu perfil (${ROLE_LABELS[role]}) não tem permissão para esta operação. Fale com um administrador.`,
    );
  }
}

export function permissionHint(action: PermissionAction): string {
  const roles = PERMISSION_MATRIX[action].map((r) => ROLE_LABELS[r]).join(", ");
  return `Permitido para: ${roles}.`;
}
