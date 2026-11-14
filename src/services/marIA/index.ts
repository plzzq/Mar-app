/* ------------------------------------------------------------------ */
/* Fachada da Mar.IA — ponto único de acesso usado pela interface.    */
/*                                                                    */
/* INTEGRAÇÃO FUTURA COM A IA REAL:                                   */
/* 1. Implemente um MarIAProvider que chame o endpoint seguro do      */
/*    backend (sem chaves de API no navegador), com suporte opcional  */
/*    a streaming (onChunk).                                          */
/* 2. Troque o provedor abaixo (activeProvider).                      */
/* 3. Substitua buildOperationalContext pelo contexto autorizado      */
/*    fornecido pelo backend.                                         */
/* ------------------------------------------------------------------ */
import { getDemoState } from "../demo/demoDb";
import { buildOperationalContext } from "./context";
import { createDemoProvider } from "./demoProvider";
import { MarIAError, type MarIAInput, type MarIAProvider, type MarIAResponse } from "./types";

export * from "./types";

/** Provedor reservado para a IA real. Ainda não configurado: lança erro controlado. */
export function createRemoteProvider(_endpoint?: string): MarIAProvider {
  return {
    mode: "ai",
    name: "Serviço de IA (não configurado)",
    async respond() {
      throw new MarIAError(
        "not_configured",
        "A conexão com a IA real ainda não foi configurada. Esta pergunta depende da integração com o backend seguro.",
      );
    },
  };
}

const activeProvider: MarIAProvider = createDemoProvider();

export const marIAService = {
  get mode(): MarIAProvider["mode"] {
    return activeProvider.mode;
  },
  get providerName(): string {
    return activeProvider.name;
  },
  async ask(input: MarIAInput, onChunk?: (chunk: string) => void): Promise<MarIAResponse> {
    const context = buildOperationalContext(getDemoState());
    return activeProvider.respond({ ...input, context }, onChunk);
  },
};
