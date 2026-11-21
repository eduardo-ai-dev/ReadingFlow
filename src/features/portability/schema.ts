import { z } from "zod";

export const importCsvBatchSchema = z.object({
  source: z.enum(["template", "goodreads"]),
  csvText: z
    .string()
    .min(1, "Cole ou envie um arquivo CSV válido.")
    .max(5 * 1024 * 1024, "O arquivo CSV excede o limite de 5 MB."),
});

export const rollbackImportSchema = z.object({
  jobId: z.string().min(1),
});

export const restoreBackupSchema = z.object({
  rawJson: z
    .string()
    .min(10, "Envie um arquivo JSON de backup válido.")
    .max(10 * 1024 * 1024, "O arquivo JSON excede o limite de 10 MB."),
});
