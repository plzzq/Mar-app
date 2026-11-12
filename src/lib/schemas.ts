/* Validação de domínio com Zod (usada pelos serviços e pelos formulários). */
import { z } from "zod";
import { PRIORITIES, SECTORS, STOCK_CATEGORIES, STOCK_UNITS } from "@/types";

const dateOnly = z
  .string({ message: "Informe a data de prazo." })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data de prazo válida.");

export const requestInputSchema = z.object({
  description: z
    .string({ message: "Informe a descrição da demanda." })
    .trim()
    .min(10, "A descrição deve ter pelo menos 10 caracteres.")
    .max(180, "A descrição deve ter no máximo 180 caracteres."),
  sector: z.enum(SECTORS, { message: "Selecione o setor solicitante." }),
  responsible: z
    .string({ message: "Informe o responsável." })
    .trim()
    .min(3, "Informe o nome do responsável."),
  priority: z.enum(PRIORITIES, { message: "Selecione a prioridade." }),
  dueDate: dateOnly,
  notes: z.string().trim().max(500, "As observações devem ter no máximo 500 caracteres.").optional(),
  items: z
    .array(
      z.object({
        materialId: z.string().min(1, "Selecione um material."),
        requested: z
          .number({ message: "Informe a quantidade." })
          .int("A quantidade deve ser um número inteiro.")
          .positive("A quantidade deve ser maior que zero."),
      }),
    )
    .min(1, "Adicione ao menos um material à solicitação.")
    .refine(
      (items) => new Set(items.map((i) => i.materialId)).size === items.length,
      "Não repita o mesmo material na solicitação.",
    ),
});

export const cancelRequestSchema = z.object({
  reason: z
    .string({ message: "Informe o motivo do cancelamento." })
    .trim()
    .min(10, "Descreva o motivo com pelo menos 10 caracteres.")
    .max(300, "O motivo deve ter no máximo 300 caracteres."),
});

export const materialInputSchema = z.object({
  name: z
    .string({ message: "Informe o nome do material." })
    .trim()
    .min(3, "O nome deve ter pelo menos 3 caracteres.")
    .max(120, "O nome deve ter no máximo 120 caracteres."),
  code: z
    .string({ message: "Informe o código/SKU." })
    .trim()
    .min(3, "O código deve ter pelo menos 3 caracteres.")
    .max(20, "O código deve ter no máximo 20 caracteres.")
    .regex(/^[A-Za-z0-9._-]+$/, "Use apenas letras, números, ponto, hífen ou sublinhado."),
  description: z
    .string({ message: "Informe a descrição." })
    .trim()
    .min(5, "A descrição deve ter pelo menos 5 caracteres.")
    .max(300, "A descrição deve ter no máximo 300 caracteres."),
  category: z.enum(STOCK_CATEGORIES, { message: "Selecione a categoria." }),
  unit: z.enum(STOCK_UNITS, { message: "Selecione a unidade de medida." }),
  available: z
    .number({ message: "Informe a quantidade atual." })
    .int("A quantidade deve ser um número inteiro.")
    .min(0, "A quantidade não pode ser negativa."),
  minimumStock: z
    .number({ message: "Informe o estoque mínimo." })
    .int("O estoque mínimo deve ser um número inteiro.")
    .min(0, "O estoque mínimo não pode ser negativo."),
  location: z
    .string({ message: "Informe a localização." })
    .trim()
    .min(2, "Informe a localização no almoxarifado.")
    .max(20, "A localização deve ter no máximo 20 caracteres."),
  supplier: z.string().trim().max(120, "O fornecedor deve ter no máximo 120 caracteres.").optional(),
  cost: z
    .number({ message: "Informe um custo válido." })
    .min(0, "O custo não pode ser negativo.")
    .max(1000000, "Informe um custo válido.")
    .optional(),
  active: z.boolean(),
});

export const movementInputSchema = z.object({
  materialId: z.string().min(1, "Selecione um material."),
  type: z.enum(["entrada", "saida", "ajuste"], { message: "Selecione o tipo de movimentação." }),
  quantity: z
    .number({ message: "Informe a quantidade." })
    .int("A quantidade deve ser um número inteiro.")
    .positive("A quantidade deve ser maior que zero."),
  reason: z
    .string({ message: "Informe o motivo." })
    .trim()
    .min(5, "Descreva o motivo com pelo menos 5 caracteres.")
    .max(300, "O motivo deve ter no máximo 300 caracteres."),
  relatedRequestCode: z.string().trim().max(20).optional(),
  idempotencyKey: z.string().min(1),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Informe o e-mail ou a matrícula."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
});

export const profileSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo."),
  role: z.string().trim().min(2, "Informe a função."),
  email: z.email("Informe um e-mail válido."),
});
