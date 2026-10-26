/* Usuário e sessão.
   - Com Supabase configurado, signIn/signOut usam Supabase Auth e o
     perfil vem da tabela profiles (RLS).
   - Sem configuração, modo demonstração com troca de perfil local
     (para testar permissões). A autenticação real substituirá o fallback. */
import type { UserProfile, UserRole } from "@/types";
import { BusinessRuleError } from "@/lib/errors";
import { loginSchema, profileSchema } from "@/lib/schemas";
import { getDemoState, setDemoState, simulateLatency } from "./demo/demoDb";
import { clearUndoStack } from "./undoService";
import { isSupabaseConfigured, getSupabase } from "./supabase/client";

/** Restaura os dados de demonstração originais (somente para a demonstração). */
export async function restoreDemoData(): Promise<void> {
  await simulateLatency(300);
  const { resetDemoState } = await import("./demo/demoDb");
  resetDemoState();
  clearUndoStack();
}

export async function listUsers(): Promise<UserProfile[]> {
  await simulateLatency(60);
  return [...getDemoState().users];
}

/** Troca o perfil ativo (demonstração) para testar permissões por papel. */
export async function switchActiveUser(userId: string): Promise<UserProfile> {
  await simulateLatency(120);
  const target = getDemoState().users.find((u) => u.id === userId);
  if (!target) throw new BusinessRuleError("Perfil não encontrado.");
  clearUndoStack();
  setDemoState((s) => ({ ...s, user: { ...target } }));
  return { ...target };
}

/**
 * Login. Com Supabase: Auth real. Sem: demonstração com dois perfis fixos.
 * - Admin: admin@mare.app / ADM-0001 + senha "lula13"
 * - Visitante: qualquer identificador válido, qualquer senha de 6+ chars
 */
export async function signIn(identifier: string, password: string): Promise<UserProfile> {
  const parsed = loginSchema.safeParse({ identifier, password });
  if (!parsed.success) {
    throw new BusinessRuleError(parsed.error.issues[0]?.message ?? "Dados de acesso inválidos.");
  }
  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    const isEmail = identifier.includes("@");
    const { error } = isEmail
      ? await supabase.auth.signInWithPassword({ email: identifier, password })
      : await supabase.auth.signInWithPassword({ email: `${identifier}@exemplo.com.br`, password });
    if (error) throw new BusinessRuleError("Credenciais inválidas ou usuário inexistente.");
    const { data } = await supabase.from("profiles").select("*").single();
    const profile = data as unknown as {
      id: string; name: string; role_key: UserRole; role_label: string; sector: string; registration: string;
    } | null;
    if (!profile) throw new BusinessRuleError("Perfil não cadastrado. Fale com um administrador.");
    const user: UserProfile = {
      id: profile.id,
      name: profile.name,
      role: profile.role_label,
      roleKey: profile.role_key,
      sector: profile.sector,
      email: isEmail ? identifier : `${identifier}@exemplo.com.br`,
      registration: profile.registration,
    };
    setDemoState((s) => ({ ...s, user }));
    return { ...user };
  }

  await simulateLatency(900);

  if (password === "erro") {
    throw new Error("Não foi possível conectar ao serviço de autenticação. (Falha simulada na demonstração.)");
  }

  const state = getDemoState();
  const id = identifier.trim().toLowerCase();
  const adminUser  = state.users.find((u) => u.roleKey === "admin")!;
  const visitorUser = state.users.find((u) => u.roleKey === "leitura")!;

  // Admin: identificador é e-mail ou matrícula do admin, senha obrigatória "lula13"
  const isAdminId = id === adminUser.email.toLowerCase() || id === adminUser.registration.toLowerCase();
  if (isAdminId) {
    if (password !== "lula13") {
      throw new BusinessRuleError("Senha incorreta para o perfil Administrador.");
    }
    setDemoState((s) => ({ ...s, user: { ...adminUser } }));
    return { ...adminUser };
  }

  // Visitante: qualquer outro identificador válido com 6+ chars na senha
  setDemoState((s) => ({ ...s, user: { ...visitorUser } }));
  return { ...visitorUser };
}

export async function signOutEverywhere(): Promise<void> {
  if (isSupabaseConfigured()) {
    await getSupabase().auth.signOut();
  }
  clearUndoStack();
}

export async function getProfile(): Promise<UserProfile> {
  await simulateLatency(120);
  return { ...getDemoState().user };
}

export async function updateProfile(input: Pick<UserProfile, "name" | "role" | "email">): Promise<UserProfile> {
  await simulateLatency();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    throw new BusinessRuleError(parsed.error.issues[0]?.message ?? "Dados do perfil inválidos.");
  }
  setDemoState((s) => ({ ...s, user: { ...s.user, ...parsed.data } }));
  return { ...getDemoState().user };
}
