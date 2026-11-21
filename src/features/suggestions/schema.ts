import { z } from "zod";
import { SUGGESTION_GENRE_OPTIONS, type SuggestionGenreKey } from "./rules";

const GENRE_KEYS = SUGGESTION_GENRE_OPTIONS.map((g) => g.key) as [
  SuggestionGenreKey,
  ...SuggestionGenreKey[],
];

export const suggestionsQuerySchema = z.object({
  mode: z.enum(["new_books"]).default("new_books"),
  genre: z.enum(GENRE_KEYS).default("todos"),
  batch: z.coerce.number().int().min(0).max(50).default(0),
});

export const saveSuggestionToWishlistSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Informe o título do livro.")
    .max(300, "Título muito longo."),
  author: z
    .string()
    .trim()
    .min(1, "Informe o autor.")
    .max(200, "Nome do autor muito longo."),
  genre: z.string().trim().max(80).optional(),
  isbn: z.string().trim().max(24).optional(),
  pages: z.number().int().positive().max(20000).nullable().optional(),
  coverUrl: z.string().trim().max(2000).optional(),
  priority: z
    .union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ])
    .default(4),
});

export const startReadingNewSuggestionSchema = z.object({
  title: z.string().trim().min(1).max(300),
  author: z.string().trim().min(1).max(200),
  genre: z.string().trim().max(80).optional(),
  isbn: z.string().trim().max(24).optional(),
  pages: z.number().int().positive().max(20000).nullable().optional(),
  coverUrl: z.string().trim().max(2000).optional(),
});
