import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  GOOGLE_BOOKS_API_KEY: z.string().optional(),
  HARDCOVER_API_TOKEN: z.string().optional(),
  /** Feature flag para Apple Books / iTunes Search (desligado por padrão). */
  ENABLE_APPLE_BOOKS_COVERS: z.boolean().default(false),
  OPEN_LIBRARY_USER_AGENT: z
    .string()
    .min(5)
    .default("ReadingFlow/0.1 (contato@readingflow.app)"),
  CATALOG_LOOKUP_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(10000)
    .default(4000),
  RATE_LIMIT_MAX_PER_MINUTE: z.coerce
    .number()
    .int()
    .min(5)
    .max(600)
    .default(60),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function parseBooleanFlag(raw: string | undefined): boolean {
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    GOOGLE_BOOKS_API_KEY: process.env.GOOGLE_BOOKS_API_KEY || undefined,
    HARDCOVER_API_TOKEN: process.env.HARDCOVER_API_TOKEN || undefined,
    ENABLE_APPLE_BOOKS_COVERS: parseBooleanFlag(
      process.env.ENABLE_APPLE_BOOKS_COVERS
    ),
    OPEN_LIBRARY_USER_AGENT: process.env.OPEN_LIBRARY_USER_AGENT,
    CATALOG_LOOKUP_TIMEOUT_MS: process.env.CATALOG_LOOKUP_TIMEOUT_MS,
    RATE_LIMIT_MAX_PER_MINUTE: process.env.RATE_LIMIT_MAX_PER_MINUTE,
  });
}
