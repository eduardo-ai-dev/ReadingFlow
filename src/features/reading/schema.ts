import { z } from "zod";
import { bookFormatEnum } from "@/features/catalog/schema";

export const progressUnitEnum = z.enum(["pages", "percent", "seconds"]);

export const startReadingSchema = z.object({
  workId: z.string().min(1),
  editionId: z.string().optional(),
  libraryItemId: z.string().optional(),
  format: bookFormatEnum.optional(),
  startedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  countsForGoals: z.boolean().default(true),
});

export const updateReadingProgressSchema = z.object({
  readingId: z.string().min(1),
  progressUnit: progressUnitEnum,
  progressValue: z.number().min(0).max(500000),
  progressTotal: z.number().positive().max(500000).optional(),
  convertFromPreviousUnit: z.boolean().optional(),
  sessionNotes: z.string().trim().max(2000).optional(),
});

export const finishReadingSchema = z.object({
  readingId: z.string().min(1),
  finishedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const abandonReadingSchema = z.object({
  readingId: z.string().min(1),
  abandonReason: z.string().trim().max(500).optional(),
});

export const togglePauseReadingSchema = z.object({
  readingId: z.string().min(1),
});
