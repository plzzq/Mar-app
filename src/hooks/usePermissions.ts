import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { can } from "@/services/permissions";
import type { PermissionAction } from "@/types";

/** Permissões do usuário ativo (reage à troca de perfil). */
export function usePermissions() {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setVersion((v) => v + 1);
  }, [user.id, user.roleKey]);

  void version;
  return {
    role: user.roleKey,
    can: (action: PermissionAction) => can(action, user.roleKey),
  };
}
