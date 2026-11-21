import { z } from "zod";

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

export const deleteGoalSchema = z.object({
  goalId: z.string().min(1),
});
