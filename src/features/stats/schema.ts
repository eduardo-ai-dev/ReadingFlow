import { z } from "zod";

export const statsPeriodSchema = z.object({
  preset: z
    .enum(["current_year", "current_month", "all_time", "custom"])
    .default("current_year"),
  startYmd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endYmd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
