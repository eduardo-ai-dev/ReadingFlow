import { z } from "zod";
import { COVER_INPUT_MAX_LENGTH } from "@/features/catalog/cover-rules";
import { ptBR } from "@/lib/i18n/pt-BR";

export const bookFormatEnum = z.enum([
  "hardcover",
  "paperback",
  "pocket",
  "ebook",
  "audiobook",
  "box",
  "other",
]);

export const ownershipStatusEnum = z.enum([
  "owned",
  "borrowed",
  "lent",
  "sold",
  "donated",
  "lost",
]);

export const conditionEnum = z.enum(["new", "good", "worn", "damaged"]);

export const coverSourceEnum = z.enum([
  "brasilapi",
  "google",
  "openlibrary",
  "hardcover",
  "apple",
  "upload",
]);

export const isbnLookupSchema = z.object({
  isbn: z.string().trim().min(8, ptBR.validation.invalidIsbn).max(24),
});

export const addBookSchema = z.object({
  isbn: z.string().trim().max(24).optional(),
  title: z.string().trim().min(1, ptBR.validation.requiredTitle).max(300),
  subtitle: z.string().trim().max(300).optional(),
  primaryAuthor: z
    .string()
    .trim()
    .min(1, ptBR.validation.requiredAuthor)
    .max(200),
  translator: z.string().trim().max(200).optional(),
  narrator: z.string().trim().max(200).optional(),
  publisher: z.string().trim().max(200).optional(),
  publishedYear: z.number().int().min(1000).max(2100).optional(),
  primaryGenre: z.string().trim().max(100).optional(),
  description: z.string().trim().max(4000).optional(),
  language: z.string().trim().min(2).max(16).default("pt-BR"),
  format: bookFormatEnum,
  pages: z.number().int().positive().max(20000).optional(),
  durationMinutes: z.number().int().positive().max(60000).optional(),
  coverUrl: z.string().trim().max(COVER_INPUT_MAX_LENGTH).optional(),
  coverSource: coverSourceEnum.nullable().optional(),
  skipAutoCover: z.boolean().optional(),
  heightMm: z.number().int().min(80).max(500).optional(),
  thicknessMm: z.number().int().min(2).max(200).optional(),
  ownershipStatus: ownershipStatusEnum.default("owned"),
  acquiredOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  pricePaid: z.number().min(0).max(100000).optional(),
  store: z.string().trim().max(160).optional(),
  condition: conditionEnum.optional(),
  notes: z.string().trim().max(2000).optional(),
  addToWishlistOnly: z.boolean().optional(),
  priority: z
    .union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ])
    .optional(),
  targetPrice: z.number().min(0).max(100000).optional(),
  forceDuplicateCopy: z.boolean().optional(),
  startReadingImmediately: z.boolean().optional(),
});

export const updateBookMetadataSchema = z.object({
  workId: z.string().min(1),
  editionId: z.string().min(1),
  itemId: z.string().optional(),
  isbn: z.string().trim().max(24).optional(),
  title: z.string().trim().min(1, ptBR.validation.requiredTitle).max(300),
  primaryAuthor: z
    .string()
    .trim()
    .min(1, ptBR.validation.requiredAuthor)
    .max(200),
  publisher: z.string().trim().max(200).optional(),
  primaryGenre: z.string().trim().max(100).optional(),
  description: z.string().trim().max(4000).optional(),
  format: bookFormatEnum,
  pages: z.number().int().positive().max(20000).optional(),
  durationMinutes: z.number().int().positive().max(60000).optional(),
  /** `undefined` mantém a capa atual; `""` remove; senão define (upload ou URL permitida). */
  coverUrl: z.string().trim().max(COVER_INPUT_MAX_LENGTH).optional(),
  coverSource: coverSourceEnum.nullable().optional(),
  acquiredOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  pricePaid: z.number().min(0).max(100000).optional(),
  store: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateEditionCoverSchema = z.object({
  editionId: z.string().min(1),
  coverUrl: z.string().trim().max(COVER_INPUT_MAX_LENGTH).nullable(),
  coverSource: coverSourceEnum.nullable(),
  /** `page_count` do provedor preenche `pages` da edição quando estiver vazio. */
  pageCount: z.number().int().positive().max(20000).optional(),
});
