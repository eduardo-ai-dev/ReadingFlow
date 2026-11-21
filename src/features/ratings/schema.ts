import { z } from "zod";
import { isValidHalfStar } from "@/features/ratings/rules";
import { ptBR } from "@/lib/i18n/pt-BR";

const halfStarField = z
  .number()
  .refine((val) => isValidHalfStar(val), ptBR.validation.invalidRating);

export const upsertReviewSchema = z.object({
  workId: z.string().min(1),
  rating: halfStarField,
  narrationRating: halfStarField.optional(),
  body: z.string().trim().max(2000).optional(),
});

export const deleteReviewSchema = z.object({
  workId: z.string().min(1),
});
