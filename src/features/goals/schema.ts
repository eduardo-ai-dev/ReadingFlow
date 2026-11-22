import { z } from "zod";

const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createGoalSchema = z.object({
  title: z.string().trim().min(2, "Informe um título para a meta.").max(100),
  kind: z.enum(["books", "pages"]),
  period: z.enum(["year", "month"]),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12).optional(),
  targetValue: z
    .number()
    .int()
    .positive("A meta deve ser maior que zero.")
    .max(100000),
  countRereads: z.boolean().default(false),
});

export const updateGoalSchema = z.object({
  goalId: z.string().min(1, "Meta inválida."),
  title: z.string().trim().min(2).max(100).optional(),
  targetValue: z
    .number()
    .int()
    .positive("A meta deve ser maior que zero.")
    .max(100000)
    .optional(),
  endsOn: z
    .string()
    .regex(ymdRegex, "Informe uma data válida no formato AAAA-MM-DD.")
    .optional(),
});

export const togglePauseGoalSchema = z.object({
  goalId: z.string().min(1, "Meta inválida."),
  paused: z.boolean(),
});

export const deleteGoalSchema = z.object({
  goalId: z.string().min(1),
});
