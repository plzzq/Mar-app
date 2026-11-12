/** Violação de uma regra de negócio (ex.: transição de status inválida). */
export class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessRuleError";
  }
}

/** Registro não encontrado na camada de dados. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Ocorreu um erro inesperado. Tente novamente.";
}
