import { z } from "zod";
import { bookFormatEnum, conditionEnum } from "@/features/catalog/schema";
import { ptBR } from "@/lib/i18n/pt-BR";

export const addWishlistItemSchema = z.object({
  title: z.string().trim().min(1, ptBR.validation.requiredTitle).max(300),
  primaryAuthor: z
    .string()
    .trim()
    .min(1, ptBR.validation.requiredAuthor)
    .max(200),
  isbn: z.string().trim().max(24).optional(),
  format: bookFormatEnum.default("paperback"),
  priority: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  targetPrice: z.number().min(0).max(100000).optional(),
  whereToBuy: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const purchaseWishlistSchema = z.object({
  wishId: z.string().min(1),
  format: bookFormatEnum,
  pricePaid: z.number().min(0).max(100000).optional(),
  acquiredOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  store: z.string().trim().max(160).optional(),
  condition: conditionEnum.optional(),
});

export const dropWishlistSchema = z.object({
  wishId: z.string().min(1),
});
